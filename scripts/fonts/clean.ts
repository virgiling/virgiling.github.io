// Explicit maintenance only: never prune generations during dev/build, where
// in-flight pages can still reference old immutable font URLs.
import assert from 'node:assert/strict';
import {readdir,readFile,lstat,unlink,rmdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ensureFonts,generated} from './subset-ui-font';
const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
export async function cleanFonts(root=generated){
  assert.ok(!(await lstat(root)).isSymbolicLink(),'Generated font root must not be a symlink');
  const files=new Map<string,number>(),directories:string[]=[];
  async function walk(directory=''){
    for(const entry of await readdir(join(root,directory),{withFileTypes:true})){
      const path=join(directory,entry.name);assert.ok(!entry.isSymbolicLink(),'Generated fonts must not contain symlinks');
      if(entry.isDirectory()){await walk(path);directories.push(path);}
      else{assert.ok(entry.isFile(),'Unexpected generated font entry');files.set(path,(await lstat(join(root,path))).size);}
    }
  }
  await walk();
  const original=await readFile(join(root,'manifest.json'),'utf8'),css=await readFile(join(root,'fonts.css'),'utf8');
  const manifest=JSON.parse(original),keep=new Set<string>(['manifest.json','fonts.css']);
  assert.equal(hash(css),manifest.cssSha256,'Font CSS checksum mismatch; regenerate before cleaning');
  for(const font of manifest.fonts)for(const file of font.files){
    assert.match(file.file,/^[a-f0-9]{16}\/[\w-]+\.woff2$/,'Invalid generated font path');
    assert.equal(hash(await readFile(join(root,file.file))),file.sha256,'Font checksum mismatch; regenerate before cleaning');
    keep.add(file.file);
  }
  assert.ok(keep.size>2,'No fonts in manifest');
  const urls=new Set([...css.matchAll(/url\("\.\/([^"\n]+)"\)/g)].map(match=>match[1]));
  assert.deepEqual(urls,new Set([...keep].filter(file=>file.endsWith('.woff2'))),'CSS and manifest must reference the same fonts');
  const unused=[...files.keys()].filter(file=>!keep.has(file));
  // Refuse a manifest/CSS switch observed during inspection. Run this explicit
  // command after font preparation has finished, not alongside another writer.
  assert.equal(await readFile(join(root,'manifest.json'),'utf8'),original,'Fonts changed during cleanup');
  assert.equal(await readFile(join(root,'fonts.css'),'utf8'),css,'Font CSS changed during cleanup');
  for(const file of unused)await unlink(join(root,file));
  for(const directory of directories)try{await rmdir(join(root,directory));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOTEMPTY')throw error;}
  return {removedFiles:unused.length,removedBytes:unused.reduce((sum,file)=>sum+files.get(file)!,0),keptFiles:keep.size,keptBytes:[...keep].reduce((sum,file)=>sum+files.get(file)!,0)};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){await ensureFonts();console.log(JSON.stringify(await cleanFonts(),null,2));}
