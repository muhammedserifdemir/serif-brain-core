// MCP icin obje cache'i — uzun-omurlu sunucuda her cagrida tum markdown'u yeniden
// parse etmeyi onler (inceleme #2: O(n) disk okuma/cagri). Sadece-stat imza ile
// invalidate: bir dosya eklenir/silinir/degisirse imza degisir → cache tazelenir.
// Boylece HIZLI ama asla BAYAT degil. CLI kullanmaz (kisa-omurlu); sadece MCP.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadObjects } from "./search.mjs";
import { listProjects } from "../markdown/object.mjs";

const TYPE_DIRS = ["bugs", "decisions", "plans", "notes", "sessions"];
const cache = new Map(); // brainRoot -> { sig, objects }
let hits = 0, misses = 0;

// Ucuz imza: icerik OKUMADAN, sadece stat (sayi + mtime + boyut toplami).
// Dosya ekleme/silme/degistirme imzayi degistirir; parse'tan cok daha hizli.
function brainSignature(brainRoot) {
  let count = 0, agg = 0;
  for (const p of listProjects(brainRoot)) {
    for (const t of TYPE_DIRS) {
      const dir = join(brainRoot, "objects", "projects", p, t);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".md") || f.startsWith("_template-")) continue;
        const st = statSync(join(dir, f));
        count++;
        agg += st.mtimeMs + st.size;
      }
    }
  }
  return `${count}:${agg}`;
}

/** loadObjects ile ayni cikti; degismemis brain'de cache'ten doner. */
export function loadObjectsCached(brainRoot, opts = {}) {
  const sig = brainSignature(brainRoot);
  let entry = cache.get(brainRoot);
  if (!entry || entry.sig !== sig) {
    entry = { sig, objects: loadObjects(brainRoot) };
    cache.set(brainRoot, entry);
    misses++;
  } else {
    hits++;
  }
  if (opts.project) return entry.objects.filter((o) => o.frontmatter?.project === opts.project);
  return entry.objects;
}

/**
 * Bir brain'in cache'ini dusur. YAZMA yollari (brain_add / brain_close) bunu
 * cagirir: stat-imzasi yazmayi genelde yakalar ama buna GUVENMEK yanlistir —
 * `close` dosya boyutunu degistirmeyebilir ve ayni milisaniyede yazilan bir
 * dosyanin mtime'i ayni kalabilir. Yazan taraf kendi degisikligini gormemekten
 * daha kotu bir sey yok: ajan kaydettigini sanip devam eder.
 */
export function invalidateObjectCache(brainRoot) {
  cache.delete(brainRoot);
}

// Test/gozlem icin.
export function _cacheStats() { return { hits, misses, keys: cache.size }; }
export function _clearObjectCache() { cache.clear(); hits = 0; misses = 0; }
