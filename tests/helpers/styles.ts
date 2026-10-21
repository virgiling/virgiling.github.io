import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import postcss, { type AtRule, type Root } from "postcss";

const localImport = /^["']\.\/([^"']+)["']/;

async function inlineLocalImports(root: Root, baseDir: string): Promise<void> {
  const imports: AtRule[] = [];
  root.walkAtRules("import", (rule) => {
    imports.push(rule);
  });
  for (const rule of imports) {
    const match = localImport.exec(rule.params.trim());
    if (!match) continue;
    const file = resolve(baseDir, match[1]);
    const imported = postcss.parse(await readFile(file, "utf8"), {
      from: file,
    });
    await inlineLocalImports(imported, dirname(file));
    rule.replaceWith(imported.nodes);
  }
}

export async function readSiteStyles(
  path = "src/styles/site.css",
): Promise<Root> {
  const file = resolve(path);
  const root = postcss.parse(await readFile(file, "utf8"), { from: file });
  await inlineLocalImports(root, dirname(file));
  return root;
}
