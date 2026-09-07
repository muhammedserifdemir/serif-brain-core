import { writeFileSync, renameSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Readers see either the old complete file or the new complete file.
export function atomicWrite(path, text) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, text, { flag: "wx", mode: 0o600 });
    renameSync(temp, path);
  } finally { rmSync(temp, { force: true }); }
}
