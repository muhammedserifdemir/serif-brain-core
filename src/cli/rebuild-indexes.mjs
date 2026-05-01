// serif-brain rebuild-indexes
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { listAllObjects, listProjects } from "../markdown/object.mjs";
import { buildBacklinks } from "../markdown/backlinks.mjs";
import { detectHealth } from "../markdown/health.mjs";
import {
  ensureIndexesDir,
  buildProjectIndex,
  buildModuleIndex,
  buildBugIndex,
  buildDecisionIndex,
  buildTagIndex,
  buildBacklinkIndex,
  buildHealthReport
} from "../markdown/indexes.mjs";

export async function rebuildIndexesCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");

  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }

  console.log(`[serif-brain rebuild-indexes]`);
  console.log(`  Brain root: ${brainRoot}`);

  loadConfig(brainRoot);

  // Tum projelerden tum objeleri topla
  const projects = listProjects(brainRoot);
  let allObjects = [];
  for (const project of projects) {
    const objs = listAllObjects(brainRoot, project);
    allObjects = allObjects.concat(objs);
  }

  console.log(`  Projects: ${projects.length}, Objects: ${allObjects.length}`);

  const validObjects = allObjects.filter(o => !o.error);
  const errored = allObjects.filter(o => o.error);
  if (errored.length > 0) {
    console.log(``);
    console.log(`  ⚠ ${errored.length} object(s) failed to parse:`);
    for (const e of errored) console.log(`    - ${e.file_path}: ${e.error}`);
  }

  const { backlinks, broken } = buildBacklinks(validObjects);
  const health = detectHealth(validObjects, backlinks);

  const indexesDir = ensureIndexesDir(brainRoot);

  console.log(``);
  console.log(`  Writing indexes:`);
  buildProjectIndex(validObjects, indexesDir);    console.log(`    + project-index.md`);
  buildModuleIndex(validObjects, indexesDir);     console.log(`    + module-index.md`);
  buildBugIndex(validObjects, indexesDir);        console.log(`    + bug-index.md`);
  buildDecisionIndex(validObjects, indexesDir);   console.log(`    + decision-index.md`);
  buildTagIndex(validObjects, indexesDir);        console.log(`    + tag-index.md`);
  buildBacklinkIndex(validObjects, backlinks, broken, indexesDir);
  console.log(`    + backlink-index.md`);
  buildHealthReport(health, indexesDir);          console.log(`    + stale-report.md`);

  console.log(``);
  console.log(`  Backlinks: ${backlinks.size} target(s), ${broken.length} broken reference(s)`);
  console.log(`  Health: ${health.stale.length} stale, ${health.orphan.length} orphan, ${health.duplicates.length} duplicate group(s)`);
  console.log(``);
  console.log(`  ✓ rebuild complete`);
  return 0;
}
