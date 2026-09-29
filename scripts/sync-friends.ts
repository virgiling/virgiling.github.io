import {getSnapshot} from '../src/content/snapshot';
import {parseFriendLinks} from '../src/friends/markdown';
import {friendSnapshot} from '../src/friends/snapshot';
const note=(await getSnapshot()).listed.find(note=>note.source==='link.md');
const friends=note?parseFriendLinks(note.html).friends:[];
const results=await friendSnapshot(friends,true);
console.log(JSON.stringify({friends:friends.length,feeds:results.map(result=>({status:result.status,posts:result.posts.length}))},null,2));
