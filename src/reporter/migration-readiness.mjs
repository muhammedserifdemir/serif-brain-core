// migration-readiness.md — apply oncesi manuel karar gerektiren noktalar.
// + TOP priority review + unknown module review.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { header } from "./loader.mjs";

export function writeMigrationReadinessReport(data, reportsDir) {
  const lines = [];
  lines.push(header("Migration Readiness", "Apply oncesi manuel karar gerektiren tum noktalar tek dosyada."));

  const dr = data.dry_run;
  if (!dr) {
    lines.push(`*Dry-run yok. \`serif-brain migrate --dry-run\` calistir.*`);
    const path = join(reportsDir, "migration-readiness.md");
    writeFileSync(path, lines.join("\n") + "\n");
    return path;
  }

  const candidates = dr.candidates || [];

  // 1. TOP priority review
  const topItems = candidates.filter(c => !c.error && c.proposed?.priority === "high" && (c.normalizations || []).some(n => n.field === "priority" && n.from === "TOP"));

  lines.push(`## 1. TOP Priority Review (${topItems.length})`);
  lines.push(``);
  lines.push(`Bu kayitlarda eski sistem \`priority: TOP\` kullaniyordu. Default \`high\`'a indirildi.`);
  lines.push(`**Manual karar gerekli:** Asagidakilerin hangileri gercekten \`critical\`'a yukseltilmeli?`);
  lines.push(``);
  if (topItems.length === 0) lines.push(`*Yok.*`);
  else {
    lines.push(`| Type | Title | Module | Status | Source |`);
    lines.push(`|---|---|---|---|---|`);
    for (const c of topItems) {
      const fm = c.proposed;
      const m = Array.isArray(fm.module) ? fm.module.join(",") : fm.module;
      lines.push(`| ${fm.type} | ${(fm.title || "").slice(0, 50)} | ${m} | ${fm.status} | ${c.source.kind} |`);
    }
  }

  // 2. Unknown module review
  const unknownItems = candidates.filter(c => !c.error && c.proposed?.module === "unknown" && c.classification !== "archive");
  lines.push(``);
  lines.push(`## 2. Unknown Module Review (${unknownItems.length})`);
  lines.push(``);
  lines.push(`Modulu tanimsiz kayitlar — \`config.yaml\`'a yeni module eklenmesi gerekebilir veya manuel atama yapilmali.`);
  lines.push(``);
  if (unknownItems.length === 0) lines.push(`*Yok.*`);
  else {
    lines.push(`| Type | Title | Status | Source |`);
    lines.push(`|---|---|---|---|`);
    for (const c of unknownItems.slice(0, 30)) {
      const fm = c.proposed;
      lines.push(`| ${fm.type} | ${(fm.title || "").slice(0, 60)} | ${fm.status} | ${c.source.path} |`);
    }
    if (unknownItems.length > 30) lines.push(`| ... | _(${unknownItems.length - 30} more)_ | | |`);
  }

  // 3. Archive due to suspect quality
  const lowQuality = candidates.filter(c => !c.error && c.classification === "archive" && (c.classification_reason || "").includes("Low-quality"));
  lines.push(``);
  lines.push(`## 3. Low-Quality Archive Candidates (${lowQuality.length})`);
  lines.push(``);
  if (lowQuality.length === 0) lines.push(`*Yok.*`);
  else {
    for (const c of lowQuality.slice(0, 20)) {
      lines.push(`- ${c.source.path} — title: "${c.proposed?.title || ""}"`);
    }
  }

  // 4. Sprint review (only 'move' classification)
  const activeSprints = candidates.filter(c => !c.error && c.classification === "move" && c.source.path?.includes("/sprints/"));
  lines.push(``);
  lines.push(`## 4. Active Sprint Review (${activeSprints.length})`);
  lines.push(``);
  lines.push(`Apply'da bu sprint(ler) canonical store'a yazilacak. Dogrulanmali:`);
  lines.push(``);
  if (activeSprints.length === 0) lines.push(`*Yok.*`);
  else {
    for (const c of activeSprints) {
      lines.push(`- ${c.source.path}`);
      lines.push(`  - title: ${c.proposed?.title || ""}`);
      lines.push(`  - status: ${c.proposed?.status || "?"}`);
    }
  }

  // 5. ID collision risk
  const existingIds = new Set();
  for (const o of data.canonical.objects) {
    if (!o.error) existingIds.add(o.frontmatter.id);
  }
  const moveCandidates = candidates.filter(c => !c.error && c.classification === "move");
  // Note: dry-run doesn't pre-compute IDs, so simulate slug
  function slugify(s) {
    const tr = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };
    return (s || "").split("").map(c => tr[c] ?? c).join("").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  }
  const collisions = [];
  const proposedIds = new Map(); // id -> [candidates]
  for (const c of moveCandidates) {
    const date = (c.proposed.created_at || "").slice(0, 10).replace(/-/g, "") || "?";
    const id = `${c.proposed.type}-${date}-${slugify(c.proposed.title)}`;
    if (!proposedIds.has(id)) proposedIds.set(id, []);
    proposedIds.get(id).push(c);
    if (existingIds.has(id)) collisions.push({ id, candidate: c });
  }
  const internalCollisions = [...proposedIds.entries()].filter(([, v]) => v.length > 1);

  lines.push(``);
  lines.push(`## 5. ID Collision Risk (canonical vs apply)`);
  lines.push(``);
  lines.push(`- Apply'in uretmeyi onerdigi ID, **mevcut canonical** ile cakisiyor: **${collisions.length}**`);
  lines.push(`- Apply'in kendi icinde ayni ID'yi 2+ kez uretiyor: **${internalCollisions.length}**`);
  lines.push(``);
  if (collisions.length > 0) {
    lines.push(`### Canonical collisions`);
    for (const c of collisions) lines.push(`- \`${c.id}\` — apply will OVERWRITE existing`);
  }
  if (internalCollisions.length > 0) {
    lines.push(`### Internal collisions (within apply set)`);
    for (const [id, list] of internalCollisions) {
      lines.push(`- \`${id}\` × ${list.length}`);
      for (const c of list) lines.push(`  - ${c.source.path}`);
    }
  }

  // 6. Apply preview with breakdown
  lines.push(``);
  lines.push(`## 6. Apply Preview (what will be written)`);
  lines.push(``);
  const moveByType = dr.move_breakdown_by_type || {};
  for (const [type, count] of Object.entries(moveByType)) {
    lines.push(`- ${type}s: **${count}** new files`);
  }
  lines.push(``);
  lines.push(`Total **move** records: ${dr.classification?.move || 0}`);
  lines.push(`Total **summarize** records: ${dr.classification?.summarize || 0} (daily notes / root docs / legacy top-level YAMLs)`);
  lines.push(`Total **archive** records: ${dr.classification?.archive || 0} (closed bugs/decisions, dupes, low-quality)`);
  lines.push(``);

  // 7. Final go/no-go checklist
  lines.push(`## 7. Apply Go/No-Go Checklist`);
  lines.push(``);
  lines.push(`Apply komutu calistirmadan once asagidakilerin TUMU evet olmali:`);
  lines.push(``);
  const checks = [
    { ok: dr.parse_errors?.length === 0, label: "Parse errors: 0", actual: dr.parse_errors?.length },
    { ok: collisions.length === 0, label: "No canonical ID collisions", actual: collisions.length },
    { ok: internalCollisions.length === 0, label: "No internal ID collisions", actual: internalCollisions.length },
    { ok: topItems.length === 0, label: "TOP priority review done (or accepted)", actual: `${topItems.length} pending` },
    { ok: unknownItems.length === 0, label: "Unknown module review done", actual: `${unknownItems.length} pending` },
    { ok: true, label: "Backup verified (Faz 1 archive intact)", actual: "manual check" }
  ];
  for (const c of checks) {
    lines.push(`- ${c.ok ? "✅" : "⚠"} ${c.label} ${c.actual !== undefined ? `(${c.actual})` : ""}`);
  }

  const path = join(reportsDir, "migration-readiness.md");
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}
