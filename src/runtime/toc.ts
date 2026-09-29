import { transition, stop, durations } from "./motion";
export function visibleHeadingIndex(
  positions: (number | null)[],
  line: number,
  atBottom = false,
) {
  let next = positions.findIndex((y) => y !== null);
  positions.forEach((y, i) => {
    if (y !== null && (atBottom || y <= line)) next = i;
  });
  return next;
}
export function revealCalloutAncestors(target: Element | null) {
  let changed = false,
    parent: HTMLDetailsElement | null | undefined;
  while (
    (parent = target?.closest<HTMLDetailsElement>(
      "details.callout:not([open])",
    ))
  ) {
    parent.open = true;
    changed = true;
  }
  return changed;
}
// Visibility correction, not a time-based scroll animation. Never scroll the
// document or steal focus; Motion still owns the moving current-item marker.
export function revealWithin(
  container: Element | null,
  target: Element,
  padding = 8,
) {
  if (
    !container ||
    container.clientHeight <= 0 ||
    container.scrollHeight <= container.clientHeight
  )
    return;
  const top = container.getBoundingClientRect().top + container.clientTop,
    bottom = top + container.clientHeight,
    r = target.getBoundingClientRect();
  const delta =
    r.top < top + padding || r.height > container.clientHeight - padding * 2
      ? r.top - top - padding
      : r.bottom > bottom - padding
        ? r.bottom - bottom + padding
        : 0;
  const next = Math.max(
    0,
    Math.min(
      container.scrollHeight - container.clientHeight,
      container.scrollTop + delta,
    ),
  );
  if (next !== container.scrollTop) container.scrollTop = next;
}
export function initOnThisPage() {
  const prose = document.querySelector<HTMLElement>(".prose"),
    navs = [...document.querySelectorAll<HTMLElement>(".on-this-page")];
  if (!prose || !navs.length) return { update: () => {} };
  // The compiler's TOC is authoritative, including authored H1s. Scanning only
  // H2/H3 skipped all headings in about.md and shifted indices on mixed pages.
  const ids = [
    ...new Set(
      [...navs[0].querySelectorAll<HTMLAnchorElement>(".toc a")].map(
        (a) => a.dataset.heading!,
      ),
    ),
  ];
  const headings = ids.map((id) => {
    const h = document.getElementById(id);
    return h && prose.contains(h) ? h : null;
  });
  const indexes = new Map(ids.map((id, i) => [id, i]));
  let positions: (number | null)[] = [],
    active = -1,
    dirty = true,
    ticking = false;
  function measure() {
    positions = headings.map((h) =>
      h?.getClientRects().length
        ? h.getBoundingClientRect().top + scrollY
        : null,
    );
    dirty = false;
  }
  function update(force = false) {
    if (dirty) measure();
    const line = scrollY + Math.min(150, innerHeight * 0.22);
    // Ignore headings inside collapsed callouts, including the page-bottom fallback.
    const next = visibleHeadingIndex(
      positions,
      scrollY <= 1 ? -Infinity : line,
      scrollY > 1 &&
        scrollY + innerHeight >= document.documentElement.scrollHeight - 2,
    );
    if (!force && next === active) return;
    active = next;
    const target = headings[active]?.id;
    for (const nav of navs) {
      const links = [...nav.querySelectorAll<HTMLAnchorElement>(".toc a")];
      let selected: HTMLAnchorElement | undefined;
      links.forEach((a) => {
        const i = indexes.get(a.dataset.heading!);
        a.classList.toggle(
          "is-read",
          i !== undefined && i < active && positions[i] !== null,
        );
        if (a.dataset.heading === target) {
          a.setAttribute("aria-current", "location");
          selected = a;
        } else a.removeAttribute("aria-current");
      });
      const marker = nav.querySelector<HTMLElement>(".toc-marker")!,
        track = nav.querySelector<HTMLElement>(".toc-track")!;
      if (!selected) {
        marker.hidden = true;
        continue;
      }
      if (!nav.getBoundingClientRect().width) continue;
      if (
        !nav.contains(document.activeElement) ||
        document.activeElement === selected
      ) {
        revealWithin(nav.querySelector(".toc-scroll"), selected);
        const dialog = nav.closest(".outline-dialog");
        // On the homepage's initial top position, keep recent activity and the
        // graph visible instead of immediately scrolling the whole rail to TOC.
        if (scrollY > 1 || dialog)
          revealWithin(dialog || nav.closest(".sidebar"), selected);
      }
      const y =
        selected.getBoundingClientRect().top -
        track.getBoundingClientRect().top;
      const from = marker.hidden
        ? `translateY(${y}px)`
        : getComputedStyle(marker).transform;
      stop(marker);
      marker.hidden = false;
      marker.style.height = `${selected.offsetHeight}px`;
      marker.style.transform = `translateY(${y}px)`;
      if (!force)
        transition(
          marker,
          { transform: [from, `translateY(${y}px)`] },
          durations.toc,
        );
    }
  }
  const schedule = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
      ticking = true;
    }
  };
  function revealHash(hash: string, scroll = false) {
    let target: HTMLElement | null;
    try {
      target = document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      return;
    }
    if (target && prose!.contains(target) && revealCalloutAncestors(target)) {
      dirty = true;
      if (scroll) target.scrollIntoView({ block: "start" });
      schedule();
    }
  }
  document.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
    if (link) revealHash(link.getAttribute("href")!);
  });
  addEventListener("hashchange", () => revealHash(location.hash, true));
  prose.addEventListener(
    "toggle",
    () => {
      dirty = true;
      update(true);
    },
    true,
  );
  revealHash(location.hash, true);
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", () => {
    dirty = true;
    update(true);
  });
  const observer = new ResizeObserver(() => {
    dirty = true;
    update(true);
  });
  observer.observe(prose);
  document.fonts.ready.then(() => {
    dirty = true;
    update(true);
  });
  update(true);
  return { update: () => update(true) };
}
