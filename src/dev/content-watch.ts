import { relative, resolve } from "node:path";
import { classifyContentPath } from "../content-policy";

export function watchedContentPath(file: string, root = resolve("content")) {
  const path = relative(root, resolve(file)).replaceAll("\\", "/");
  if (
    !path ||
    path.startsWith("../") ||
    path
      .split("/")
      .some(
        (p) =>
          p.startsWith(".") ||
          /(?:^|[._-])(?:credentials?|secrets?|tokens?|passwords?)(?:[._-]|$)/i.test(
            p,
          ),
      )
  )
    return false;
  return classifyContentPath(path) !== "ignored";
}
export function registerContentWatcher(server: any, root = resolve("content")) {
  server.watcher.add(root);
  function change(event: string, path: string) {
    if (
      !["add", "change", "unlink", "addDir", "unlinkDir"].includes(event) ||
      !watchedContentPath(path, root)
    )
      return;
    for (const [name, environment] of Object.entries<any>(
      server.environments,
    )) {
      if (name === "client") continue;
      environment.hot.send("notes:content-changed", {});
      // Astro 7 caches getStaticPaths props separately; invalidate that cache as
      // well so deletions/publish changes cannot leave old pages discoverable.
      environment.hot.send("astro:content-changed", {});
    }
    server.ws.send({ type: "full-reload" });
  }
  server.watcher.on("all", change);
  const cleanup = () => server.watcher.off("all", change);
  server.httpServer?.once("close", cleanup);
  return cleanup;
}
