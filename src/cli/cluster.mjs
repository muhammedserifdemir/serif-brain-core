// serif-brain cluster [--threshold N] [--json]
// Bug'lari benzerlige gore gruplar — olasi ayni-kok-neden kumeleri.
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadObjects } from "../query/search.mjs";
import { clusterBugs, formatClusters } from "../query/cluster.mjs";

export async function clusterCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);

  const objects = loadObjects(brainRoot, {
    project: typeof args.flags.project_id === "string" ? args.flags.project_id : undefined,
  });
  const bugs = objects.filter((o) => o.frontmatter?.type === "bug");
  const threshold = args.flags.threshold ? parseInt(args.flags.threshold, 10) : 5;
  const clusters = clusterBugs(bugs, { threshold });

  if (args.flags.json) {
    console.log(JSON.stringify({ bugs: bugs.length, clusters: clusters.length, groups: clusters }, null, 2));
    return 0;
  }
  console.log(formatClusters(clusters));
  return 0;
}
