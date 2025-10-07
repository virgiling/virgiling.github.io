/// Reference: https://github.com/jackyzha0/quartz/pull/2074
import { QuartzTransformerPlugin } from "../types"

// ViewImage.js
export const ViewImage: QuartzTransformerPlugin = () => {
  return {
    name: "ViewImage",
    externalResources() {
      return {
        js: [
          {
            src: "https://cdn.jsdelivr.net/gh/Tokinx/ViewImage/view-image.min.js",
            loadTime: "afterDOMReady",
            contentType: "external",
          },
          {
            script: `
              document.addEventListener('DOMContentLoaded', function() {
                if (window.ViewImage) {
                  ViewImage.init('article img, .content img');
                  const style = document.createElement('style');
                  style.textContent = 'article img, .content img { cursor: zoom-in; border: 2px dashed #284b63; }';
                  document.head.appendChild(style);
                }
              });
            `,
            loadTime: "afterDOMReady",
            contentType: "inline",
          },
        ],
      }
    },
  }
}

// 告诉TypeScript我们添加的内容
declare module "vfile" {
  interface DataMap {
    viewImage?: boolean
  }
}
