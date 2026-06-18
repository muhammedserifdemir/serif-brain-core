// serif-brain related <id> — bir objeye otomatik keşfedilen ilişkili objeler.
// Örnek: serif-brain related decision-20260617-... --limit 8
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { loadObjects } from "../query/search.mjs";
import { findRelated } from "../query/related.mjs";

export async function relatedCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  loadConfig(brainRoot);

  const id = args._[1] || (typeof args.flags.id === "string" ? args.flags.id : null);
  if (!id) {
    console.error(`Kullanim: serif-brain related <obje-id> [--limit N] [--json]`);
    return 1;
  }
  const limit = args.flags.limit ? parseInt(args.flags.limit, 10) : 10;
  const all = loadObjects(brainRoot);
  const target = all.find((o) => o.frontmatter?.id === id);
  if (!target) {
    console.error(`Obje bulunamadı: ${id}`);
    return 1;
  }

  const related = findRelated(target, all, { limit });

  if (args.flags.json) {
    console.log(JSON.stringify({ id, count: related.length, related }, null, 2));
    return 0;
  }

  console.log(`[serif-brain related] ${id}`);
  console.log(`  "${target.frontmatter.title}"`);
  if (related.length === 0) { console.log(`  (ilişkili obje bulunamadı)`); return 0; }
  console.log(`  ${related.length} ilişkili obje (otomatik keşif):`);
  for (const r of related) {
    console.log(`\n  [${r.score}] ${r.type.toUpperCase()} ${r.id}`);
    console.log(`    ${r.title}`);
    console.log(`    └ ${r.reasons.join(" · ")}`);
  }
  return 0;
}
