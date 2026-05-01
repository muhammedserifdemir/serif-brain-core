// serif-brain analyze — tum Faz 6 raporlarini uretir.
import { resolve, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { loadAll } from "../reporter/loader.mjs";
import { writeHealthReport } from "../reporter/health.mjs";
import { writeBugsReport } from "../reporter/bugs.mjs";
import { writeDecisionsReport } from "../reporter/decisions.mjs";
import { writeArchitectureReport } from "../reporter/architecture.mjs";
import { writeStaleItemsReport } from "../reporter/stale-items.mjs";
import { writeDuplicatesReport } from "../reporter/duplicates.mjs";
import { writeMigrationReadinessReport } from "../reporter/migration-readiness.mjs";

export async function analyzeCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot}`);
  loadConfig(brainRoot);

  const reportsDir = join(brainRoot, "reports");
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

  console.log(`[serif-brain analyze]`);
  console.log(`  Brain root: ${brainRoot}`);
  console.log(``);
  console.log(`Loading data sources...`);
  const data = loadAll(brainRoot);
  console.log(`  Canonical objects: ${data.canonical.objects.length} (errors: ${data.canonical.errors.length})`);
  console.log(`  Graph: ${data.graph?.stats?.node_count ?? "—"} nodes${data.graph ? "" : " (missing)"}`);
  console.log(`  Dry-run: ${data.dry_run?.candidate_count ?? "—"} candidates${data.dry_run ? "" : " (missing)"}`);
  console.log(``);

  console.log(`Writing reports:`);
  const written = [];
  written.push(writeHealthReport(data, reportsDir));            console.log(`  + health.md`);
  written.push(writeBugsReport(data, reportsDir));              console.log(`  + bugs.md`);
  written.push(writeDecisionsReport(data, reportsDir));         console.log(`  + decisions.md`);
  written.push(writeArchitectureReport(data, reportsDir));      console.log(`  + architecture.md`);
  written.push(writeStaleItemsReport(data, reportsDir));        console.log(`  + stale-items.md`);
  written.push(writeDuplicatesReport(data, reportsDir));        console.log(`  + duplicates.md`);
  written.push(writeMigrationReadinessReport(data, reportsDir));console.log(`  + migration-readiness.md`);

  console.log(``);
  console.log(`  Total: ${written.length} reports written under .serif-brain/reports/`);
  console.log(``);
  console.log(`  Sonraki: review reports + Faz 7 (context compiler) onayi`);
  return 0;
}
