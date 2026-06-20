// serif-brain hotspot [--days N] [--limit N] [--json]
// Tehlike bolgesi: churn × merkezilik + modul bug yogunlugu fuzyonu.
import { resolve, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadObjects, modulesOf } from "../query/search.mjs";
import { getRecentCommits } from "../query/git-activity.mjs";
import { computeHotspots, formatHotspots } from "../query/hotspot.mjs";

const OPEN_BUG = new Set(["open", "active", "in_progress", "blocked"]);

export async function hotspotCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);

  const graphPath = join(brainRoot, "graph", "graph.json");
  if (!existsSync(graphPath)) {
    console.error(`[serif-brain hotspot] graph.json yok — once: serif-brain graph build`);
    return 1;
  }
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  const days = parseInt(args.flags.days, 10) || 30;
  const limit = args.flags.limit ? parseInt(args.flags.limit, 10) : 15;

  // churn: son N gunde her dosyaya degen commit sayisi
  const churn = new Map();
  for (const c of getRecentCommits(projectRoot, days)) {
    for (const f of c.files || []) churn.set(f, (churn.get(f) || 0) + 1);
  }

  // acik bug yogunlugu (modul basina)
  const openBugsByModule = new Map();
  for (const o of loadObjects(brainRoot)) {
    const fm = o.frontmatter || {};
    if (fm.type !== "bug" || !OPEN_BUG.has(fm.status)) continue;
    for (const m of modulesOf(fm)) openBugsByModule.set(m, (openBugsByModule.get(m) || 0) + 1);
  }

  const rows = computeHotspots(graph, { churn, openBugsByModule, limit });

  if (args.flags.json) {
    console.log(JSON.stringify({ days, count: rows.length, hotspots: rows }, null, 2));
    return 0;
  }
  console.log(formatHotspots(rows, { days }));
  return 0;
}
