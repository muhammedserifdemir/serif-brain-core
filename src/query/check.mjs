// PostToolUse(Edit) graf mini-delta — "az once ettigim edit graf sagligini bozdu mu?"
// Tek dosya icin: katman ihlali (bu dosyanin import'lari) + bu dosyadan gecen dongu +
// god-file sinyali. Active Memory'den devralindi, Symbol Graph altyapisina yaslanir.
// SAF fonksiyon.
import { findLayerViolations } from "./layers.mjs";

const FILE_TYPES = new Set(["file", "route", "component"]);
const strip = (id) => String(id).replace(/^(file|route|component):/, "");

function buildOut(graph) {
  const importsOut = new Map(), importsIn = new Map();
  for (const n of graph.nodes || []) if (FILE_TYPES.has(n.type)) { importsOut.set(n.id, []); importsIn.set(n.id, []); }
  for (const e of graph.edges || []) {
    if (e.type !== "imports") continue;
    if (importsOut.has(e.source)) importsOut.get(e.source).push(e.target);
    if (importsIn.has(e.target)) importsIn.get(e.target).push(e.source);
  }
  return { importsOut, importsIn };
}

// startId kendine geri donuyor mu? BFS + parent ile dongu yolunu cikar.
function cycleThrough(startId, importsOut) {
  const parent = new Map();
  const seen = new Set();
  const queue = [];
  for (const q of importsOut.get(startId) || []) { parent.set(q, startId); queue.push(q); }
  while (queue.length) {
    const id = queue.shift();
    if (id === startId) return { cycle: true, path: reconstruct(startId, parent) };
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of importsOut.get(id) || []) {
      if (!parent.has(next)) parent.set(next, id);
      queue.push(next);
    }
  }
  return { cycle: false, path: null };
}

// startId -> ... -> X -> startId yolunu parent zincirinden kur.
function reconstruct(startId, parent) {
  const back = parent.get(startId); // startId'e geri donen son dugum
  const chain = [startId];
  let cur = back, guard = 0;
  while (cur && cur !== startId && guard++ < 1000) {
    chain.push(cur);
    cur = parent.get(cur);
  }
  chain.push(startId);
  return chain.reverse().map(strip);
}

/**
 * @param graph { nodes, edges }
 * @param fileId node id
 * @param opts { rules, god_threshold=30 }
 */
export function checkFile(graph, fileId, opts = {}) {
  const node = (graph.nodes || []).find((n) => n.id === fileId);
  if (!node) return { found: false, file: strip(fileId) };

  const godThreshold = opts.god_threshold || 30;
  const { importsOut, importsIn } = buildOut(graph);

  // Yalniz bu dosyadan cikan import'lara karsi katman kurallari
  const ownEdges = (graph.edges || []).filter((e) => e.type === "imports" && e.source === fileId);
  const violations = findLayerViolations({ nodes: graph.nodes, edges: ownEdges }, opts.rules || []);

  const { cycle, path } = cycleThrough(fileId, importsOut);
  const degree = (importsOut.get(fileId) || []).length + (importsIn.get(fileId) || []).length;

  const issues = [];
  if (violations.length) issues.push(`${violations.length} katman ihlali`);
  if (cycle) issues.push("dongu (circular import)");
  if (degree >= godThreshold) issues.push(`god-file (derece ${degree})`);

  return {
    found: true,
    file: strip(fileId),
    ok: issues.length === 0,
    layer_violations: violations,
    in_cycle: cycle,
    cycle_path: path,
    degree,
    is_god: degree >= godThreshold,
    issues,
  };
}

export function formatCheck(c) {
  if (!c.found) return `[serif-brain check] '${c.file}' grafta yok (graph build guncel mi?).`;
  if (c.ok) return `[serif-brain check] ✓ ${c.file} — graf sagligi temiz (derece ${c.degree}).`;
  const L = [`[serif-brain check] ⚠ ${c.file} — ${c.issues.join(", ")}`];
  for (const v of c.layer_violations) L.push(`    ✗ [${v.rule}] → ${v.to_file}: ${v.reason}`);
  if (c.in_cycle && c.cycle_path) L.push(`    ↻ dongu: ${c.cycle_path.join(" → ")}`);
  if (c.is_god) L.push(`    ⊕ god-file: ${c.degree} bağlantı (refactor düşün)`);
  return L.join("\n");
}
