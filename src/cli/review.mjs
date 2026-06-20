// serif-brain review [--ref REF] [--json]
// Pre-commit yapisal kapi: degisen dosyalar uzerinde check (katman/dongu/god) +
// lint (bug imzalari). Faz: Bug Signatures — "commit'ten once neyi bozdum?".
import { resolve, join, relative } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { getChangedFiles } from "../query/git-activity.mjs";
import { resolveFileNode } from "../query/impact.mjs";
import { checkFile } from "../query/check.mjs";
import { lintContent } from "../query/signatures.mjs";
import { readFileSafe } from "../scanner/scan-files.mjs";

const SRC_RE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/;

export async function reviewCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);

  const config = loadConfig(brainRoot);
  const rules = config?.layer_rules || [];
  const signatures = config?.bug_signatures || [];

  const graphPath = join(brainRoot, "graph", "graph.json");
  const graph = existsSync(graphPath) ? JSON.parse(readFileSync(graphPath, "utf8")) : null;

  const ref = typeof args.flags.ref === "string" ? args.flags.ref : "HEAD";
  const changed = getChangedFiles(projectRoot, ref).filter((f) => SRC_RE.test(f));

  const report = [];
  for (const rel of changed) {
    const abs = join(projectRoot, rel);
    const issues = [];

    if (graph) {
      const node = resolveFileNode(graph, rel);
      if (node) {
        const c = checkFile(graph, node.id, { rules, god_threshold: config?.god_threshold });
        if (!c.ok) for (const i of c.issues) issues.push({ kind: "graph", detail: i });
      }
    }
    const findings = lintContent(rel, readFileSafe(abs), signatures);
    for (const f of findings) issues.push({ kind: "signature", detail: `${f.name} @${f.line}: ${f.message}`, severity: f.severity });

    if (issues.length) report.push({ file: rel, issues });
  }

  if (args.flags.json) {
    console.log(JSON.stringify({ ref, changed: changed.length, flagged: report.length, report }, null, 2));
    return report.length ? 2 : 0;
  }

  if (!changed.length) { console.log(`[serif-brain review] degisen kaynak dosya yok (ref: ${ref}).`); return 0; }
  if (!report.length) { console.log(`[serif-brain review] ✓ ${changed.length} degisen dosya — yapisal/imza sorunu yok.`); return 0; }

  console.log(`[serif-brain review] ⚠ ${report.length}/${changed.length} degisen dosyada sorun`);
  for (const r of report) {
    console.log(`\n  ${r.file}`);
    for (const i of r.issues) console.log(`    ✗ [${i.kind}${i.severity ? `:${i.severity}` : ""}] ${i.detail}`);
  }
  return 2; // CI: non-zero
}
