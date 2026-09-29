import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

test("handwritten modules, tests and supported configuration remain TypeScript", async () => {
  const files: string[] = [];
  for (const root of ["src", "scripts", "tests"]) {
    for (const entry of await readdir(root, {
      recursive: true,
      withFileTypes: true,
    })) {
      const path = relative(".", join(entry.parentPath, entry.name));
      if (entry.isFile() && !path.startsWith("src/fonts/generated/"))
        files.push(path);
    }
  }
  for (const entry of await readdir(".", { withFileTypes: true }))
    if (entry.isFile()) files.push(entry.name);
  assert.deepEqual(
    files.filter((path) => /\.(?:[cm]?js|jsx)$/.test(path)),
    [],
    "Use TypeScript for handwritten modules",
  );
  const config: { compilerOptions: { allowJs?: boolean } } = JSON.parse(
    await readFile("tsconfig.json", "utf8"),
  );
  assert.equal(config.compilerOptions.allowJs, false);
});
