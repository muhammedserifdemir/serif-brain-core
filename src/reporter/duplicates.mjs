// duplicates.md — dry-run dedup kumelerinin detayli analizi.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { header } from "./loader.mjs";

export function writeDuplicatesReport(data, reportsDir) {
  const lines = [];
  lines.push(header("Duplicates", "Migration dry-run dedup kumelerinin detayli analizi."));

  const dups = data.dry_run?.duplicates || [];
  const candidatesById = new Map();
  for (const c of (data.dry_run?.candidates || [])) {
    candidatesById.set(c.source.path, c);
  }

  lines.push(`## Cluster Count: ${dups.length}`);
  lines.push(``);

  if (dups.length === 0) {
    lines.push(`*Hic duplicate yok.*`);
    const path = join(reportsDir, "duplicates.md");
    writeFileSync(path, lines.join("\n") + "\n");
    return path;
  }

  // Group by member count
  const byCount = new Map();
  for (const d of dups) {
    const n = d.members.length;
    byCount.set(n, (byCount.get(n) || 0) + 1);
  }
  lines.push(`### Distribution`);
  lines.push(``);
  for (const [n, c] of [...byCount.entries()].sort((a, b) => b[0] - a[0])) {
    lines.push(`- ${n}-member clusters: **${c}**`);
  }

  // Source pair analysis
  lines.push(``);
  lines.push(`### Source Origin Patterns`);
  lines.push(``);
  const pairCounts = new Map();
  for (const d of dups) {
    const sources = [...new Set(d.members.map(m => m.source_kind))].sort();
    const key = sources.join(" + ");
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  for (const [pair, n] of [...pairCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- \`${pair}\` × ${n}`);
  }

  // Top 30 most-duplicated clusters in detail
  lines.push(``);
  lines.push(`## Detail (top 30 by member count)`);
  lines.push(``);
  const sorted = [...dups].sort((a, b) => b.members.length - a.members.length).slice(0, 30);
  for (const d of sorted) {
    lines.push(`### ${d.cluster_id} — ${d.members.length} members`);
    lines.push(``);
    lines.push(`Key: \`${d.key}\``);
    lines.push(``);
    for (const m of d.members) {
      lines.push(`- **${m.source_kind}** ${m.source_path}`);
      lines.push(`  - title: ${m.title || "(none)"}`);
      lines.push(`  - status: ${m.status || "?"}, type: ${m.type}, date: ${m.date || "?"}`);
    }
    lines.push(``);
  }

  // Apply davranisi acikla
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Apply Behavior`);
  lines.push(``);
  lines.push(`Apply (apply) calistiginda her cluster icin:`);
  lines.push(`1. **Temsilci sec:** Obsidian > legacy_yaml (richer body)`);
  lines.push(`2. **Temsilci canonical store'a yaz** (\`move\` action)`);
  lines.push(`3. **Diger uyeler archive'a dus** (\`archive\` action)`);
  lines.push(`4. \`archive-index/migration-applied.json\`'da hepsi kayit altinda — kaybolmaz`);

  const path = join(reportsDir, "duplicates.md");
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}
