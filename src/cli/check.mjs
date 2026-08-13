// serif-brain check <dosya> [--json]
// PostEdit graf saglik kontrolu: katman ihlali + dongu + god-file (tek dosya).
import { resolve, join, relative, isAbsolute } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { resolveFileNode } from "../query/impact.mjs";
import { checkFile, formatCheck } from "../query/check.mjs";
import { posixYol } from "../util/yol.mjs";

export async function checkCommand({ args, subcommand }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);

  const graphPath = join(brainRoot, "graph", "graph.json");
  if (!existsSync(graphPath)) {
    if (!args.flags.json) console.error(`[serif-brain check] graph.json yok — once: serif-brain graph build`);
    return 0; // hook-dostu: bloklamaz
  }
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));

  const target = subcommand[0] || (typeof args.flags.file === "string" ? args.flags.file : null);
  if (!target) {
    console.error(`[serif-brain check] kullanim: serif-brain check <dosya> [--json]`);
    return 1;
  }
  const abs = isAbsolute(target) ? target : resolve(projectRoot, target);
  const relPath = posixYol(relative(projectRoot, abs)) || target;
  const node = resolveFileNode(graph, relPath);
  if (!node) {
    if (args.flags.json) console.log(JSON.stringify({ found: false, file: relPath }));
    else console.log(`[serif-brain check] '${relPath}' grafta yok (yeni dosya? graph build guncelle).`);
    return 0;
  }

  const config = loadConfig(brainRoot);
  const c = checkFile(graph, node.id, { rules: config?.layer_rules || [], god_threshold: config?.god_threshold, god_file_exempt: config?.god_file_exempt });

  if (args.flags.json) {
    console.log(JSON.stringify(c, null, 2));
    return c.ok ? 0 : 2;
  }
  console.log(formatCheck(c));
  return c.ok ? 0 : 2;
}
