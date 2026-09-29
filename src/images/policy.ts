// Only public image hosts already used by published notes. Never a generic URL proxy.
export const imageHosts=['virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com','s2.loli.net'];
export const remotePatterns=imageHosts.map(hostname=>({protocol:'https' as const,hostname,pathname:'/**'}));
export function allowedImageURL(value:string) {
  try{const u=new URL(value);return u.protocol==='https:'&&imageHosts.includes(u.hostname)&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/\.(?:png|jpe?g|webp|avif)$/i.test(u.pathname);}catch{return false;}
}
export const readingWidth=905; // Widest current reading column: 1260 - 270 - 85.
export function imageSizes(width:number) {
  return `(max-width: 560px) min(${width}px, calc(100vw - 36px)), (max-width: 800px) min(${width}px, calc(100vw - 52px)), (max-width: 1050px) min(${width}px, calc(100vw - 307px)), (max-width: 1440px) min(${width}px, 844px, calc(100vw - 416px)), ${width}px`;
}
