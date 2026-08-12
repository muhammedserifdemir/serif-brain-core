// serif-brain risk <dosya> [--days N] [--json]
// Tek dosya icin edit-ani risk skoru: yapisal + hafiza + imza fuzyonu.
import { resolve, join, relative, isAbsolute } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { loadObjects } from "../query/search.mjs";
import { compileTouch } from "../query/touch.mjs";
import { computeImpact, resolveFileNode } from "../query/impact.mjs";
import { lintContent } from "../query/signatures.mjs";
import { ownerOfConfigured } from "../scanner/module-owner.mjs";
import { getRecentCommits } from "../query/git-activity.mjs";
import { readFileSafe } from "../scanner/scan-files.mjs";
import { scoreRisk, formatRisk } from "../query/risk.mjs";
import { posixYol } from "../util/yol.mjs";

export async function riskCommand({ args, subcommand }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);

  const target = subcommand[0] || (typeof args.flags.file === "string" ? args.flags.file : null);
  if (!target) {
    console.error(`[serif-brain risk] kullanim: serif-brain risk <dosya> [--days N] [--json]`);
    return 1;
  }
  const abs = isAbsolute(target) ? target : resolve(projectRoot, target);
  const relPath = posixYol(relative(projectRoot, abs)) || target;
  const days = parseInt(args.flags.days, 10) || 30;
  const config = loadConfig(brainRoot);

  // churn (bu dosyaya degen commit sayisi)
  let churn = 0;
  for (const c of getRecentCommits(projectRoot, days)) if ((c.files || []).includes(relPath)) churn++;

  // dependents (graf varsa)
  let dependents = 0;
  const graphPath = join(brainRoot, "graph", "graph.json");
  if (existsSync(graphPath)) {
    const graph = JSON.parse(readFileSync(graphPath, "utf8"));
    const node = resolveFileNode(graph, relPath);
    if (node) dependents = computeImpact(graph, node.id).direct_dependents.length;
  }

  // hafiza (modul acik bug + bu dosyaya bagli bug gecmisi)
  const module = ownerOfConfigured(relPath, config);
  const objects = loadObjects(brainRoot);
  const mem = compileTouch(objects, { relPath, module });
  const moduleOpenBugs = mem.module_bugs.filter((b) => !b.closed).length;
  const fileBugHistory = mem.file_hits.filter((h) => h.type === "bug").length;

  // imza eslesmeleri (dosya icerigi)
  const sigHits = lintContent(relPath, readFileSafe(abs), config?.bug_signatures || []).length;

  const r = scoreRisk({
    churn,
    dependents,
    module_open_bugs: moduleOpenBugs,
    file_bug_history: fileBugHistory,
    signature_hits: sigHits,
  });

  if (args.flags.json) {
    console.log(JSON.stringify({ file: relPath, module, ...r }, null, 2));
    return 0;
  }
  console.log(formatRisk(r, { file: relPath }));
  return 0;
}
