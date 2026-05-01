// serif-brain add bug | add decision
// Minimal yapi — yarat + dosyaya yaz. Gelecek fazlarda interaktif TTY eklenebilir.
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { writeObject, makeId, slugify, objectPath } from "../markdown/object.mjs";

const TYPE_DEFAULTS = {
  bug: {
    status: "open",
    priority: "medium",
    severity: "medium",
    body: `\n## Etki\n\n## Reproduce\n1. \n\n## Beklenen\n\n## Gozlemlenen\n\n## Hipotez / Analiz\n\n## Next Action\n`
  },
  decision: {
    status: "active",
    priority: "medium",
    body: `\n## Baglam\n\n## Karar\n\n## Sonuclari (Consequences)\n- \n\n## Reddedilen Alternatifler\n- \n`
  }
};

export async function addCommand({ args, subcommand }) {
  const type = subcommand[0];
  if (!type || !TYPE_DEFAULTS[type]) {
    console.error(`[serif-brain add] kullanim: serif-brain add <bug|decision> --title "..." [--module testx] [--priority high]`);
    return 1;
  }

  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  loadConfig(brainRoot);

  const title = args.flags.title;
  if (!title) {
    console.error(`[serif-brain add ${type}] --title zorunlu`);
    return 1;
  }

  const project = args.flags.project_id || "serif-platform";
  const module = args.flags.module || "unknown";
  const priority = args.flags.priority || TYPE_DEFAULTS[type].priority;
  const severity = args.flags.severity || priority;
  const status = args.flags.status || TYPE_DEFAULTS[type].status;
  const tags = args.flags.tags ? args.flags.tags.split(",").map(s => s.trim()) : [];

  const now = new Date();
  const id = args.flags.id || makeId(type, title, now);

  // ─── Overwrite protection (Faz 3.1) ───
  const targetPath = objectPath(brainRoot, project, type, id);
  if (existsSync(targetPath) && !args.flags.force) {
    let suffix = 2;
    let altId = `${id}-${suffix}`;
    while (existsSync(objectPath(brainRoot, project, type, altId)) && suffix < 100) {
      suffix++;
      altId = `${id}-${suffix}`;
    }
    console.error(`[serif-brain add ${type}] HATA: ID zaten var.`);
    console.error(`  Mevcut: ${targetPath}`);
    console.error(``);
    console.error(`  Secenekler:`);
    console.error(`    1) Alternatif ID kullan:  --id ${altId}`);
    console.error(`    2) Farkli baslik dene:    (slug degisir)`);
    console.error(`    3) Mevcudu uzerine yaz:   --force  (DIKKAT: kalici)`);
    return 1;
  }

  const fm = {
    id,
    type,
    project,
    module,
    title,
    status,
    priority,
    ...(type === "bug" ? { severity, owner: "" } : {}),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    source: { kind: "manual", path: "" },
    relations: { files: [], decisions: [], bugs: [], modules: Array.isArray(module) ? module : [module] },
    tags,
    ...(type === "bug" ? { summary: title } : {})
  };

  const body = `\n# ${title}\n${TYPE_DEFAULTS[type].body}`;
  const result = writeObject(brainRoot, fm, body);

  console.log(`[serif-brain add ${type}]`);
  console.log(`  + ${result.path}`);
  console.log(`    id: ${id}`);
  console.log(`    status: ${status}, priority: ${priority}, module: ${module}`);
  if (result.validation.warnings.length > 0) {
    for (const w of result.validation.warnings) console.log(`    ⚠ ${w}`);
  }
  console.log(``);
  console.log(`  Sonraki: serif-brain rebuild-indexes`);
  return 0;
}
