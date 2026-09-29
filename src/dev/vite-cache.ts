import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Concurrent author/verification/measurement servers must not replace one
// another's optimized modules. Keep a stable cache per command, port and base.
export function viteCacheDirectory(
  root: URL,
  command: string,
  port: number,
  base: string,
) {
  const key = createHash("sha256")
    .update(JSON.stringify([command, port, base]))
    .digest("hex")
    .slice(0, 12);
  return join(fileURLToPath(root), "node_modules", ".vite", `notes-${key}`);
}
