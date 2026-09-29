import { transition, stop, durations } from "./motion.js";

export function initSearch({ prefix, beforeOpen }) {
  const search = document.querySelector("#search-dialog"),
    input = document.querySelector("#search-input"),
    results = document.querySelector("#search-results"),
    count = document.querySelector("#search-count");
  let worker,
    request = 0,
    epoch = 0,
    closing = false;
  function requestQuery() {
    if (!worker) {
      worker = new Worker(new URL("./search.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = ({ data }) => {
        if (data.id !== request || !search.open) return;
        if (data.error) count.textContent = data.error;
        else renderResults(data.records);
      };
      worker.onerror = () => {
        count.textContent = "搜索暂时不可用，请重新打开重试。";
        worker.terminate();
        worker = undefined;
      };
    }
    count.textContent = "加载中…";
    worker.postMessage({
      id: ++request,
      url: new URL(document.body.dataset.searchIndex, location.href).href,
      query: input.value,
    });
  }
  function renderResults(found) {
    results.replaceChildren();
    count.textContent = `${found.length} 条结果`;
    for (const record of found) {
      const li = document.createElement("li"),
        a = document.createElement("a"),
        icon = document.createElement("span"),
        copy = document.createElement("span"),
        title = document.createElement("span"),
        small = document.createElement("small");
      a.href = record.url;
      icon.className = "result-icon";
      icon.textContent = "▤";
      icon.setAttribute("aria-hidden", "true");
      copy.className = "result-copy";
      title.className = "result-title";
      title.textContent = record.title;
      small.textContent = record.summary;
      copy.append(title, small);
      a.append(icon, copy);
      li.append(a);
      results.append(li);
    }
    if (!found.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "没有找到相关内容。";
      results.append(li);
    }
    transition(
      results,
      { opacity: [0.7, 1], transform: ["translateY(3px)", "none"] },
      durations.results,
    );
  }
  async function open(query = "") {
    beforeOpen();
    epoch++;
    closing = false;
    stop(search);
    if (!search.open) search.showModal();
    transition(
      search,
      { opacity: [0, 1], transform: ["translateY(-12px) scale(.965)", "none"] },
      durations.spotlightIn,
    );
    input.value = typeof query === "string" ? query : "";
    input.focus();
    requestQuery();
  }
  async function close() {
    if (!search.open || closing) return;
    closing = true;
    const token = ++epoch;
    const style = getComputedStyle(search),
      start = { opacity: style.opacity, transform: style.transform };
    await transition(
      search,
      {
        opacity: [Number(start.opacity), 0],
        transform: [start.transform, "translateY(-8px) scale(.975)"],
      },
      durations.spotlightOut,
    );
    if (epoch === token) {
      search.close();
      closing = false;
    }
  }
  search.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  search.addEventListener("close", () => {
    stop(search);
    stop(results);
    closing = false;
  });
  document.querySelector("#open-search").addEventListener("click", open);
  document.querySelector("#close-search").addEventListener("click", close);
  input.addEventListener("input", requestQuery);
  search.addEventListener("click", (e) => {
    if (e.target === search) {
      const r = search.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        close();
    }
  });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    const links = [...results.querySelectorAll("a")],
      i = links.indexOf(document.activeElement);
    if (e.key === "ArrowDown" && links.length) {
      e.preventDefault();
      links[(i + 1) % links.length].focus();
    }
    if (e.key === "ArrowUp" && links.length) {
      e.preventDefault();
      links[i <= 0 ? links.length - 1 : i - 1].focus();
    }
    if (e.key === "Enter" && document.activeElement === input && links.length) {
      e.preventDefault();
      links[0].click();
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      search.open && !closing ? close() : open();
    }
  });
  const tag = new URLSearchParams(location.search).get("tag");
  if (tag) open("#" + tag);
  return { open, close };
}
