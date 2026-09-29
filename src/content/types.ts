import type { Root } from 'mdast';
export interface Heading {id:string; text:string; depth:number; trail:string[]}
export interface Note {
  id:string; slug:string; source:string; route:string; url:string;
  title:string; aliases:string[]; tags:string[]; publish:true; unlisted:boolean;
  kind:'landing'|'directory'|'article'; isDirectoryIndex:boolean;
  date:string; updated:string; description:string; summary:string; comments:boolean;
  reviewed:string; reviewAfter:string; staleAfter?:number; stale?:boolean;
  body:string; tree:Root; headings:Heading[]; blocks:Map<string,number>;
  links:string[]; html:string; plainText:string; readingText:string;
}
export interface Diagnostic {source:string; code:string; message:string}
export interface Asset {source:string; output:string; url:string}
export interface DirectoryMeta {
  path:string; title:string;
  moc?:{source:string;url:string;title:string};
}
export interface Snapshot {
  notes:Note[]; listed:Note[]; directories:DirectoryMeta[];
  assets:Asset[]; diagnostics:Diagnostic[]; contentCommit:string;
}
