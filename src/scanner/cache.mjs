// Artımlı tarama cache'i — dosya başına parse sonucunu (import/mention/todo/loc)
// mtime+size ile saklar. Değişmeyen dosyalar yeniden okunmaz/parse edilmez.
// .serif-brain/.cache/scan.json (gitignore'da). Saf-Node.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const CACHE_VERSION = 1;

export function loadScanCache(brainRoot) {
  const p = join(brainRoot, ".cache", "scan.json");
  if (!existsSync(p)) return { version: CACHE_VERSION, files: {} };
  try {
    const c = JSON.parse(readFileSync(p, "utf8"));
    if (c?.version !== CACHE_VERSION || typeof c.files !== "object") return { version: CACHE_VERSION, files: {} };
    return c;
  } catch {
    return { version: CACHE_VERSION, files: {} };
  }
}

export function saveScanCache(brainRoot, files) {
  const p = join(brainRoot, ".cache", "scan.json");
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ version: CACHE_VERSION, files }));
  } catch {
    /* cache yazılamazsa sessiz geç — sadece optimizasyon */
  }
}
