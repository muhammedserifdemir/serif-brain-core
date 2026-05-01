// health.md — sistemin genel sagligi.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { header, ts } from "./loader.mjs";

export function writeHealthReport(data, reportsDir) {
  const lines = [];
  lines.push(header("System Health", "Canonical store + graph + dry-run kapsayici saglik raporu."));

  const canCount = data.canonical.objects.length;
  const canErr = data.canonical.errors.length;
  const drCandidates = data.dry_run?.candidate_count || 0;
  const drMove = data.dry_run?.classification?.move || 0;
  const drArchive = data.dry_run?.classification?.archive || 0;
  const drSummarize = data.dry_run?.classification?.summarize || 0;
  const dups = data.dry_run?.duplicates?.length || 0;
  const dupRecords = data.dry_run?.duplicate_record_count || 0;
  const topPri = data.dry_run?.top_priority_count || 0;
  const moduleRenames = data.dry_run?.module_renames || 0;
  const parseErrors = data.dry_run?.parse_errors?.length || 0;
  const brokenBl = data.backlinks_broken.length;

  // Risk seviyesi (otomatik kategorizasyon)
  const errors = canErr + parseErrors;
  const warnings = brokenBl + (topPri > 0 ? 1 : 0) + (dups > 0 ? 1 : 0);

  let level = "HEALTHY";
  let levelEmoji = "✅";
  if (errors > 0) { level = "ERRORS PRESENT"; levelEmoji = "🔴"; }
  else if (warnings > 5) { level = "DEGRADED"; levelEmoji = "🟠"; }
  else if (warnings > 0) { level = "OK with warnings"; levelEmoji = "🟡"; }

  lines.push(`## Overall: ${levelEmoji} ${level}`);
  lines.push(``);

  lines.push(`## Canonical Store`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---:|`);
  lines.push(`| Objects | ${canCount} |`);
  lines.push(`| Parse errors | ${canErr} |`);
  lines.push(`| Broken backlinks | ${brokenBl} |`);
  lines.push(`| Stale (>30d) | ${data.health?.stale.length || 0} |`);
  lines.push(`| Orphan | ${data.health?.orphan.length || 0} |`);
  lines.push(`| Duplicates | ${data.health?.duplicates.length || 0} |`);
  lines.push(``);

  lines.push(`## Code Graph (Faz 4)`);
  lines.push(``);
  if (!data.graph || data.graph.error) {
    lines.push(`*Graph yok veya hatali — \`serif-brain graph build\` calistir.*`);
  } else {
    const s = data.graph.stats || {};
    lines.push(`| Metric | Value |`);
    lines.push(`|---|---:|`);
    lines.push(`| Files scanned | ${s.files_scanned} |`);
    lines.push(`| Total imports | ${s.total_imports} |`);
    lines.push(`| Unresolved imports | ${s.unresolved_imports} |`);
    lines.push(`| Nodes / Edges | ${s.node_count} / ${s.edge_count} |`);
    lines.push(`| TODO/FIXME | ${s.todos} |`);
    lines.push(`| External deps | ${s.external_deps} |`);
  }
  lines.push(``);

  lines.push(`## Migration Pipeline (Faz 5 dry-run)`);
  lines.push(``);
  if (!data.dry_run) {
    lines.push(`*Dry-run yok — \`serif-brain migrate --dry-run\` calistir.*`);
  } else {
    lines.push(`| Metric | Value |`);
    lines.push(`|---|---:|`);
    lines.push(`| Candidates | ${drCandidates} |`);
    lines.push(`| → move | ${drMove} |`);
    lines.push(`| → summarize | ${drSummarize} |`);
    lines.push(`| → archive | ${drArchive} |`);
    lines.push(`| Duplicate clusters | ${dups} (${dupRecords} records) |`);
    lines.push(`| TOP priority anomalies | ${topPri} |`);
    lines.push(`| Module renames | ${moduleRenames} |`);
    lines.push(`| Parse errors | ${parseErrors} |`);
  }
  lines.push(``);

  lines.push(`## Action Items`);
  lines.push(``);
  if (errors === 0 && warnings === 0) {
    lines.push(`*Hicbir aksiyon gerekmiyor. Sistem saglikli.*`);
  } else {
    if (errors > 0) lines.push(`- 🔴 Parse errors var: \`reports/migration-audit.md#parse-errors\` kontrol et`);
    if (brokenBl > 0) lines.push(`- 🟡 Broken backlinks: \`indexes/backlink-index.md\` kontrol et (${brokenBl} adet)`);
    if (topPri > 0) lines.push(`- 🟡 ${topPri} TOP priority anomali: \`reports/migration-readiness.md\` review`);
    if (dups > 0) lines.push(`- 🟡 ${dups} duplicate cluster: \`reports/duplicates.md\` review`);
    if (data.health?.stale.length > 0) lines.push(`- 🟡 ${data.health.stale.length} stale obje: \`reports/stale-items.md\``);
  }

  const path = join(reportsDir, "health.md");
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}
