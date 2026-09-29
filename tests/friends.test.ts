import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFriendLinks} from '../src/friends/markdown';
import {parseFeed,syncFriendFeeds,circlePosts,friendKey} from '../src/friends/feeds';
import {publicURL} from '../src/friends/urls';
import {parseFeedCache} from '../src/friends/cache';
import {publicAddress,readPublicText} from '../src/friends/network';
import {renderComponent} from './helpers/render-astro';
import type {Friend} from '../src/friends/markdown';
import type {FriendPost,FeedResult} from '../src/friends/feeds';
const FriendCards=(friends:Friend[])=>renderComponent('FriendCards',{friends});
const FriendCircle=(posts:FriendPost[],results:FeedResult[])=>renderComponent('FriendCircle',{posts,results});
import {parseHTML} from 'linkedom';
import {navigation,url} from '../src/site.config';
const friend={name:'Ada',url:'https://ada.example.com/',bio:'A friend',rss:'https://ada.example.com/rss.xml'};
const rss=(items:string)=>`<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><link>https://ada.example.com/</link>${items}</channel></rss>`;
const item=(title='New post',link='/post',date='2026-01-02')=>`<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate></item>`;
const now=Date.parse('2026-09-01');

test('ordinary Markdown-rendered tables support old and extended friend fields without swallowing other content',async()=>{
  const html='<p>Intro stays</p><table><tr><th>简介</th><th>链接</th><th>头像</th><th>RSS</th></tr><tr><td>Compiler researcher</td><td><a href="https://ada.example.com/">Ada</a></td><td><img src="https://ada.example.com/avatar.png"></td><td><a href="https://ada.example.com/rss.xml">RSS</a></td></tr><tr><td>No feed</td><td><a href="https://no.example.com/">No</a></td><td></td><td>-</td></tr></table><table><tr><th>Unrelated</th></tr></table>';
  const parsed=parseFriendLinks(html);assert.equal(parsed.friends.length,2);assert.match(parsed.html,/Intro stays/);assert.match(parsed.html,/Unrelated/);assert.doesNotMatch(parsed.html,/Compiler researcher/);
  assert.equal(parsed.friends[0].avatar,'https://ada.example.com/avatar.png');assert.equal(parsed.friends[0].rss,friend.rss);assert.equal(parsed.friends[1].rss,null);assert.equal(parsed.friends[1].avatar,undefined);
  const old=parseFriendLinks('<table><tr><th>简介</th><th>链接</th></tr><tr><td>Bio</td><td><a href="https://ada.example.com/">Ada</a></td></tr><tr><td>Duplicate</td><td><a href="https://ada.example.com/">Ada</a></td></tr></table>');assert.equal(old.friends.length,1);assert.equal(old.friends[0].rss,undefined);assert.equal(old.friends[0].avatar,undefined);
  assert.match(await FriendCards(parsed.friends),/friend-card/);assert.doesNotMatch(await FriendCards([{...friend,name:'<script>alert(1)</script>'}]),/<script>/);
  const cards=parseHTML(`<html><body>${await FriendCards(parsed.friends)}</body></html>`).document;
  assert.equal(cards.querySelector('.friend-avatar img')!.getAttribute('src'),'https://ada.example.com/avatar.png');assert.equal(cards.querySelector('.friend-bio')!.textContent,'Compiler researcher');
});

test('friend cards have no extra headings and recent posts read author-title-date in one row',async()=>{
  const post={author:'A very long author <name>',authorUrl:friend.url,title:'A long title with "quotes" & details',url:friend.url+'post',date:'2026-08-03T12:00:00.000Z'};
  const {document}=parseHTML(`<html><body>${await FriendCards([friend])}${await FriendCircle([post],[])}</body></html>`);
  const headings=[...document.querySelectorAll('h1,h2,h3')];assert.equal(headings.length,1);assert.equal(headings[0].tagName,'H1');assert.equal(headings[0].textContent,'近况');
  assert.equal(document.querySelector('#friend-links')!.getAttribute('aria-label'),'友链');
  const row=document.querySelector('.friend-posts li')!;
  assert.deepEqual([...row.children].map(child=>child.tagName),['SPAN','TIME']);
  const summary=row.querySelector('.friend-post-summary')!,author=summary.querySelector('.friend-post-author')!,title=summary.querySelector('.friend-post-title')!;
  assert.deepEqual([...summary.children].map(child=>child.className),['friend-post-author','friend-post-separator','friend-post-title']);
  assert.equal(author.textContent,post.author);assert.equal(title.textContent,post.title);assert.equal(title.getAttribute('title'),post.title);
  assert.equal(author.getAttribute('href'),post.authorUrl);assert.equal(title.getAttribute('href'),post.url);
  assert.equal(row.querySelector('time')!.textContent,'2026-08-03');assert.equal(row.querySelector('time')!.getAttribute('datetime'),post.date);
  assert.equal(navigation.find(item=>item.url===url('link'))!.label,'友链');
  const empty=parseHTML(`<html><body>${await FriendCircle([],[])}</body></html>`).document;
  assert.equal(empty.querySelectorAll('h1').length,1);assert.equal(empty.querySelector('h1')!.textContent,'近况');
});

test('RSS and Atom normalize dates, titles and URLs, drop unsafe/undated/future entries and deduplicate',async()=>{
  const posts=await parseFeed(rss(item()+item('Duplicate')+item('Unsafe','javascript:alert(1)')+item('Future','/future','2099-01-01')+item('Undated','/none','bad')),friend.rss,friend,now);
  assert.equal(posts.length,1);assert.equal(posts[0].url,'https://ada.example.com/post');assert.equal(posts[0].date,'2026-01-02T00:00:00.000Z');
  const atom='<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title><entry><title>Atom &amp; notes</title><link href="/atom-post"/><updated>2026-08-03T12:00:00Z</updated><id>1</id></entry></feed>';
  const entries=await parseFeed(atom,friend.rss,friend,now);assert.equal(entries[0].title,'Atom & notes');assert.equal(entries[0].url,'https://ada.example.com/atom-post');
  await assert.rejects(parseFeed('<!DOCTYPE rss [<!ENTITY x "bad">]>'+rss(item()),friend.rss,friend,now),/declarations/);
  await assert.rejects(parseFeed('not XML',friend.rss,friend,now));
});

test('the friend circle displays at most ten newest unique posts across all feeds',async()=>{
  const posts=Array.from({length:18},(_,i)=>({title:`Post ${i}`,url:`https://ada.example.com/post-${i}`,date:new Date(now-i*86400000).toISOString(),author:friend.name,authorUrl:friend.url}));
  const results=[
    {key:'a',checkedAt:new Date(now).toISOString(),status:'ok' as const,posts:posts.filter((_,i)=>i%2===0).reverse()},
    {key:'b',checkedAt:new Date(now).toISOString(),status:'ok' as const,posts:[posts[0],posts[2],...posts.filter((_,i)=>i%2===1).reverse()]},
  ];
  const shown=circlePosts(results);assert.deepEqual(shown.map(post=>post.url),posts.slice(0,10).map(post=>post.url));
  const {document}=parseHTML(`<html><body>${await FriendCircle(shown,results)}</body></html>`);
  assert.equal(document.querySelectorAll('.friend-posts li').length,10);
  assert.equal(circlePosts([{...results[0],posts:posts.slice(0,3)}]).length,3);assert.deepEqual(circlePosts([]),[]);
});

test('only explicitly configured feeds are requested and failure keeps their own prior results',async()=>{
  const reads:string[]=[];
  const read=async(url:string)=>{reads.push(url);assert.equal(url,friend.rss,'never request the homepage or guessed paths');return {url,text:rss(item())};};
  const first=await syncFriendFeeds([friend],[],read,now);assert.equal(first[0].status,'ok');assert.deepEqual(reads,[friend.rss]);
  const stale=await syncFriendFeeds([friend],first,async()=>{throw new Error('offline');},now+1000);assert.equal(stale[0].status,'stale');assert.deepEqual(stale[0].posts,first[0].posts);assert.equal(stale[0].updatedAt,first[0].updatedAt);
  const changed=await syncFriendFeeds([{...friend,rss:'https://ada.example.com/other.xml'}],first,async()=>{throw new Error('offline');},now+1000);assert.equal(changed[0].status,'unavailable');assert.deepEqual(changed[0].posts,[]);
  const other={...first[0],posts:[{...first[0].posts[0],date:'2025-01-01T00:00:00Z'}]};assert.equal(circlePosts([first[0],other])[0].date,first[0].posts[0].date);
  assert.match(await FriendCircle(circlePosts(stale),stale),/保留上次结果/);assert.match(await FriendCircle([],[]),/暂时没有可读取的更新/);
});

test('personal introductions stay authored; missing or blank avatar/RSS fields mean no network and text avatars',async()=>{
  const person=parseFriendLinks('<table><tr><th>昵称</th><th>个人简介</th><th>链接</th><th>头像</th><th>RSS</th></tr><tr><td>阿达</td><td>编译器研究员，喜欢徒步。</td><td><a href="https://ada.example.com/">个人主页</a></td><td> </td><td> </td></tr></table>').friends[0];
  assert.equal(person.name,'阿达');assert.equal(person.bio,'编译器研究员，喜欢徒步。');assert.equal(person.avatar,undefined);assert.equal(person.rss,undefined);
  const {document}=parseHTML(`<html><body>${await FriendCards([person])}</body></html>`);
  assert.equal(document.querySelector('.friend-bio')!.textContent,person.bio);assert.equal(document.querySelector('.friend-avatar')!.textContent,'阿');assert.equal(document.querySelector('img'),null);
  const old=parseFriendLinks('<table><tr><th>简介</th><th>链接</th></tr><tr><td>Researcher</td><td><a href="https://ada.example.com/">Ada</a></td></tr></table>').friends[0];
  let reads=0;
  const legacyPosts=await parseFeed(rss(item()),friend.rss,friend,now);
  const previous=[{key:JSON.stringify([friend.url,'auto']),checkedAt:new Date(now).toISOString(),status:'ok' as const,posts:legacyPosts}];
  const results=await syncFriendFeeds([old,person,...[undefined,null,'','   '].map(rss=>({...friend,rss}))],previous,async()=>{reads++;throw new Error('unexpected network');},now);
  assert.equal(reads,0);assert.ok(results.every(result=>result.status==='disabled'&&result.posts.length===0));
});

test('old auto-discovered snapshots cannot revive an omitted feed, while configured caches remain usable',async()=>{
  const result={key:JSON.stringify([friend.url,'auto']),checkedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),status:'ok',posts:await parseFeed(rss(item()),friend.rss,friend,now)};
  const source=JSON.stringify({version:1,savedAt:new Date(now).toISOString(),results:[result]});
  assert.equal(parseFeedCache(source,[friendKey({...friend,rss:undefined})]),undefined);
  const explicit=JSON.stringify({version:1,savedAt:new Date(now).toISOString(),results:[{...result,key:friendKey(friend)}]});
  assert.ok(parseFeedCache(explicit,[friendKey(friend)]));assert.equal(parseFeedCache(explicit,[friendKey({...friend,rss:undefined})]),undefined);
});

test('corrupt or unsafe cached feed records are discarded instead of breaking rendering',()=>{
  for(const source of ['not JSON','{"version":1,"results":[{}]}',JSON.stringify({version:1,savedAt:new Date(now).toISOString(),results:[{key:'a',checkedAt:new Date(now).toISOString(),status:'ok',posts:[{title:'bad',url:'javascript:alert(1)',date:new Date(now).toISOString(),author:'A',authorUrl:friend.url}]}]})])assert.equal(parseFeedCache(source),undefined);
});

test('RSS transport refuses local URLs, credentials and non-public DNS results',async()=>{
  for(const url of ['http://example.com/','https://localhost/','https://127.0.0.1/rss','https://[::1]/rss','https://user:pass@example.com/rss','https://example.com:8443/rss','https://home.local/rss']){
    assert.equal(publicURL(url),undefined,url);await assert.rejects(readPublicText(url));
  }
  assert.equal(publicURL('',friend.url),undefined);
  for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','::1','fe80::1','fc00::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
  assert.equal(publicAddress('1.1.1.1'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
});
