// serif-brain migrate --dry-run | --apply
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { ingestDecisionsYaml, ingestBugsYaml, listTopLevelYamlFiles } from "../ingest/legacy-yaml.mjs";
import { ingestObsidianDecisions, ingestObsidianBugs, ingestObsidianSprints, listObsidianDailies, listObsidianRootDocs } from "../ingest/obsidian-md.mjs";
import { readGraphifyReport } from "../ingest/graphify-ref.mjs";
import { normalizeCandidate } from "../migrate/normalize.mjs";
import { detectDuplicates } from "../migrate/dedup.mjs";
import { classifyCandidate, applyClusterMembership } from "../migrate/classify.mjs";
import { writeMigrationAudit, writeContextPollution, writeDryRunJson } from "../migrate/audit.mjs";
import { applyMigration } from "../migrate/apply.mjs";

export async function migrateCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");

  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  const config = loadConfig(brainRoot);
  const archivePath = config.legacy_sources?.archive_root;
  if (!archivePath) {
    throw new Error(`No archive_root in config.yaml`);
  }
  if (!existsSync(archivePath)) {
    throw new Error(`Archive missing: ${archivePath} — run archive apply first`);
  }

  const isApply = args.flags.apply === true;
  const isDryRun = !isApply;

  console.log(`[serif-brain migrate ${isApply ? "--apply" : "--dry-run"}]`);
  console.log(`  Project:  ${projectRoot}`);
  console.log(`  Archive:  ${archivePath}`);
  console.log(`  Mode:     READ-ONLY (no canonical writes, no live source modifications)`);
  console.log(``);

  // ─── 1. Ingest tüm kaynaklar ───
  console.log(`Reading sources...`);
  const t0 = Date.now();

  const legacyDecisions = ingestDecisionsYaml(archivePath);
  const legacyBugs = ingestBugsYaml(archivePath);
  const obsDecisions = ingestObsidianDecisions(archivePath);
  const obsBugs = ingestObsidianBugs(archivePath);
  const obsSprints = ingestObsidianSprints(archivePath);
  const obsDailies = listObsidianDailies(archivePath);
  const obsRootDocs = listObsidianRootDocs(archivePath);
  const legacyTopLevel = listTopLevelYamlFiles(archivePath);
  const graphifySummary = readGraphifyReport(archivePath);

  console.log(`  legacy_yaml/decisions.yaml:    ${legacyDecisions.length}`);
  console.log(`  legacy_yaml/bugs.yaml:         ${legacyBugs.length}`);
  console.log(`  obsidian/decisions/:           ${obsDecisions.length}`);
  console.log(`  obsidian/bugs/:                ${obsBugs.length}`);
  console.log(`  obsidian/sprints/:             ${obsSprints.length}`);
  console.log(`  obsidian/daily/ (count only):  ${obsDailies.length}`);
  console.log(`  obsidian/root docs:            ${obsRootDocs.length}`);
  console.log(`  legacy top-level YAMLs:        ${legacyTopLevel.length}`);
  console.log(`  graphify GRAPH_REPORT.md:      ${graphifySummary?.found ? "yes (reference only)" : "no"}`);

  // ─── 2. Combine + normalize ───
  let candidates = [
    ...legacyDecisions,
    ...legacyBugs,
    ...obsDecisions,
    ...obsBugs,
    ...obsSprints
  ];

  // Daily notes — sadece referans (summarize)
  for (const path of obsDailies) {
    candidates.push({
      source: { kind: "obsidian", path },
      proposed: { type: "note", project: "serif-platform", title: `Daily: ${path.split("/").pop()}`, status: "archived", body: "" },
      summarize_only: true
    });
  }

  // Root docs — kontrolde tut, identity/feedback config'e gidiyor zaten
  for (const path of obsRootDocs) {
    candidates.push({
      source: { kind: "obsidian", path },
      proposed: { type: "note", project: "serif-platform", title: `Root doc: ${path.split("/").pop()}`, status: "archived", body: "" },
      summarize_only: true,
      reason: "config/principles already migrated to .serif-brain/config.yaml"
    });
  }

  // Legacy top-level YAMLs (identity, project, tech, feedback, deployment, entities)
  for (const path of legacyTopLevel) {
    candidates.push({
      source: { kind: "legacy_yaml", path },
      proposed: { type: "note", project: "serif-platform", title: `Legacy: ${path.split("/").pop()}`, status: "archived", body: "" },
      summarize_only: true,
      reason: "config/principles already migrated to .serif-brain/config.yaml"
    });
  }

  console.log(``);
  console.log(`Candidates total: ${candidates.length}`);

  // Normalize
  for (const c of candidates) {
    if (!c.error) normalizeCandidate(c);
  }

  // ─── 3. Dedup ───
  const dedup = detectDuplicates(candidates);
  applyClusterMembership(candidates, dedup);

  // ─── 4. Classify ───
  for (const c of candidates) classifyCandidate(c, dedup.clusters);

  // ─── 5. Aggregate audit data ───
  const allNormalizations = [];
  const allWarnings = [];
  const parseErrors = [];
  let topPriorityCount = 0;
  let moduleRenames = 0;
  const moveByType = {};
  const closedBugs = [];
  const doneDecisions = [];
  const dailyNotesPaths = [];
  const sprintFiles = [];

  for (const c of candidates) {
    if (c.error) {
      parseErrors.push({ path: c.source.path, error: c.error });
      continue;
    }
    for (const n of (c.normalizations || [])) allNormalizations.push(n);
    for (const w of (c.warnings || [])) allWarnings.push(w);
    if (c.raw?.priority === "TOP") topPriorityCount++;
    if ((c.normalizations || []).some(n => n.field === "module")) moduleRenames++;
    if (c.classification === "move") {
      moveByType[c.proposed.type] = (moveByType[c.proposed.type] || 0) + 1;
    }
    if (c.proposed.type === "bug" && ["done","rejected","archived"].includes(c.proposed.status)) closedBugs.push(c);
    if (c.proposed.type === "decision" && ["done","archived","rejected"].includes(c.proposed.status)) doneDecisions.push(c);
    if (c.source.path?.includes("/daily/")) dailyNotesPaths.push(c.source.path);
    if (c.source.path?.includes("/sprints/")) sprintFiles.push(c.source.path);
  }

  const classification = {
    move: candidates.filter(c => c.classification === "move").length,
    summarize: candidates.filter(c => c.classification === "summarize").length,
    archive: candidates.filter(c => c.classification === "archive").length,
    total: candidates.length
  };

  const audit = {
    generated_at: new Date().toISOString(),
    archive_path: archivePath,
    elapsed_ms: Date.now() - t0,
    sources: [
      { kind: "legacy_yaml", path: "1-project-brain/decisions.yaml", count: legacyDecisions.length },
      { kind: "legacy_yaml", path: "1-project-brain/bugs.yaml", count: legacyBugs.length },
      { kind: "legacy_yaml", path: "1-project-brain/{identity,project,tech,...}.yaml", count: legacyTopLevel.length, note: "principles → config.yaml (already migrated, no per-record import)" },
      { kind: "obsidian", path: "4-obsidian-vault/projects/serif-platform/decisions/", count: obsDecisions.length, errors: obsDecisions.filter(c => c.error).length },
      { kind: "obsidian", path: "4-obsidian-vault/projects/serif-platform/bugs/", count: obsBugs.length, errors: obsBugs.filter(c => c.error).length },
      { kind: "obsidian", path: "4-obsidian-vault/projects/serif-platform/sprints/", count: obsSprints.length },
      { kind: "obsidian", path: "4-obsidian-vault/daily/", count: obsDailies.length, note: "summarize-only (high volume, low-value context)" },
      { kind: "obsidian", path: "4-obsidian-vault/{identity,feedback,...}.md", count: obsRootDocs.length, note: "principles → config.yaml" },
      { kind: "graphify", path: "5-graphify-out/GRAPH_REPORT.md", count: 0, note: "REFERENCE_ONLY — replaced by yerlesik graph engine" }
    ],
    classification,
    normalizations: allNormalizations,
    warnings: allWarnings,
    parse_errors: parseErrors,
    duplicates: dedup.dup_groups,
    duplicate_record_count: dedup.dup_groups.reduce((s, g) => s + g.members.length, 0),
    top_priority_count: topPriorityCount,
    module_renames: moduleRenames,
    move_breakdown_by_type: moveByType,
    pollution: {
      closed_bugs: closedBugs.map(c => ({ source: c.source.path, title: c.proposed.title })),
      done_decisions: doneDecisions.map(c => ({ source: c.source.path, title: c.proposed.title })),
      daily_notes: dailyNotesPaths,
      sprint_files: sprintFiles
    },
    graphify_summary: graphifySummary,
    candidate_count: candidates.length
  };

  // ─── 6. Write reports (SADECE 3 dosya, kullanici onayli) ───
  const auditPath = writeMigrationAudit(brainRoot, audit);
  const pollutionPath = writeContextPollution(brainRoot, audit);
  const jsonPath = writeDryRunJson(brainRoot, { ...audit, candidates: candidates.map(c => ({
    source: c.source,
    classification: c.classification,
    classification_reason: c.classification_reason,
    proposed_id_preview: c.proposed.title?.slice(0, 60),
    proposed: c.proposed,
    normalizations: c.normalizations,
    warnings: c.warnings,
    error: c.error,
    dedup_cluster: c.dedup_cluster,
    is_duplicate_representative: c.is_duplicate_representative,
    is_duplicate_non_representative: c.is_duplicate_non_representative
  })) });

  console.log(``);
  console.log(`Classification:`);
  console.log(`  move:       ${classification.move}`);
  console.log(`  summarize:  ${classification.summarize}`);
  console.log(`  archive:    ${classification.archive}`);
  console.log(`  TOTAL:      ${classification.total}`);
  console.log(``);
  console.log(`Normalizations: ${allNormalizations.length}`);
  console.log(`Warnings:       ${allWarnings.length}`);
  console.log(`Parse errors:   ${parseErrors.length}`);
  console.log(`Dup clusters:   ${dedup.dup_groups.length} (${audit.duplicate_record_count} records)`);
  console.log(`TOP priority:   ${topPriorityCount}`);
  console.log(`Elapsed:        ${audit.elapsed_ms}ms`);
  console.log(``);
  console.log(`Reports written:`);
  console.log(`  + ${auditPath}`);
  console.log(`  + ${pollutionPath}`);
  console.log(`  + ${jsonPath}`);
  console.log(``);

  if (!isApply) {
    console.log(`No canonical writes. No source modifications. Apply requires explicit user approval.`);
    return 0;
  }

  // ─── APPLY ───
  console.log(`══════════════════════════════════════`);
  console.log(`APPLY — yazma fazi basliyor`);
  console.log(`══════════════════════════════════════`);
  const applied = applyMigration({ brainRoot, candidates, dryRunData: audit, archivePath });

  console.log(``);
  console.log(`Apply sonucu:`);
  console.log(`  ✓ Canonical yazildi:        ${applied.written.length}`);
  console.log(`    - bugs:                   ${applied.written.filter(w => w.type === "bug").length}`);
  console.log(`    - decisions:              ${applied.written.filter(w => w.type === "decision").length}`);
  console.log(`    - notes:                  ${applied.written.filter(w => w.type === "note").length}`);
  console.log(`  · Summarized (daily, vb.):  ${applied.summarized.length} → tek ozet not`);
  console.log(`  · Archive manifest:         ${applied.archived.length}`);
  console.log(`  ⚠ ID collisions resolved:   ${applied.collisions.length}`);
  console.log(`  ⚠ Write errors:             ${applied.write_errors.length}`);
  console.log(`  ⚠ Defensive normalizations: ${applied.defensive_warnings.length}`);
  console.log(``);
  console.log(`Manifestler:`);
  console.log(`  + ${applied.migrated_manifest_path}`);
  console.log(`  + ${applied.archived_manifest_path}`);
  console.log(``);
  if (applied.write_errors.length > 0) {
    console.log(`Write errors detail:`);
    for (const e of applied.write_errors.slice(0, 10)) console.log(`  - ${e.source}: ${e.error}`);
    if (applied.write_errors.length > 10) console.log(`  ... (${applied.write_errors.length - 10} more)`);
    console.log(``);
  }
  if (applied.collisions.length > 0) {
    console.log(`Collisions resolved (suffix appended):`);
    for (const c of applied.collisions.slice(0, 5)) console.log(`  - ${c.original_id} → ${c.resolved_id}`);
    console.log(``);
  }
  console.log(`Sonraki: serif-brain rebuild-indexes && serif-brain analyze && serif-brain context && serif-brain doctor`);
  return 0;
}
