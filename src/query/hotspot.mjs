// Hotspot fuzyonu — "bug nerede?" — Faz: Symbol Graph.
// Klasik hotspot = churn × karmasiklik. Burada karmasiklik proxy'si = merkezilik
// (kac dosya bu dosyaya bagimli; degisirse o kadar cok sey kirilir). Uzerine modul
// bug yogunlugunu ekleriz → uc sinyalin FUZYONU. SAF fonksiyon, test edilebilir.
//
// Formul (seffaf + ayarlanabilir):
//   score = churn × (1 + dependents) + BUG_W × acik_modul_bug
// churn=0 ve bug=0 olan dosyalar elenir (statik kod hotspot degil).

const FILE_TYPES = new Set(["file", "route", "component"]);
const strip = (id) => String(id).replace(/^(file|route|component):/, "");

// Agirliklar — named sabit (gizli sihir yok; gerekirse opts.weights ile ezilir).
const DEFAULT_WEIGHTS = { bug: 2 };

function firstModule(m) {
  const arr = Array.isArray(m) ? m : [m];
  return arr.find((x) => x && x !== "unknown") || (arr[0] || null);
}

/**
 * @param graph { nodes, edges }
 * @param opts { churn: Map<relPath,count>, openBugsByModule: Map<module,count>, limit=15, weights }
 */
export function computeHotspots(graph, opts = {}) {
  const churn = opts.churn || new Map();
  const bugsByMod = opts.openBugsByModule || new Map();
  const limit = opts.limit ?? 15;
  const w = { ...DEFAULT_WEIGHTS, ...(opts.weights || {}) };

  // dependents (in-degree) = kac dosya bu dosyayi import ediyor
  const inDeg = new Map();
  for (const n of graph.nodes || []) if (FILE_TYPES.has(n.type)) inDeg.set(n.id, 0);
  for (const e of graph.edges || []) {
    if (e.type === "imports" && inDeg.has(e.target)) inDeg.set(e.target, inDeg.get(e.target) + 1);
  }

  const rows = [];
  for (const n of graph.nodes || []) {
    if (!FILE_TYPES.has(n.type)) continue;
    const path = n.path || strip(n.id);
    const ch = churn.get(path) || 0;
    const mod = firstModule(n.module);
    const bugs = (mod && bugsByMod.get(mod)) || 0;
    if (ch === 0 && bugs === 0) continue; // ne degisti ne bug var → hotspot degil

    const dependents = inDeg.get(n.id) || 0;
    const score = ch * (1 + dependents) + w.bug * bugs;
    rows.push({ path, module: mod || "unknown", churn: ch, dependents, open_module_bugs: bugs, score });
  }

  rows.sort((a, b) => b.score - a.score || b.churn - a.churn);
  return rows.slice(0, limit);
}

/** Kompakt tablo metni. */
export function formatHotspots(rows, { days } = {}) {
  if (!rows.length) {
    return `[serif-brain hotspot] tehlike bolgesi yok (son ${days ?? "?"} gun churn + acik bug taramasi temiz).`;
  }
  const L = [];
  L.push(`[serif-brain hotspot] tehlike bolgesi (churn×merkezilik + bug) — son ${days ?? "?"} gun`);
  L.push(`  skor  churn  bağımlı  bug  dosya`);
  for (const r of rows) {
    const s = String(r.score).padStart(4);
    const c = String(r.churn).padStart(5);
    const d = String(r.dependents).padStart(7);
    const b = String(r.open_module_bugs).padStart(4);
    L.push(`  ${s} ${c} ${d} ${b}  ${r.path}${r.module ? ` (${r.module})` : ""}`);
  }
  return L.join("\n");
}
