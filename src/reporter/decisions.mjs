// decisions.md — canonical decisions + post-apply preview.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { header, badge } from "./loader.mjs";

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
function pri(p) { return PRIORITY_ORDER[p] ?? 4; }

export function writeDecisionsReport(data, reportsDir) {
  const lines = [];
  lines.push(header("Decision Status", "Canonical store + dry-run preview kapsayici karar tablosu."));

  const canDec = data.canonical.objects
    .filter(o => !o.error && o.frontmatter.type === "decision")
    .map(o => o.frontmatter);

  const preMove = (data.dry_run?.candidates || [])
    .filter(c => !c.error && c.proposed?.type === "decision" && c.classification === "move")
    .map(c => ({
      title: c.proposed.title,
      module: c.proposed.module,
      status: c.proposed.status,
      priority: c.proposed.priority,
      created_at: c.proposed.created_at,
      _source: c.source.kind,
      _source_path: c.source.path,
      _normalizations: c.normalizations || []
    }));

  lines.push(`## Counts`);
  lines.push(``);
  lines.push(`- Canonical: **${canDec.length}**`);
  lines.push(`- Pending apply (\`move\`): **${preMove.length}**`);
  lines.push(``);

  lines.push(`## Canonical (Active)`);
  lines.push(``);
  if (canDec.length === 0) lines.push(`*Henuz canonical karar yok.*`);
  else {
    const byStatus = {};
    for (const d of canDec) {
      if (!byStatus[d.status]) byStatus[d.status] = [];
      byStatus[d.status].push(d);
    }
    const order = ["active","in_progress","queued","blocked","done","rejected","archived"];
    for (const s of order) {
      const list = byStatus[s] || [];
      if (list.length === 0) continue;
      list.sort((a, b) => pri(a.priority) - pri(b.priority));
      lines.push(`### ${badge(s)} ${s} (${list.length})`);
      lines.push(``);
      for (const d of list) {
        const m = Array.isArray(d.module) ? d.module.join(",") : d.module;
        lines.push(`- ${badge(d.priority)} **${d.title}** — \`${d.id}\` (${m})`);
      }
      lines.push(``);
    }
  }

  lines.push(`## Pre-Apply Preview`);
  lines.push(``);
  if (preMove.length === 0) lines.push(`*Hic bekleyen karar yok.*`);
  else {
    preMove.sort((a, b) => pri(a.priority) - pri(b.priority) || (b.created_at || "").localeCompare(a.created_at || ""));
    for (const d of preMove) {
      const m = Array.isArray(d.module) ? d.module.join(",") : d.module;
      const dateStr = d.created_at ? `${d.created_at}` : "?";
      lines.push(`- ${badge(d.priority)} **${d.title}** — _${m}, ${d.status}, ${dateStr}_`);
      if (d._normalizations.length > 0) {
        for (const n of d._normalizations) {
          lines.push(`  - normalize: ${n.field}: ${n.from} → ${n.to}`);
        }
      }
    }
  }

  // Modules with no decisions
  if (data.graph?.nodes) {
    const modulesInGraph = new Set(data.graph.nodes.filter(n => n.type === "module").map(n => n.label));
    const modulesWithDecisions = new Set();
    for (const d of [...canDec, ...preMove]) {
      const mods = Array.isArray(d.module) ? d.module : [d.module];
      for (const m of mods) modulesWithDecisions.add(m);
    }
    const noDecisionModules = [...modulesInGraph].filter(m => !modulesWithDecisions.has(m) && !["unknown","infra","shared"].includes(m));
    if (noDecisionModules.length > 0) {
      lines.push(``);
      lines.push(`## Modules with No Decisions`);
      lines.push(``);
      lines.push(`Bu modullerde hicbir tasarim/mimari karari kayitli degil — manuel kontrol degerli olabilir:`);
      for (const m of noDecisionModules) lines.push(`- \`${m}\``);
    }
  }

  const path = join(reportsDir, "decisions.md");
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}
