import sharp from 'astro/assets/services/sharp';
import type {LocalImageService} from 'astro';
// For uncropped article images, resize by width alone. Passing a rounded height
// as a second Sharp bound can produce e.g. 399px for a 400w srcset descriptor.
// All decoding, orientation, resizing, encoding and caching remain Astro/Sharp.
export default {
  ...sharp,
  transform(input,options,config,logger){
    return sharp.transform(input,options.fit==='inside'&&options.width?{...options,height:undefined}:options,config,logger);
  },
} satisfies LocalImageService;
