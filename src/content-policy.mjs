import {posix} from 'node:path';
// Classification is not publication permission. Base definitions enter their own
// compiler; neither they nor arbitrary attachments are copied wholesale to dist.
export const contentPolicy={
  ignoredDirectories:['.git','.obsidian','.claudian','private','templates','10-daily','05-project','30-tasks','00-copilot','Excalidraw'],
  ignoredExtensions:['.canvas','.bib','.csl'],
};
export function classifyContentPath(path){
  const normalized=path.replaceAll('\\','/'),parts=normalized.split('/');
  if(normalized.startsWith('/')||/^[a-z]:/i.test(normalized)||parts.some(p=>p==='..'||p==='.'||p===''))throw new Error('Content path must be relative and normalized');
  if(parts.some(p=>contentPolicy.ignoredDirectories.includes(p)))return 'ignored';
  const extension=posix.extname(normalized).toLowerCase();
  if(contentPolicy.ignoredExtensions.includes(extension))return 'ignored';
  if(extension==='.base')return 'base';
  if(extension==='.md')return 'markdown';
  return 'asset';
}
