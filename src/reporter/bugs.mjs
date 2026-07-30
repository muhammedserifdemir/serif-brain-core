// bugs.md — canonical bugs + post-apply preview.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { header, badge } from "./loader.mjs";
import { pri, rankObjects } from "../util/rank.mjs";



export function writeBugsReport(data, reportsDir) {
  const lines = [];
  lines.push(header("Bug Status", "Canonical store + dry-run preview kapsayici bug tablosu."));

  const canBugs = data.canonical.objects
    .filter(o => !o.error && o.frontmatter.type === "bug")
    .map(o => ({ ...o.frontmatter, _source: "canonical" }));

  // Pre-apply preview: dry-run move-classified bugs
  const preMove = (data.dry_run?.candidates || [])
    .filter(c => !c.error && c.proposed?.type === "bug" && c.classification === "move")
    .map(c => ({
      title: c.proposed.title,
      module: c.proposed.module,
      status: c.proposed.status,
      priority: c.proposed.priority,
      severity: c.proposed.severity,
      _source: c.source.kind,
      _source_path: c.source.path
    }));

  lines.push(`## Counts`);
  lines.push(``);
  lines.push(`- Canonical (live): **${canBugs.length}**`);
  lines.push(`- Pending apply (dry-run \`move\`): **${preMove.length}**`);
  lines.push(`- Combined post-apply estimate: **${canBugs.length + preMove.length}** *(if no overlaps)*`);
  lines.push(``);

  // Canonical — by status & priority
  lines.push(`## Canonical (Active in Context)`);
  lines.push(``);
  if (canBugs.length === 0) lines.push(`*Henuz canonical bug yok.*`);
  else {
    const byStatus = {};
    for (const b of canBugs) {
      if (!byStatus[b.status]) byStatus[b.status] = [];
      byStatus[b.status].push(b);
    }
    const statusOrder = ["open", "active", "in_progress", "blocked", "queued"];
    for (const s of statusOrder) {
      const list = byStatus[s] || [];
      if (list.length === 0) continue;
      const sirali = rankObjects(list);
      lines.push(`### ${badge(s)} ${s} (${list.length})`);
      lines.push(``);
      for (const b of sirali) {
        const m = Array.isArray(b.module) ? b.module.join(",") : b.module;
        lines.push(`- ${badge(b.priority)} **${b.title}** — \`${b.id}\` (${m})`);
      }
      lines.push(``);
    }
  }

  // Pre-apply preview
  lines.push(`## Pre-Apply Preview (dry-run only — not yet written)`);
  lines.push(``);
  if (preMove.length === 0) lines.push(`*Hic bekleyen bug yok.*`);
  else {
    const bySource = { obsidian: [], legacy_yaml: [] };
    for (const b of preMove) {
      if (!bySource[b._source]) bySource[b._source] = [];
      bySource[b._source].push(b);
    }
    for (const [src, list] of Object.entries(bySource)) {
      if (list.length === 0) continue;
      lines.push(`### From \`${src}\` (${list.length})`);
      lines.push(``);
      const sirali = rankObjects(list);
      for (const b of sirali) {
        const m = Array.isArray(b.module) ? b.module.join(",") : b.module;
        lines.push(`- ${badge(b.priority)} **${b.title}** — _${m}, ${b.status}_`);
      }
      lines.push(``);
    }
  }

  // Critical breakdown
  const allCritical = [...canBugs, ...preMove].filter(b => b.priority === "critical" && !["done","rejected","archived"].includes(b.status));
  if (allCritical.length > 0) {
    lines.push(`## 🔴 Critical & Active (${allCritical.length})`);
    lines.push(``);
    for (const b of allCritical) {
      const m = Array.isArray(b.module) ? b.module.join(",") : b.module;
      lines.push(`- **${b.title}** (${m}, ${b.status}) — _${b._source}_`);
    }
  }

  const path = join(reportsDir, "bugs.md");
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}
