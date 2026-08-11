// serif-brain close <id> [--commit <sha>] [--note "..."] [--project_id <name>]
// Ince CLI sarmalayici — kapatma mantigi markdown/write-ops.mjs'te (MCP ile ORTAK).
//
// --project_id ARTIK ZORUNLU DEGIL: id'yi gercekten iceren proje diskten
// bulunur. Eskiden objeyi icermeyen BOS bir proje dizini bile "coklu proje
// var, --project_id ekle" hatasi verdiriyordu.
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { closeObject } from "../markdown/write-ops.mjs";

export async function closeCommand({ args, subcommand }) {
  const id = subcommand[0];
  if (!id || args.flags.help || args.flags.h) {
    console.error(`[serif-brain close] kullanim: serif-brain close <id> [--commit <sha>] [--note "..."] [--project_id <name>]`);
    console.error(`  status -> done, completed_at + updated_at = bugun.`);
    console.error(`  --note verilirse body sonuna "## Tamamlanma (YYYY-MM-DD)" basligi eklenir.`);
    console.error(`  --project_id yalniz id BIRDEN FAZLA projede varsa gerekir.`);
    return id ? 0 : 1;
  }

  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  loadConfig(brainRoot);

  const r = closeObject({
    brainRoot, id,
    projectId: args.flags.project_id || null,
    commit: args.flags.commit || null,
    note: args.flags.note || null,
    force: !!args.flags.force,
  });

  if (!r.ok) {
    console.error(`[serif-brain close] ${r.error}`);
    return 1;
  }
  if (r.noop) {
    console.log(`[serif-brain close] ${id} zaten ${r.status} (force icin --force)`);
    return 0;
  }

  console.log(`[serif-brain close] ${id}`);
  console.log(`  ✓ status: ${r.prevStatus} → ${r.status}`);
  console.log(`  ✓ completed_at: ${r.completed_at}`);
  if (r.commit) console.log(`  ✓ commit: ${r.commit}`);
  if (r.noteAppended) console.log(`  ✓ note appended`);
  for (const w of r.warnings) console.log(`  ⚠ ${w}`);
  console.log(``);
  console.log(`  Sonraki: serif-brain rebuild-indexes && serif-brain context`);
  return 0;
}
