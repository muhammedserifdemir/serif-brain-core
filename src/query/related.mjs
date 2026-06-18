// Bağlantı çıkarımı — objeler arası OTOMATİK keşfedilen ilişkiler.
// Obsidian elle [[link]] ister; burada sistem paylaşılan modül/etiket + metin
// benzerliğinden ilişkileri kendisi bulur (Graphify'ın "inferred edge"i gibi ama
// proje hafızası objelerinde). Saf-Node, bağımlılık yok.
import { modulesOf, toResult } from "./search.mjs";

// TR + EN basit stopword listesi (kısa/yaygın kelimeleri ele).
const STOP = new Set(
  ("the a an and or of to in for on with is are be this that not from as at by it " +
   "bir ve ile için bu şu da de en çok var yok olan oldu gibi ama fakat veya")
    .split(/\s+/),
);

function terms(s) {
  const out = new Set();
  for (const w of String(s || "").toLowerCase().replace(/[^a-z0-9çğıöşü]+/gi, " ").split(/\s+/)) {
    if (w.length > 3 && !STOP.has(w)) out.add(w);
  }
  return out;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function termsOf(o) {
  const fm = o.frontmatter || {};
  return terms(`${fm.title || ""} ${String(o.body || "").slice(0, 600)}`);
}

/** İki obje arası ilişki skoru + gerekçe. */
export function scoreRelated(target, other, cache) {
  const tfm = target.frontmatter || {}, ofm = other.frontmatter || {};
  if (tfm.id && tfm.id === ofm.id) return { score: 0, reasons: [] };

  const reasons = [];
  let score = 0;

  const tm = new Set(modulesOf(tfm)), om = new Set(modulesOf(ofm));
  const shModules = [...tm].filter((m) => om.has(m));
  if (shModules.length) { score += shModules.length * 3; reasons.push(`modül:${shModules.join(",")}`); }

  const tt = new Set(tfm.tags || []), ot = new Set(ofm.tags || []);
  const shTags = [...tt].filter((t) => ot.has(t));
  if (shTags.length) { score += shTags.length * 2; reasons.push(`etiket:${shTags.join(",")}`); }

  const tterms = cache?.get(target) || termsOf(target);
  const oterms = cache?.get(other) || termsOf(other);
  const sim = jaccard(tterms, oterms);
  if (sim > 0) { const s = Math.round(sim * 12); if (s > 0) { score += s; reasons.push(`metin~${sim.toFixed(2)}`); } }

  return { score, reasons };
}

/** Bir hedef objeye en ilişkili N objeyi (gerekçeli) döndür. */
export function findRelated(target, all, { limit = 10 } = {}) {
  const cache = new Map();
  for (const o of all) cache.set(o, termsOf(o));
  return all
    .map((o) => ({ o, ...scoreRelated(target, o, cache) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => ({ ...toResult(x.o), score: x.score, reasons: x.reasons }));
}
