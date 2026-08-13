// architecture.md — graph.json'dan modul/file risk analizi (graph engine graph-analysis ile birlikte calisir, ama daha hedefli).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { header } from "./loader.mjs";

export function writeArchitectureReport(data, reportsDir) {
  const lines = [];
  lines.push(header("Architecture", "Modul/file/import risk haritasi — graph cikislari + dry-run + canonical merge."));

  if (!data.graph || data.graph.error) {
    lines.push(`*Graph yok. \`serif-brain graph build\` calistir.*`);
    const path = join(reportsDir, "architecture.md");
    writeFileSync(path, lines.join("\n") + "\n");
    return path;
  }

  const g = data.graph;
  const fileNodes = g.nodes.filter(n => ["file","route","component"].includes(n.type));
  const moduleNodes = g.nodes.filter(n => n.type === "module");

  // Module file counts
  const filesByModule = new Map();
  for (const n of fileNodes) {
    const m = n.module || "unknown";
    if (!filesByModule.has(m)) filesByModule.set(m, { count: 0, kinds: {}, total_loc: 0 });
    const s = filesByModule.get(m);
    s.count++;
    s.kinds[n.kind || "source"] = (s.kinds[n.kind || "source"] || 0) + 1;
    s.total_loc += (n.loc || 0);
  }

  // Modules with active+upcoming bugs/decisions (canonical + dry-run preview)
  const moduleObjectCounts = new Map();
  function bumpModule(m, type) {
    if (!moduleObjectCounts.has(m)) moduleObjectCounts.set(m, { bugs: 0, decisions: 0 });
    moduleObjectCounts.get(m)[type]++;
  }
  for (const o of data.canonical.objects) {
    if (o.error) continue;
    const fm = o.frontmatter;
    if (!["bug","decision"].includes(fm.type)) continue;
    if (["done","rejected","archived"].includes(fm.status)) continue;
    const mods = Array.isArray(fm.module) ? fm.module : [fm.module];
    for (const m of mods) bumpModule(m, fm.type === "bug" ? "bugs" : "decisions");
  }
  for (const c of (data.dry_run?.candidates || [])) {
    if (c.error || c.classification !== "move") continue;
    if (!["bug","decision"].includes(c.proposed?.type)) continue;
    if (["done","rejected","archived"].includes(c.proposed?.status)) continue;
    const mods = Array.isArray(c.proposed.module) ? c.proposed.module : [c.proposed.module];
    for (const m of mods) bumpModule(m, c.proposed.type === "bug" ? "bugs" : "decisions");
  }

  lines.push(`## Module Map`);
  lines.push(``);
  lines.push(`| Module | Files | LOC | Active Bugs | Active Decisions |`);
  lines.push(`|---|---:|---:|---:|---:|`);

  const sortedMods = [...filesByModule.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [m, stats] of sortedMods) {
    const objs = moduleObjectCounts.get(m) || { bugs: 0, decisions: 0 };
    lines.push(`| ${m} | ${stats.count} | ${stats.total_loc.toLocaleString()} | ${objs.bugs} | ${objs.decisions} |`);
  }

  // Top god files / risk concentration
  lines.push(``);
  lines.push(`## Top 10 God Files (in + out > 30)`);
  lines.push(``);
  const importsOut = new Map();
  const importsIn = new Map();
  for (const n of fileNodes) { importsOut.set(n.id, 0); importsIn.set(n.id, 0); }
  for (const e of g.edges) {
    if (e.type !== "imports") continue;
    if (importsOut.has(e.source)) importsOut.set(e.source, importsOut.get(e.source) + 1);
    if (importsIn.has(e.target)) importsIn.set(e.target, importsIn.get(e.target) + 1);
  }
  const godSorted = fileNodes
    .map(n => ({ ...n, in: importsIn.get(n.id), out: importsOut.get(n.id), total: importsIn.get(n.id) + importsOut.get(n.id) }))
    .filter(f => f.total >= 30)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  if (godSorted.length === 0) lines.push(`*Yok.*`);
  else {
    lines.push(`| File | Module | In | Out | Total |`);
    lines.push(`|---|---|---:|---:|---:|`);
    for (const f of godSorted) lines.push(`| \`${f.path}\` | ${f.module} | ${f.in} | ${f.out} | ${f.total} |`);
  }

  // Cycle hotspots
  const cycleFiles = new Map();
  // Naive: re-detect cycles cheaply
  const out2 = new Map();
  for (const n of fileNodes) out2.set(n.id, []);
  for (const e of g.edges) if (e.type === "imports" && out2.has(e.source)) out2.get(e.source).push(e.target);
  const WHITE=0, GRAY=1, BLACK=2;
  const color = new Map();
  for (const n of fileNodes) color.set(n.id, WHITE);
  const stack = [];
  function dfs(id) {
    color.set(id, GRAY);
    stack.push(id);
    for (const t of (out2.get(id) || [])) {
      const c = color.get(t);
      if (c === WHITE) dfs(t);
      else if (c === GRAY) {
        const idx = stack.indexOf(t);
        if (idx >= 0) {
          for (const fid of stack.slice(idx)) cycleFiles.set(fid, (cycleFiles.get(fid) || 0) + 1);
        }
      }
    }
    color.set(id, BLACK);
    stack.pop();
  }
  for (const n of fileNodes) if (color.get(n.id) === WHITE) dfs(n.id);

  lines.push(``);
  lines.push(`## Cycle Hotspots (top 10)`);
  lines.push(``);
  const cycleSorted = [...cycleFiles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (cycleSorted.length === 0) lines.push(`*Yok.*`);
  else {
    lines.push(`| File | Cycle Memberships |`);
    lines.push(`|---|---:|`);
    for (const [id, n] of cycleSorted) lines.push(`| \`${id.replace("file:","")}\` | ${n} |`);
  }

  // Module without files (decision/bug-only modules — şüpheli)
  const referencedModules = new Set([...moduleObjectCounts.keys()]);
  const filesyModules = new Set([...filesByModule.keys()]);
  const onlyObjModules = [...referencedModules].filter(m => !filesyModules.has(m) && m !== "unknown");
  if (onlyObjModules.length > 0) {
    lines.push(``);
    lines.push(`## Modules Referenced in Bugs/Decisions but with No Source Files`);
    lines.push(``);
    for (const m of onlyObjModules) lines.push(`- \`${m}\` — bug/decision'larda gecer ama dosyasi yok (yanlis module mapping olabilir)`);
  }

  // Filesyz dependencies
  const externalDeps = g.nodes.filter(n => n.type === "dependency");
  const declaredDeps = externalDeps.filter(n => n.declared !== false).length;
  const undeclaredDeps = externalDeps.filter(n => n.declared === false).length;
  lines.push(``);
  lines.push(`## External Dependencies`);
  lines.push(``);
  lines.push(`- Declared (in package.json): **${declaredDeps}**`);
  lines.push(`- Undeclared bare imports: **${undeclaredDeps}**`);

  const path = join(reportsDir, "architecture.md");
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}
