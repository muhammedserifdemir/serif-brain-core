// Canli blast-radius — "bu dosyayi degistirirsem ne kirilir?" — Faz: Symbol Graph (ilk dilim).
// Mevcut import grafini (graph.json) kullanir; henuz dosya-seviyesi (sembol-seviyesi
// call-graph sonraki adim). SAF fonksiyon: graf + hedef node -> etki kumeleri.
//
// Kenar yonu (analyze.mjs ile ayni): edge{source,target,type:"imports"} = source, target'i
// import eder. Yani X'in BAGIMLILARI (X degisirse kirilabilecekler) = X'i import edenler,
// gecisli (reverse BFS). X'in BAGIMLILIKLARI = X'in import ettikleri (forward).

const FILE_TYPES = new Set(["file", "route", "component"]);

function buildIndexes(graph) {
  const importsOut = new Map(); // id -> [import ettikleri]
  const importsIn = new Map();  // id -> [onu import edenler]
  for (const n of graph.nodes || []) {
    if (FILE_TYPES.has(n.type)) { importsOut.set(n.id, []); importsIn.set(n.id, []); }
  }
  for (const e of graph.edges || []) {
    if (e.type !== "imports") continue;
    if (importsOut.has(e.source)) importsOut.get(e.source).push(e.target);
    if (importsIn.has(e.target)) importsIn.get(e.target).push(e.source);
  }
  return { importsOut, importsIn };
}

// adjacency uzerinden gecisli kapanis (BFS), baslangic haric.
function closure(startId, adj) {
  const seen = new Set();
  const queue = [...(adj.get(startId) || [])];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id) || id === startId) continue;
    seen.add(id);
    for (const next of adj.get(id) || []) if (!seen.has(next)) queue.push(next);
  }
  return seen;
}

const strip = (id) => String(id).replace(/^(file|route|component):/, "");

const baseOf = (p) => String(p || "").split("/").pop();

/** Bir dosya yolunu (proje-goreli) graftaki file/route/component node'una esle. */
export function resolveFileNode(graph, relPath) {
  const fileNodes = (graph.nodes || []).filter((n) => FILE_TYPES.has(n.type));
  const base = baseOf(relPath);
  return (
    fileNodes.find((n) => n.path === relPath || n.id === `file:${relPath}`) ||
    fileNodes.find((n) => String(n.id).endsWith(`:${relPath}`)) ||
    fileNodes.find((n) => baseOf(n.path || n.id) === base) ||
    null
  );
}

/**
 * @param graph { nodes, edges }
 * @param targetId node id (orn. "file:src/a.ts")
 */
export function computeImpact(graph, targetId) {
  const node = (graph.nodes || []).find((n) => n.id === targetId);
  if (!node) return { found: false, target: targetId };

  const { importsOut, importsIn } = buildIndexes(graph);

  const directDeps = (importsIn.get(targetId) || []);          // dogrudan bagimlilar
  const transitiveDeps = closure(targetId, importsIn);          // gecisli bagimlilar
  const dependencies = (importsOut.get(targetId) || []);        // bu dosyanin import ettikleri

  // Etkilenen moduller (bagimlilarin modulleri)
  const nodeById = new Map((graph.nodes || []).map((n) => [n.id, n]));
  const affectedModules = new Set();
  for (const id of transitiveDeps) {
    const m = nodeById.get(id)?.module;
    for (const mm of Array.isArray(m) ? m : [m]) if (mm && mm !== "unknown") affectedModules.add(mm);
  }

  return {
    found: true,
    target: strip(targetId),
    module: node.module || null,
    direct_dependents: directDeps.map(strip).sort(),
    transitive_dependent_count: transitiveDeps.size,
    transitive_dependents: [...transitiveDeps].map(strip).sort(),
    dependencies: dependencies.map(strip).sort(),
    affected_modules: [...affectedModules].sort(),
    // Yalniz (kimse import etmiyor) → degistirmesi guvenli sinyali
    is_leaf: directDeps.length === 0,
  };
}

/** Kompakt metin ozeti. */
export function formatImpact(im, { memory } = {}) {
  if (!im.found) return `[serif-brain impact] '${im.target}' grafta bulunamadi (once: serif-brain graph build).`;
  const L = [];
  L.push(`[serif-brain impact] ${im.target}${im.module ? ` · modul:${im.module}` : ""}`);
  L.push(`  Blast-radius: ${im.transitive_dependent_count} dosya etkilenir (dogrudan ${im.direct_dependents.length})`);
  if (im.is_leaf) L.push(`  ✓ Yaprak dosya — kimse import etmiyor, degistirmesi nispeten guvenli.`);
  if (im.affected_modules.length) L.push(`  Etkilenen moduller: ${im.affected_modules.join(", ")}`);
  if (im.direct_dependents.length) {
    L.push(`  Dogrudan bagimlilar (${im.direct_dependents.length}):`);
    for (const d of im.direct_dependents.slice(0, 12)) L.push(`    ← ${d}`);
    if (im.direct_dependents.length > 12) L.push(`    … +${im.direct_dependents.length - 12} daha`);
  }
  if (im.dependencies.length) L.push(`  Bu dosya ${im.dependencies.length} dosyaya bagimli.`);
  if (memory && !memory.empty) {
    L.push(`  ⚠ Hafiza: ${memory.module_decisions.length} karar, ${memory.module_bugs.length} bug bu modulde (serif-brain touch ile detay).`);
  }
  return L.join("\n");
}
