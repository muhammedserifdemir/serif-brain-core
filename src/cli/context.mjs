// serif-brain context [--module <name>]
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { loadAll } from "../reporter/loader.mjs";
import { writeContext } from "../context/compile.mjs";
import { applyClaudeMd } from "../context/claude-md.mjs";

export async function contextCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  const config = loadConfig(brainRoot);

  const moduleFilter = args.flags.module || null;
  if (moduleFilter && !config.valid_modules.includes(moduleFilter)) {
    console.error(`[serif-brain context] HATA: bilinmeyen module: ${moduleFilter}`);
    console.error(`  Gecerli moduller: ${config.valid_modules.join(", ")}`);
    return 1;
  }

  console.log(`[serif-brain context]`);
  console.log(`  Brain root: ${brainRoot}`);
  console.log(`  Scope: ${moduleFilter ? `module:${moduleFilter}` : "global"}`);
  console.log(``);

  const data = loadAll(brainRoot);
  console.log(`  Sources:`);
  console.log(`    canonical objects: ${data.canonical.objects.length}`);
  console.log(`    graph: ${data.graph?.stats?.files_scanned ?? "—"} files`);
  if (data.migration_status === "applied") {
    const w = data.migrated?.total_written ?? "?";
    console.log(`    migration:         applied (${w} canonical records)`);
  } else if (data.migration_status === "dry-run") {
    console.log(`    migration:         dry-run pending (${data.dry_run?.candidate_count ?? "?"} candidates)`);
  } else {
    console.log(`    migration:         none (no dry-run, no apply)`);
  }
  console.log(``);

  // Token butcesi (2026-07-22): varsayilan KISA. --full tam dokum, --budget N ust sinir.
  const full = args.flags.full === true || args.flags.full === "true";
  const budget = args.flags.budget != null ? Number(args.flags.budget) : undefined;
  const { mdPath, jsonPath, workPath } = writeContext({
    brainRoot, data, opts: { module: moduleFilter, full, budget },
  });

  // CLAUDE.md isaret blogu — .serif-brain/context/ altina yazilan dosyayi
  // Claude Code OKUMAZ; kok CLAUDE.md'ye kisa bir isaret koymak gerekir.
  if (args.flags["claude-md"]) {
    const r = applyClaudeMd(projectRoot);
    console.log(`  ${r.written ? "+" : "="} ${r.path}  (serif-brain blogu${r.written ? " yazildi" : " zaten guncel"})`);
  }

  console.log(`  + ${mdPath}`);
  console.log(`  + ${jsonPath}`);
  console.log(`  + ${workPath}`);
  console.log(``);
  console.log(`  Filters applied: done|closed|completed|rejected|archived → EXCLUDED`);
  if (data.migration_status === "applied") {
    console.log(`  Migration: applied`);
  } else if (data.migration_status === "dry-run") {
    console.log(`  Preview records: labeled (not canonical) — apply pending`);
  } else {
    console.log(`  Migration: none (no dry-run, no apply)`);
  }
  return 0;
}
