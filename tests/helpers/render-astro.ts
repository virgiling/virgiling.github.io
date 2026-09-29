import {after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer, type ViteDevServer} from 'vite';
import {getViteConfig} from 'astro/config';
import {experimental_AstroContainer as AstroContainer} from 'astro/container';

// Use Astro's compiler and renderer, not a second implementation of the templates.
// Middleware mode has no listening HTTP server; each test worker owns its cache.
const root=fileURLToPath(new URL('../../',import.meta.url));
let server:Promise<ViteDevServer>|undefined;
function componentServer(){
  return server??=(async()=>{
    const config=await getViteConfig({
      root,logLevel:'silent',
      cacheDir:`${root}.astro/component-tests/${process.pid}`,
      server:{middlewareMode:true,hmr:false,watch:null},
      optimizeDeps:{noDiscovery:true,include:[]},
    },{root,configFile:false,devToolbar:{enabled:false},logLevel:'silent'})({mode:'test',command:'serve'});
    return createServer({...config,configFile:false});
  })();
}
after(async()=>{if(server)await (await server).close();});
export async function renderComponent(name:string,props:Record<string,unknown>={}){
  const vite=await componentServer();
  const {default:Component}=await vite.ssrLoadModule(`/src/components/${name}.astro`);
  const container=await AstroContainer.create();
  return container.renderToString(Component,{props});
}
