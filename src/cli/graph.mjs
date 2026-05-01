// serif-brain graph build | report
import { resolve, join } from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { buildGraph } from "../graph/build.mjs";
import { analyzeGraph } from "../graph/analyze.mjs";
import { writeGraphJson, writeGraphDot, writeAnalysisReport } from "../graph/serialize.mjs";
import { writeGraphViewer } from "../graph/viewer.mjs";

export async function graphCommand({ args, subcommand }) {
  const sub = subcommand[0];
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");

  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  loadConfig(brainRoot);

  if (sub === "build") {
    console.log(`[serif-brain graph build]`);
    console.log(`  Project: ${projectRoot}`);

    const graph = await buildGraph({ projectRoot, brainRoot });

    const jsonPath = writeGraphJson(graph, brainRoot);
    const dotPath = writeGraphDot(graph, brainRoot);

    console.log(``);
    console.log(`  Stats:`);
    for (const [k, v] of Object.entries(graph.stats)) {
      console.log(`    ${k.padEnd(20)} ${v}`);
    }
    console.log(``);
    console.log(`  + ${jsonPath}`);
    console.log(`  + ${dotPath}`);
    console.log(``);
    console.log(`  Sonraki: serif-brain graph report`);
    return 0;
  }

  if (sub === "report") {
    console.log(`[serif-brain graph report]`);
    const graphPath = join(brainRoot, "graph", "graph.json");
    if (!existsSync(graphPath)) {
      throw new Error(`graph.json missing — run 'serif-brain graph build' first`);
    }
    const graph = JSON.parse(readFileSync(graphPath, "utf8"));
    console.log(`  Loaded graph: ${graph.stats.node_count} nodes, ${graph.stats.edge_count} edges`);

    const analysis = analyzeGraph(graph);
    const reportPath = writeAnalysisReport(graph, analysis, brainRoot);

    console.log(``);
    console.log(`  Findings:`);
    console.log(`    1. Orphan files:                  ${analysis.orphan_files.length}`);
    console.log(`    2. Circular deps:                 ${analysis.circular_dependencies.length}`);
    console.log(`    3. God files:                     ${analysis.god_files.length}`);
    console.log(`    4. High-risk modules:             ${analysis.high_risk_modules.length}`);
    console.log(`    5. Many-open-bugs modules:        ${analysis.modules_with_many_open_bugs.length}`);
    console.log(`    6. Decisions w/o module:          ${analysis.decisions_without_module.length}`);
    console.log(`    7. Bugs w/o owner:                ${analysis.bugs_without_owner.length}`);
    console.log(`    8. Stale active decisions:        ${analysis.stale_active_decisions.length}`);
    console.log(`    9. Unresolved deps:               ${analysis.unresolved_dependencies.length}`);
    console.log(`   10. Routes w/o owner:              ${analysis.routes_without_owner.length}`);
    console.log(`   11. Components heavy imports:      ${analysis.components_with_too_many_imports.length}`);
    console.log(``);
    console.log(`  + ${reportPath}`);
    return 0;
  }

  if (sub === "viewer") {
    console.log(`[serif-brain graph viewer]`);
    const viewerPath = writeGraphViewer(brainRoot);
    console.log(`  + ${viewerPath}`);
    console.log(`  Open: file://${viewerPath}`);
    return 0;
  }

  console.error(`Kullanim: serif-brain graph <build|report|viewer>`);
  return 1;
}
