// serif-brain search — canonical store'da yapısal + tam-metin arama.
// Örnekler:
//   serif-brain search "auth flow" --type decision
//   serif-brain search --type bug --status open --priority high
//   serif-brain search "scorm" --json --limit 5
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { loadObjects, searchObjects, toResult } from "../query/search.mjs";

export async function searchCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  loadConfig(brainRoot);

  const f = args.flags;
  const text = (args._.slice(1).join(" ") || (typeof f.text === "string" ? f.text : "")).trim();
  const q = {
    text,
    type: typeof f.type === "string" ? f.type : undefined,
    status: typeof f.status === "string" ? f.status.split(",") : undefined,
    priority: typeof f.priority === "string" ? f.priority.split(",") : undefined,
    module: typeof f.module === "string" ? f.module : undefined,
    project: typeof f.project_id === "string" ? f.project_id : undefined,
    owner: typeof f.owner === "string" ? f.owner : undefined,
    tag: typeof f.tag === "string" ? f.tag : undefined,
    updated_since: typeof f.since === "string" ? f.since : undefined,
    limit: f.limit ? parseInt(f.limit, 10) : 20,
  };

  const objects = loadObjects(brainRoot, { project: q.project });
  const hits = searchObjects(objects, q);
  const results = hits.map((o) => toResult(o, { snippet: true }));

  if (f.json) {
    console.log(JSON.stringify({ count: results.length, query: q, results }, null, 2));
    return 0;
  }

  console.log(`[serif-brain search] ${results.length} sonuç${text ? ` — "${text}"` : ""}`);
  if (results.length === 0) {
    console.log(`  (eşleşme yok)`);
    return 0;
  }
  for (const r of results) {
    const mod = r.module.length ? ` · ${r.module.join(",")}` : "";
    const pr = r.priority ? ` · ${r.priority}` : "";
    console.log(`\n  ${r.type.toUpperCase()} ${r.id}`);
    console.log(`    ${r.title}`);
    console.log(`    ${r.status}${pr}${mod} · ${r.updated_at ? r.updated_at.slice(0, 10) : "?"}`);
    if (r.snippet) console.log(`    ${r.snippet.slice(0, 120)}${r.snippet.length > 120 ? "…" : ""}`);
  }
  return 0;
}
