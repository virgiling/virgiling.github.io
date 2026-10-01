import { transition, stop, durations } from "./motion";
import { initStacks } from "./stacks";
import { initSearch } from "./search";
import { initOnThisPage } from "./toc";
import { initGraph } from "./graph";
import { initLocalGraphs } from "./local-graph";
import { initInteractionMotion } from "./interactions";
import { initCardMotion } from "./card-motion";
import { initImageZoom } from "./image-zoom";
import { initNavigationMotion } from "./navigation-motion";
import { initNotePreview, type PreviewRecord } from "./preview";
const $ = <T extends Element = HTMLElement>(s: string) =>
    document.querySelector<T>(s)!,
  $$ = <T extends Element = HTMLElement>(s: string) => [
    ...document.querySelectorAll<T>(s),
  ];
initStacks();
initInteractionMotion();
initNavigationMotion();
const toc = initOnThisPage();
let imageZoom = initImageZoom(),
  localGraphs = initLocalGraphs(),
  cardMotion = initCardMotion();
addEventListener("pagehide", () => {
  imageZoom.destroy();
  localGraphs.destroy();
  cardMotion.destroy();
});
addEventListener("pageshow", (event) => {
  if (event.persisted) {
    imageZoom = initImageZoom();
    localGraphs = initLocalGraphs();
    cardMotion = initCardMotion();
  }
});

const previewRecords: PreviewRecord[] = JSON.parse(
  $("#preview-data")?.textContent || "[]",
);
const preview = initNotePreview({ records: previewRecords });
const hidePreview = () => preview.hide();

const outline = $<HTMLDialogElement>("#outline-dialog");
const graph = initGraph({
  beforeOpen: () => {
    hidePreview();
    if (outline?.open) outline.close();
  },
});
initSearch({
  beforeOpen: () => {
    hidePreview();
    graph.close({ restoreFocus: false });
    if (outline?.open) outline.close();
  },
});
if (outline) {
  $("#open-outline").addEventListener("click", () => {
    hidePreview();
    graph.close({ restoreFocus: false });
    outline.showModal();
    toc.update();
    transition(outline, { opacity: [0, 1] }, durations.popover);
  });
  $("#close-outline").addEventListener("click", () => outline.close());
  $$("#outline-dialog a").forEach((a) =>
    a.addEventListener("click", () => outline.close()),
  );
  outline.addEventListener("close", () => stop(outline));
  outline.addEventListener("click", (e) => {
    if (e.target === outline) {
      const r = outline.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        outline.close();
    }
  });
}
let ticking = false;
const progress = $(".reading-progress");
function onScroll() {
  void preview.position();
  if (progress) {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  }
}
addEventListener(
  "scroll",
  () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  },
  { passive: true },
);
onScroll();
