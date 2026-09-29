import {getSnapshot} from '../src/content/snapshot';
import {writeFile} from 'node:fs/promises';
const s=await getSnapshot();
const diagnostics=[...new Map(s.diagnostics.map(d=>[JSON.stringify(d),d])).values()];
const report={contentCommit:s.contentCommit,pages:s.notes.length,discoverable:s.listed.length,unlisted:s.notes.length-s.listed.length,directoryGuides:s.notes.filter(n=>n.isDirectoryIndex).length,directoryTitles:s.directories.length,assets:s.assets.length,aliases:s.notes.reduce((sum,n)=>sum+n.aliases.length,0),diagnostics};
await writeFile('.astro/content-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
