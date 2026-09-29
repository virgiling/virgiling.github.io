import {getResources} from '../../content/resources';
export async function getStaticPaths(){return Object.values(await getResources()).map(resource=>({params:{file:resource.file},props:{body:resource.body}}));}
export function GET({props}){return new Response(props.body,{headers:{'Content-Type':'application/json; charset=utf-8'}});}
