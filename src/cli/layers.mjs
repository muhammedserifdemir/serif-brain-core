// serif-brain layers [--json]
// config.yaml 'layer_rules'a gore mimari katman ihlallerini listeler.
import { resolve, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { findLayerViolations, formatLayers } from "../query/layers.mjs";

export async function layersCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);

  const graphPath = join(brainRoot, "graph", "graph.json");
  if (!existsSync(graphPath)) {
    console.error(`[serif-brain layers] graph.json yok — once: serif-brain graph build`);
    return 1;
  }
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  const config = loadConfig(brainRoot);
  const rules = config?.layer_rules || [];
  const violations = findLayerViolations(graph, rules);

  if (args.flags.json) {
    console.log(JSON.stringify({ rule_count: rules.length, count: violations.length, violations }, null, 2));
    return violations.length ? 2 : 0;
  }
  console.log(formatLayers(violations, { ruleCount: rules.length }));
  return violations.length ? 2 : 0; // CI: ihlal varsa non-zero
}
