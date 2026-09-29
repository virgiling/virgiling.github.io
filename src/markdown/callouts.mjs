import {toHtml} from 'hast-util-to-html';
// Site usage groups, not extra OFM types. Canonical types and aliases follow Obsidian Help.
export const calloutGroups=[
  {id:'information',label:'记录与说明',types:{note:[],abstract:['summary','tldr'],info:[]}},
  {id:'guidance',label:'提示与重点',types:{tip:['hint','important']}},
  {id:'progress',label:'任务与进展',types:{todo:[],success:['check','done']}},
  {id:'questions',label:'问题与提醒',types:{question:['help','faq'],warning:['caution','attention']}},
  {id:'risks',label:'错误与风险',types:{failure:['fail','missing'],danger:['error'],bug:[]}},
  {id:'references',label:'示例与引用',types:{example:[],quote:['cite']}},
];
export const calloutAliases=Object.fromEntries(calloutGroups.flatMap(({types})=>Object.entries(types).flatMap(([kind,aliases])=>[kind,...aliases].map(type=>[type,kind]))));
const element=(tagName,properties={},children=[])=>({type:'element',tagName,properties,children});
export const calloutText=value=>({type:'text',value});
const path=d=>element('path',{d}),circle=()=>element('circle',{cx:12,cy:12,r:9});
// Small geometric line icons authored for this site; no Baseline/SF Symbols assets.
function icon(kind){
  const shapes={
    note:[path('m5 15 10-10 4 4-10 10-5 1z M13 7l4 4')],
    abstract:[element('rect',{x:5,y:4,width:14,height:17,rx:2}),path('M9 3h6v4H9z M9 11h6 M9 15h6')],
    info:[circle(),path('M12 10v7 M12 7h.01')],todo:[circle(),path('m7 12 3 3 7-7')],
    tip:[path('M8 15a6 6 0 1 1 8 0l-1 3H9z M9 21h6')],
    success:[path('m4 12 5 5L20 6')],question:[circle(),path('M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17h.01')],
    warning:[path('m12 3 10 18H2z M12 9v5 M12 17h.01')],failure:[path('m6 6 12 12 M18 6 6 18')],
    danger:[path('m14 2-9 12h6l-1 8 9-12h-6z')],
    bug:[element('rect',{x:7,y:7,width:10,height:13,rx:5}),path('M9 7V4h6v3 M3 9l4 2 M21 9l-4 2 M3 15h4 M21 15h-4 M5 22l3-4 M19 22l-3-4 M12 8v12')],
    example:[path('M4 6h2 M9 6h11 M4 12h2 M9 12h11 M4 18h2 M9 18h11')],
    quote:[path('M4 6h6v7H6c0 3-1 4-3 5 M14 6h6v7h-4c0 3-1 4-3 5')],
  };
  return element('span',{className:['callout-icon'],ariaHidden:'true'},[element('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round',focusable:'false'},shapes[kind])]);
}
export function calloutNode({type='note',title=[],body=[],fold,classes=[],ariaLabel}){
  type=typeof type==='string'&&/^[\w-]+$/.test(type)?type.toLowerCase():'note';const kind=Object.hasOwn(calloutAliases,type)?calloutAliases[type]:'note';
  if(!title.some(n=>n.type!=='text'||n.value.trim()))title=[calloutText(type[0].toUpperCase()+type.slice(1))];
  body=body.filter(n=>n.type!=='text'||n.value.trim());
  const props={className:['callout',...classes],dataCallout:type,dataCalloutKind:kind};
  if(fold==='+')props.open=true;if(ariaLabel)props.ariaLabel=ariaLabel;
  const header=element(fold?'summary':'div',{className:['callout-title']},[icon(kind),element('span',{className:['callout-title-inner']},title),...(fold?[element('span',{className:['callout-fold'],ariaHidden:'true'},[calloutText('›')])]:[])]);
  return element(fold?'details':'aside',props,[header,element('div',{className:['callout-content']},body)]);
}
export const calloutHTML=options=>toHtml(calloutNode(options));
function splitLine(nodes){
  const before=[],after=[];let found=false;
  for(const node of nodes){
    if(found){after.push(node);continue;}
    if(node.type==='text'){
      const match=/\r?\n/.exec(node.value);
      if(match){if(match.index)before.push({...node,value:node.value.slice(0,match.index)});if(node.value.slice(match.index+match[0].length))after.push({...node,value:node.value.slice(match.index+match[0].length)});found=true;}else before.push(node);
    }else if(node.tagName==='br'){found=true;}
    else if(node.children?.length){const part=splitLine(node.children);if(part.before.length)before.push({...node,children:part.before});if(part.after.length)after.push({...node,children:part.after});found=part.found;}
    else before.push(node);
  }
  return {before,after,found};
}
const hasClass=(node,name)=>(node.properties?.className||[]).includes(name);
// Recognize the raw first-line token before Markdown emphasis consumes underscores.
// Escaped/code-formatted markers are intentionally not marked as OFM callouts.
export function remarkCallouts({source}){
  return tree=>{
    function walk(node){
      if(node.type==='blockquote'){
        const first=node.children[0],start=first?.position?.start;
        const match=first?.type==='paragraph'&&start&&/^\[!([\w-]+)\]([+-])?[ \t]*/.exec(source.slice(start.offset));
        if(match){
          const end={...start,offset:start.offset+match[0].length,column:start.column+match[0].length};
          const rest=first.children.filter(n=>n.position.end.offset>end.offset).map(n=>n.type==='text'&&n.position.start.offset<end.offset?{...n,value:n.value.slice(end.offset-n.position.start.offset),position:{...n.position,start:end}}:n);
          first.children=[{type:'text',value:match[0],position:{start,end}},...rest];
          node.data={...node.data,hProperties:{...node.data?.hProperties,dataCalloutMarker:'1'}};
        }
      }
      node.children?.forEach(walk);
    }
    walk(tree);
  };
}
// Run AFTER sanitization: input nodes are safe; only our fixed icons/structure are added.
export function rehypeCallouts(){
  return tree=>{
    function walk(node){
      if(node.type==='element'&&node.tagName==='blockquote'){
        const firstIndex=node.children.findIndex(n=>n.type!=='text'||n.value.trim()),first=node.children[firstIndex],text=first?.children?.[0];
        const match=first?.tagName==='p'&&text?.type==='text'&&/^\[!([\w-]+)\]([+-])?[ \t]*/.exec(text.value);
        if(match&&node.properties.dataCalloutMarker==='1'){
          const split=splitLine([{...text,value:text.value.slice(match[0].length)},...first.children.slice(1)]);
          const body=[...(split.after.some(n=>n.type!=='text'||n.value.trim())?[element('p',{},split.after)]:[]),...node.children.slice(firstIndex+1)];
          Object.assign(node,calloutNode({type:match[1],fold:match[2],title:split.before,body}));
        }
      }else if(node.type==='element'&&['aside','details'].includes(node.tagName)&&hasClass(node,'callout')){
        const children=node.children.filter(n=>n.type!=='text'||n.value.trim()),first=children[0];
        const hasTitle=first&&(hasClass(first,'callout-title')||first.tagName==='summary'||first.tagName==='strong');
        const content=children.find(n=>hasClass(n,'callout-content'));
        Object.assign(node,calloutNode({type:node.properties.dataCallout||'note',title:hasTitle?(first.children.find(n=>hasClass(n,'callout-title-inner'))?.children||first.children):[],body:content?.children||(hasTitle?children.slice(1):children),fold:node.tagName==='details'?(node.properties.open?'+':'-'):undefined,classes:node.properties.className.filter(c=>!['callout','foldable'].includes(c)),ariaLabel:node.properties.ariaLabel}));
      }
      node.children?.forEach(walk);
    }
    walk(tree);
  };
}
