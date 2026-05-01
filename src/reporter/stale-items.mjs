// stale-items.md — canonical + dry-run preview kapsayici stale liste.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { header } from "./loader.mjs";

const DAY = 86400000;

export function writeStaleItemsReport(data, reportsDir) {
  const lines = [];
  lines.push(header("Stale Items", "30 gunden eski aktif kayitlar (canonical + dry-run move-bound)."));

  const now = Date.now();
  const stale = [];

  for (const o of data.canonical.objects) {
    if (o.error) continue;
    const fm = o.frontmatter;
    if (["done","rejected","archived"].includes(fm.status)) continue;
    const upd = fm.updated_at ? new Date(fm.updated_at).getTime() : (o.mtime?.getTime() || 0);
    if (!upd) continue;
    const days = Math.floor((now - upd) / DAY);
    if (days >= 30) {
      stale.push({ id: fm.id, type: fm.type, status: fm.status, days, source: "canonical" });
    }
  }

  for (const c of (data.dry_run?.candidates || [])) {
    if (c.error || c.classification !== "move") continue;
    const fm = c.proposed;
    if (!fm.created_at) continue;
    if (["done","rejected","archived"].includes(fm.status)) continue;
    const dt = new Date(fm.created_at).getTime();
    if (isNaN(dt)) continue;
    const days = Math.floor((now - dt) / DAY);
    if (days >= 30) {
      stale.push({
        id: c.proposed.title?.slice(0, 60) || "(no title)",
        type: fm.type,
        status: fm.status,
        days,
        source: c.source.kind,
        source_path: c.source.path
      });
    }
  }

  stale.sort((a, b) => b.days - a.days);

  lines.push(`## Total: ${stale.length}`);
  lines.push(``);
  if (stale.length === 0) {
    lines.push(`*Hicbir stale kayit yok.*`);
  } else {
    lines.push(`| Days | Type | Status | Identifier | Source |`);
    lines.push(`|---:|---|---|---|---|`);
    for (const s of stale.slice(0, 100)) {
      lines.push(`| ${s.days} | ${s.type} | ${s.status} | ${s.id} | ${s.source}${s.source_path ? `: ${s.source_path}` : ""} |`);
    }
    if (stale.length > 100) lines.push(``).push(`_... ${stale.length - 100} more — see \`migration-dry-run.json\`_`);
  }

  // Canonical orphan ve duplicate (Faz 3 health detector'undan)
  if (data.health) {
    lines.push(``);
    lines.push(`## Canonical Orphans (no incoming + no outgoing relations)`);
    lines.push(``);
    if (data.health.orphan.length === 0) lines.push(`*Yok.*`);
    else for (const o of data.health.orphan) lines.push(`- \`${o.id}\` (${o.type})`);

    lines.push(``);
    lines.push(`## Canonical Duplicates`);
    lines.push(``);
    if (data.health.duplicates.length === 0) lines.push(`*Yok.*`);
    else for (const d of data.health.duplicates) {
      lines.push(`- ${d.ids.length}x same key: \`${d.key}\``);
      for (const id of d.ids) lines.push(`  - ${id}`);
    }
  }

  const path = join(reportsDir, "stale-items.md");
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}
