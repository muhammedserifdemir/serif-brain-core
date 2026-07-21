// serif-brain add bug | add decision | add record
// Minimal yapi — yarat + dosyaya yaz. Gelecek fazlarda interaktif TTY eklenebilir.
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { loadConfig } from "../markdown/schema.mjs";
import { writeObject, makeId, slugify, objectPath } from "../markdown/object.mjs";

// Baslik "is bitti" diyorsa 'decision' bayat bir aktif karar uretir — ipucu bas.
const DONE_TITLE_RE = /\b(KAPANDI|TAMAMLANDI|BITTI|BİTTİ|GECTI|GEÇTİ|UYGULANDI|DOGRULANDI|DOĞRULANDI|COZULDU|ÇÖZÜLDÜ)\b/i;

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
  },
  // record = yapilmis isin kaydi. 'done' DOGAR — kapatilmayi beklemez.
  record: {
    status: "done",
    priority: "low",
    body: `\n## Ne yapildi\n\n## Neden\n\n## Sonuc / Kanit\n- \n`
  }
};

// --files verilmediyse calisma agacindaki degisen dosyalari relations.files'a
// doldur. Git yoksa/bos donerse sessizce bos dizi — brain git-bagimsiz calismali.
function gitTouchedFiles(projectRoot, limit = 12) {
  const files = new Set();
  for (const cmd of ["diff --name-only HEAD", "diff --cached --name-only"]) {
    try {
      const out = execSync(`git -C "${projectRoot}" ${cmd}`, {
        encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
      });
      for (const f of out.split("\n").map((s) => s.trim()).filter(Boolean)) {
        if (f.startsWith(".serif-brain/")) continue;
        files.add(f);
      }
    } catch { /* git yok / repo degil / HEAD yok — yoksay */ }
  }
  return [...files].slice(0, limit);
}

export async function addCommand({ args, subcommand }) {
  const type = subcommand[0];
  if (!type || !TYPE_DEFAULTS[type]) {
    console.error(`[serif-brain add] kullanim: serif-brain add <bug|decision|record> --title "..." [--module testx] [--priority high] [--files a,b]`);
    console.error(`  record = yapilmis is kaydi (status: done dogar, decisions/ altina yazilir)`);
    return 1;
  }

  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  const config = loadConfig(brainRoot);

  const title = args.flags.title;
  if (!title) {
    console.error(`[serif-brain add ${type}] --title zorunlu`);
    return 1;
  }

  // Default project = config'in aktif projesi (eskiden "serif-platform"a
  // hardcode'tu; bu yüzden add her brain'de yanlış projeye yazıyordu).
  // Öncelik: --project_id flag > config aktif proje > ilk proje > eski fallback.
  const configProjects = config?.projects || [];
  const defaultProject =
    configProjects.find((p) => p.active)?.id ||
    configProjects[0]?.id ||
    "serif-platform";
  const project = args.flags.project_id || defaultProject;
  const module = args.flags.module || "unknown";
  const priority = args.flags.priority || TYPE_DEFAULTS[type].priority;
  const severity = args.flags.severity || priority;
  const status = args.flags.status || TYPE_DEFAULTS[type].status;
  const tags = args.flags.tags ? args.flags.tags.split(",").map(s => s.trim()) : [];

  // Baslik tamamlanma bildiriyorsa kullaniciyi 'record'a yonlendir — davranis
  // DEGISMEZ, sadece stderr'e ipucu.
  if (type === "decision" && DONE_TITLE_RE.test(title)) {
    console.error(`[serif-brain add] IPUCU: baslik tamamlanma bildiriyor — 'add record' bunu status:done olarak yazar (bayat "aktif karar" uretmez).`);
  }

  // relations.files: --files varsa onu kullan, yoksa git'ten otomatik doldur.
  const explicitFiles = typeof args.flags.files === "string"
    ? args.flags.files.split(",").map(s => s.trim()).filter(Boolean)
    : null;
  const autoFiles = explicitFiles ? [] : gitTouchedFiles(projectRoot);
  const files = explicitFiles || autoFiles;

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
    relations: { files, decisions: [], bugs: [], modules: Array.isArray(module) ? module : [module] },
    tags,
    ...(type === "bug" ? { summary: title } : {})
  };

  const body = `\n# ${title}\n${TYPE_DEFAULTS[type].body}`;
  const result = writeObject(brainRoot, fm, body);

  console.log(`[serif-brain add ${type}]`);
  console.log(`  + ${result.path}`);
  console.log(`    id: ${id}`);
  console.log(`    status: ${status}, priority: ${priority}, module: ${module}`);
  if (!explicitFiles && autoFiles.length > 0) {
    console.log(`  relations.files: ${autoFiles.length} dosya git'ten otomatik dolduruldu (--files ile ezebilirsin)`);
  }
  if (result.validation.warnings.length > 0) {
    for (const w of result.validation.warnings) console.log(`    ⚠ ${w}`);
  }
  console.log(``);
  console.log(`  Sonraki: serif-brain rebuild-indexes`);
  return 0;
}
