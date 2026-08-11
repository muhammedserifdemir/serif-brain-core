// serif-brain add bug | decision | plan | record
// Ince CLI sarmalayici — yazma mantigi markdown/write-ops.mjs'te (MCP ile ORTAK).
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { createObject, TYPE_DEFAULTS } from "../markdown/write-ops.mjs";

export async function addCommand({ args, subcommand }) {
  const type = subcommand[0];
  if (!type || !TYPE_DEFAULTS[type]) {
    console.error(`[serif-brain add] kullanim: serif-brain add <bug|decision|plan|record> --title "..." [--module testx] [--priority high] [--files a,b]`);
    console.error(`  plan   = yol haritasi/faz plani (status: active dogar, plans/ altina yazilir)`);
    console.error(`  record = yapilmis is kaydi (status: done dogar, decisions/ altina yazilir)`);
    return 1;
  }

  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  const config = loadConfig(brainRoot);

  if (!args.flags.title) {
    console.error(`[serif-brain add ${type}] --title zorunlu`);
    return 1;
  }

  const r = createObject({
    brainRoot, projectRoot, config, type,
    title: args.flags.title,
    module: args.flags.module,
    priority: args.flags.priority,
    severity: args.flags.severity,
    status: args.flags.status,
    tags: args.flags.tags,
    files: typeof args.flags.files === "string"
      ? args.flags.files.split(",").map((s) => s.trim()).filter(Boolean)
      : null,
    projectId: args.flags.project_id || null,
    id: args.flags.id || null,
    force: !!args.flags.force,
  });

  if (!r.ok) {
    console.error(`[serif-brain add ${type}] HATA: ${r.error}`);
    if (r.suggestId) {
      console.error(``);
      console.error(`  Secenekler:`);
      console.error(`    1) Alternatif ID kullan:  --id ${r.suggestId}`);
      console.error(`    2) Farkli baslik dene:    (slug degisir)`);
      console.error(`    3) Mevcudu uzerine yaz:   --force  (DIKKAT: kalici)`);
    }
    return 1;
  }

  if (r.hint) console.error(`[serif-brain add] IPUCU: ${r.hint}`);
  console.log(`[serif-brain add ${type}]`);
  console.log(`  + ${r.path}`);
  console.log(`    id: ${r.id}`);
  console.log(`    status: ${r.status}, priority: ${r.priority}, module: ${r.module}`);
  if (r.autoFilled) {
    console.log(`  relations.files: ${r.autoFilled} dosya git'ten otomatik dolduruldu (--files ile ezebilirsin)`);
  }
  for (const w of r.warnings) console.log(`    ⚠ ${w}`);
  console.log(``);
  console.log(`  Sonraki: serif-brain rebuild-indexes`);
  return 0;
}
