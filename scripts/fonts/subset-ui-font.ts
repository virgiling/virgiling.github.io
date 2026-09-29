// Inspired by astro-navfolio's UI-source collection + prebuild FontTools step.
// No content/Vault scan: complete source-font shards cover dynamic/public text.
import {readdir,readFile,writeFile,mkdir,rename,rm,lstat} from 'node:fs/promises';
import {resolve,join,extname,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
export const projectRoot=fileURLToPath(new URL('../../',import.meta.url));
export const generated=join(projectRoot,'src/fonts/generated');
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export async function collectUICharacters(root=projectRoot){
  const chars=new Set(Array.from({length:95},(_,i)=>String.fromCodePoint(i+32)));
  async function scan(path:string){
    for(const entry of await readdir(path,{withFileTypes:true})){
      if(entry.isSymbolicLink())throw new Error('UI font inputs must not be symbolic links');
      const file=join(path,entry.name);
      if(entry.isDirectory())await scan(file);
      else if(entry.isFile()&&['.astro','.ts','.js','.mjs','.css'].includes(extname(file)))for(const char of await readFile(file,'utf8'))chars.add(char);
    }
  }
  // Explicit renderer sources, not arbitrary repository/config/content trees.
  for(const dir of ['pages','components','layouts','ui','runtime','styles']){
    const path=join(root,'src',dir),entry=await lstat(path).catch(error=>{if(error.code==='ENOENT')return;throw error;});
    if(entry?.isSymbolicLink())throw new Error('UI font inputs must not be symbolic links');
    if(entry)await scan(path);
  }
  const config=join(root,'src/site.config.ts'),entry=await lstat(config).catch(error=>{if(error.code==='ENOENT')return;throw error;});
  if(entry?.isSymbolicLink())throw new Error('UI font inputs must not be symbolic links');
  if(entry)for(const c of await readFile(config,'utf8'))chars.add(c);
  return [...chars].filter(c=>c.codePointAt(0)!>=32).sort((a,b)=>a.codePointAt(0)!-b.codePointAt(0)!).join('');
}
export async function python(args:string[]){
  const executable=process.env.FONT_PYTHON||'uv';
  const prefix=process.env.FONT_PYTHON?[]:['run','--no-project','--with-requirements',join(projectRoot,'scripts/fonts/requirements.txt'),'python'];
  await new Promise<void>((done,fail)=>{
    const child=spawn(executable,[...prefix,...args],{cwd:projectRoot,stdio:'inherit'});
    child.on('error',fail);child.on('exit',code=>code===0?done():fail(new Error(`FontTools exited ${code}; install uv or set FONT_PYTHON to a Python with scripts/fonts/requirements.txt installed`)));
  });
}
let pending:Promise<void>|undefined;
export function ensureFonts(){return pending??=(async()=>{
  const chars=await collectUICharacters(),config=await readFile(join(projectRoot,'scripts/fonts/sources.json'),'utf8');
  const sources=JSON.parse(config),digests:string[]=[];
  for(const source of sources){const digest=hash(await readFile(join(projectRoot,'assets/fonts',source.file)));if(digest!==source.sha256)throw new Error(`Font source checksum mismatch: ${source.file}`);digests.push(digest);}
  const fingerprint=hash(JSON.stringify([chars,config,digests,await readFile(join(projectRoot,'scripts/fonts/subset.py'),'utf8'),await readFile(join(projectRoot,'scripts/fonts/requirements.txt'),'utf8')]));
  const manifest=await readFile(join(generated,'manifest.json'),'utf8').then(JSON.parse).catch(()=>undefined);
  if(manifest?.fingerprint===fingerprint){
    const outputs=[{file:'fonts.css',sha256:manifest.cssSha256},...manifest.fonts.flatMap((font:any)=>font.files)];
    const valid=await Promise.all(outputs.map(async(file:any)=>hash(await readFile(join(generated,file.file)).catch(()=>Buffer.alloc(0)))===file.sha256));
    if(valid.every(Boolean))return;
  }
  const work=join(projectRoot,`.astro/font-work-${process.pid}`);await mkdir(work,{recursive:true});
  try{
    await writeFile(join(work,'ui.txt'),chars);
    await python([join(projectRoot,'scripts/fonts/subset.py'),'build',work,fingerprint]);
    await mkdir(generated,{recursive:true});
    // All binaries are content-addressed. Publish CSS last; concurrent builds
    // cannot expose a font URL before its file exists. Stale files aren't emitted
    // by Vite because only the current CSS's assets participate in the build.
    const output=JSON.parse(await readFile(join(work,'manifest.json'),'utf8'));
    for(const name of [...output.fonts.flatMap((font:any)=>font.files.map((file:any)=>file.file)),'manifest.json']){
      await mkdir(dirname(join(generated,name)),{recursive:true});await rename(join(work,name),join(generated,name));
    }
    await rename(join(work,'fonts.css'),join(generated,'fonts.css'));
  }finally{await rm(work,{recursive:true,force:true});}
})().finally(()=>{pending=undefined;});}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await ensureFonts();
