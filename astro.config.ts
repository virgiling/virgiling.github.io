import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import {mkdir,rename} from 'node:fs/promises';
import {readContent} from './src/content/read';
import {contentPolicy} from './src/content-policy';
import { siteConfig } from './src/site.config';
import {registerContentWatcher} from './src/dev/content-watch';
import {viteCacheDirectory} from './src/dev/vite-cache';
import {fontPreparation} from './src/integrations/font-preparation';

export default defineConfig({
  site:siteConfig.site, base:siteConfig.base, output:'static', trailingSlash:'ignore',
  build:{format:'file'},
  vite:{build:{assetsInlineLimit:file=>file.endsWith('.woff2')?false:undefined,rolldownOptions:{output:{codeSplitting:{groups:[{name:'preload',priority:2,test:id=>id.includes('vite/preload-helper')},{name:'motion',priority:1,test:id=>id.endsWith('/src/runtime/motion.ts')},{name:'site',tags:['$initial'],test:id=>id.endsWith('/src/runtime/site.ts')||id.includes('/src/layouts/SiteLayout.astro?astro&type=script')}]}}}}, plugins:[tailwindcss()],worker:{format:'es'},optimizeDeps:{include:['motion/mini','motion','@floating-ui/dom','d3-selection','d3-zoom','d3-drag','d3-force','astro-leaflet > leaflet','lucide']},server:{watch:{ignored:[
    new RegExp('/content/(?:.*/)?(?:'+contentPolicy.ignoredDirectories.map(d=>d.replaceAll('.','\\.')).join('|')+')(?:/|$)'),
  ]}}},
  integrations:[fontPreparation(),{
    name:'notes-content-watch',
    hooks:{'astro:config:setup':({command,config,updateConfig})=>{
      updateConfig({vite:{cacheDir:viteCacheDirectory(config.root,command,config.server.port,config.base)}});
    },'astro:server:setup':({server})=>{
      registerContentWatcher(server);
    },'astro:build:done':async({dir,logger})=>{
      // Astro file-format flattens trailing-slash routes to folder.html. Preserve
      // the historical directory-index URL without changing ordinary note URLs.
      let count=0;
      for(const note of (await readContent('content')).notes){
        const path=note.route;
        if(!path.endsWith('/')||!note.body.trim())continue;
        await mkdir(new URL(path,dir),{recursive:true});
        await rename(new URL(path.slice(0,-1)+'.html',dir),new URL(path+'index.html',dir));count++;
      }
      logger.info(`Preserved ${count} directory-index routes`);
    }},
  }],
});
