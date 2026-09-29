import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import {mkdir,rename} from 'node:fs/promises';
import {readContent} from './src/content/read';
import {contentPolicy} from './src/content-policy.mjs';
import { siteConfig } from './src/site.config';
import {registerContentWatcher} from './src/dev/content-watch';
import {viteCacheDirectory} from './src/dev/vite-cache';
import {ensureFonts} from './scripts/fonts/subset-ui-font';

export default defineConfig({
  site:siteConfig.site, base:siteConfig.base, output:'static', trailingSlash:'ignore',
  build:{format:'file'},
  vite:{build:{assetsInlineLimit:file=>file.endsWith('.woff2')?false:undefined},plugins:[tailwindcss()],worker:{format:'es'},optimizeDeps:{include:['motion/mini','motion','@floating-ui/dom','d3-selection','d3-zoom','d3-drag','d3-force']},server:{watch:{ignored:[
    new RegExp('/content/(?:.*/)?(?:'+contentPolicy.ignoredDirectories.map(d=>d.replaceAll('.','\\.')).join('|')+')(?:/|$)'),
  ]}}},
  integrations:[{
    name:'notes-content-watch',
    hooks:{'astro:config:setup':async({command,config,updateConfig})=>{
      if(command!=='preview')await ensureFonts();
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
