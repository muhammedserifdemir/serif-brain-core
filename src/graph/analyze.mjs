// 11 architecture analizi.
const DAY = 86400000;

export function analyzeGraph(graph, opts = {}) {
  const now = opts.now || Date.now();
  const staleDays = opts.stale_days || 30;
  const godImportThreshold = opts.god_threshold || 30;
  const tooManyImports = opts.too_many_imports || 15;
  const highRiskBugThreshold = opts.high_risk_bug_threshold || 3;
  const manyOpenBugsThreshold = opts.many_open_bugs || 5;

  // Indeksler
  const fileNodes = graph.nodes.filter(n => n.type === "file" || n.type === "route" || n.type === "component");
  const moduleNodes = graph.nodes.filter(n => n.type === "module");
  const bugNodes = graph.nodes.filter(n => n.type === "bug");
  const decisionNodes = graph.nodes.filter(n => n.type === "decision");
  const packageNodes = graph.nodes.filter(n => n.type === "dependency");

  const importsOut = new Map(); // file -> [imported file ids]
  const importsIn = new Map();  // file -> [importer file ids]
  for (const f of fileNodes) { importsOut.set(f.id, []); importsIn.set(f.id, []); }

  for (const e of graph.edges) {
    if (e.type === "imports") {
      if (importsOut.has(e.source)) importsOut.get(e.source).push(e.target);
      if (importsIn.has(e.target)) importsIn.get(e.target).push(e.source);
    }
  }

  // ─── 1. Orphan files: hiç imported edilmiyor + entrypoint değil ───
  // Entrypoint heuristics: kind=route, basename ∈ {main.ts, main.tsx, index.html-related, bin/*}
  const isEntrypoint = (n) => {
    if (n.type === "route") return true;
    const b = (n.label || "").toLowerCase();
    if (["main.ts","main.tsx","main.js","main.mjs","index.ts","index.tsx"].includes(b)) return true;
    if (n.path && n.path.startsWith("bin/")) return true;
    if (n.path && n.path.startsWith("scripts/")) return true;
    return false;
  };

  const orphanFiles = fileNodes.filter(f => {
    if (isEntrypoint(f)) return false;
    return (importsIn.get(f.id) || []).length === 0;
  });

  // ─── 2. Circular dependencies (DFS cycle detection on file imports) ───
  const cycles = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const f of fileNodes) color.set(f.id, WHITE);
  const stack = [];

  function dfs(nodeId) {
    color.set(nodeId, GRAY);
    stack.push(nodeId);
    const out = importsOut.get(nodeId) || [];
    for (const target of out) {
      const c = color.get(target);
      if (c === WHITE) {
        if (dfs(target)) { /* keep collecting */ }
      } else if (c === GRAY) {
        // cycle: stack[ stack.indexOf(target) .. end ]
        const idx = stack.indexOf(target);
        if (idx >= 0) cycles.push(stack.slice(idx).concat([target]));
      }
    }
    color.set(nodeId, BLACK);
    stack.pop();
  }
  for (const f of fileNodes) {
    if (color.get(f.id) === WHITE) dfs(f.id);
  }
  // Dedup cycles by canonical key
  const cycleKeys = new Set();
  const uniqueCycles = [];
  for (const cyc of cycles) {
    const ids = cyc.slice(0, -1); // last is repeated
    const sorted = [...ids].sort();
    const key = sorted.join("|");
    if (!cycleKeys.has(key)) {
      cycleKeys.add(key);
      uniqueCycles.push(cyc);
    }
  }

  // ─── 3. God files: total imports + imported_by > threshold ───
  const godFiles = fileNodes
    .map(f => ({
      ...f,
      out_count: (importsOut.get(f.id) || []).length,
      in_count: (importsIn.get(f.id) || []).length
    }))
    .filter(f => (f.out_count + f.in_count) >= godImportThreshold)
    .sort((a, b) => (b.out_count + b.in_count) - (a.out_count + a.in_count));

  // ─── 4. High-risk modules: critical+high active bug ≥ threshold ───
  const moduleActiveBugs = new Map();
  for (const b of bugNodes) {
    if (["done","rejected","archived"].includes(b.status)) continue;
    if (!["critical","high"].includes(b.priority)) continue;
    for (const m of (b.module || [])) {
      if (!moduleActiveBugs.has(m)) moduleActiveBugs.set(m, []);
      moduleActiveBugs.get(m).push(b);
    }
  }
  const highRiskModules = [...moduleActiveBugs.entries()]
    .filter(([m, list]) => list.length >= highRiskBugThreshold)
    .map(([m, list]) => ({ module: m, count: list.length, bugs: list.map(b => ({ id: b.id.replace("bug:",""), title: b.label, priority: b.priority })) }));

  // ─── 5. Modules with many open bugs (status: open|active|in_progress) ───
  const moduleOpenBugs = new Map();
  for (const b of bugNodes) {
    if (!["open","active","in_progress","blocked"].includes(b.status)) continue;
    for (const m of (b.module || [])) {
      moduleOpenBugs.set(m, (moduleOpenBugs.get(m) || 0) + 1);
    }
  }
  const manyOpenBugs = [...moduleOpenBugs.entries()]
    .filter(([m, n]) => n >= manyOpenBugsThreshold)
    .map(([m, n]) => ({ module: m, count: n }))
    .sort((a, b) => b.count - a.count);

  // ─── 6. Decisions without module ───
  const decisionsNoModule = decisionNodes
    .filter(d => !d.module || d.module.length === 0 || d.module.includes("unknown"))
    .map(d => ({ id: d.id.replace("decision:",""), title: d.label, status: d.status }));

  // ─── 7. Bugs without owner ───
  const bugsNoOwner = bugNodes
    .filter(b => (!b.owner || b.owner === "") && ["open","active","in_progress","blocked"].includes(b.status))
    .map(b => ({ id: b.id.replace("bug:",""), title: b.label, priority: b.priority, status: b.status }));

  // ─── 8. Stale active decisions (>30d) ───
  const staleDecisions = decisionNodes
    .filter(d => ["active","in_progress"].includes(d.status))
    .map(d => ({
      ...d,
      days_old: d.updated_at ? Math.floor((now - new Date(d.updated_at).getTime()) / DAY) : null
    }))
    .filter(d => d.days_old !== null && d.days_old > staleDays)
    .map(d => ({ id: d.id.replace("decision:",""), title: d.label, days_old: d.days_old }));

  // ─── 9. Unresolved dependencies (declared:false on package nodes) ───
  const unresolvedDeps = packageNodes
    .filter(p => p.declared === false)
    .map(p => ({ name: p.label }));

  // ─── 10. Routes without module owner ───
  const routesNoOwner = fileNodes
    .filter(f => f.type === "route" && (!f.module || f.module === "unknown"))
    .map(f => ({ path: f.path }));

  // ─── 11. Components with too many imports ───
  const heavyComponents = fileNodes
    .filter(f => f.type === "component")
    .map(f => ({ ...f, out_count: (importsOut.get(f.id) || []).length }))
    .filter(f => f.out_count >= tooManyImports)
    .sort((a, b) => b.out_count - a.out_count)
    .map(f => ({ path: f.path, imports: f.out_count }));

  return {
    orphan_files: orphanFiles.map(f => ({ path: f.path, module: f.module })),
    circular_dependencies: uniqueCycles.map(cyc => cyc.map(id => id.replace("file:",""))),
    god_files: godFiles.slice(0, 20).map(f => ({ path: f.path, in: f.in_count, out: f.out_count, total: f.in_count + f.out_count })),
    high_risk_modules: highRiskModules,
    modules_with_many_open_bugs: manyOpenBugs,
    decisions_without_module: decisionsNoModule,
    bugs_without_owner: bugsNoOwner,
    stale_active_decisions: staleDecisions,
    unresolved_dependencies: unresolvedDeps,
    routes_without_owner: routesNoOwner,
    components_with_too_many_imports: heavyComponents
  };
}
