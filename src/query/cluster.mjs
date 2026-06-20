// Bug clustering — "bu N bug aslinda ayni kok neden" — Faz: Bug Signatures.
// related.mjs'in benzerlik skorunu (paylasilan modul/etiket + metin) bug ciftlerine
// uygular, esik ustu baglantilari union-find ile gruplar. SAF fonksiyon.
import { scoreRelated } from "./related.mjs";
import { toResult } from "./search.mjs";

class UnionFind {
  constructor(n) { this.p = Array.from({ length: n }, (_, i) => i); }
  find(x) { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x]; } return x; }
  union(a, b) { this.p[this.find(a)] = this.find(b); }
}

/**
 * @param bugObjects loadObjects() ciktisindan type==='bug' olanlar
 * @param opts { threshold=5, minSize=2 }
 * @returns [{ size, reasons, members:[toResult] }] (buyukten kucuge)
 */
export function clusterBugs(bugObjects, opts = {}) {
  const threshold = opts.threshold ?? 5;
  const minSize = opts.minSize ?? 2;
  const n = bugObjects.length;
  if (n < 2) return [];

  const uf = new UnionFind(n);
  const pairReasons = new Map(); // "i:j" -> reasons
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const { score, reasons } = scoreRelated(bugObjects[i], bugObjects[j]);
      if (score >= threshold) {
        uf.union(i, j);
        pairReasons.set(`${i}:${j}`, reasons);
      }
    }
  }

  // Gruplari topla
  const byRoot = new Map();
  for (let i = 0; i < n; i++) {
    const r = uf.find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(i);
  }

  const clusters = [];
  for (const idxs of byRoot.values()) {
    if (idxs.length < minSize) continue;
    const reasons = new Set();
    for (const key of pairReasons.keys()) {
      const [a, b] = key.split(":").map(Number);
      if (idxs.includes(a) && idxs.includes(b)) for (const rs of pairReasons.get(key)) reasons.add(rs);
    }
    clusters.push({
      size: idxs.length,
      reasons: [...reasons],
      members: idxs.map((i) => toResult(bugObjects[i])),
    });
  }
  clusters.sort((a, b) => b.size - a.size);
  return clusters;
}

export function formatClusters(clusters) {
  if (!clusters.length) return `[serif-brain cluster] benzer-bug grubu yok (her bug tekil).`;
  const L = [`[serif-brain cluster] ${clusters.length} olasi ayni-kok-neden grubu`];
  clusters.forEach((c, idx) => {
    L.push(`\n  Grup ${idx + 1} (${c.size} bug) — ${c.reasons.join(" · ")}`);
    for (const m of c.members) L.push(`    ${m.id} — ${m.title} · ${m.status}`);
  });
  return L.join("\n");
}
