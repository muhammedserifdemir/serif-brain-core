// serif-brain init — .serif-brain/ yapisini olustur
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { detectStoreEngine } from "../store/engine.mjs";
import { planSkillSync, applySkillSync, listPackageSkills } from "../skills/sync.mjs";
import { initSonrasiPanel } from "../dashboard/launch.mjs";
import { applyHookInstall } from "../hooks/install.mjs";
import { applyClaudeMd } from "../context/claude-md.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = resolve(HERE, "../../templates");

const PROJECT_SUBDIRS = ["bugs", "decisions", "notes", "modules", "sessions", "sprints"];
const ROOT_LAYOUT_DIRS = ["graph", "reports", "context", "indexes", "archive-index"];

const DEFAULT_PROJECTS = [
  { id: "serif-platform", active: true,  migrate: true,  description: "Flagship: SerifX 360 Electron desktop suite" },
  { id: "mevzuat-ai",     active: false, migrate: false, description: "Archive-only — pre-multi-project schema" },
  { id: "serifLms",       active: false, migrate: false, description: "Archive-only" },
  { id: "seriftech-packages", active: false, migrate: false, description: "Archive-only — npm packages" }
];

function buildDirLayout(projects) {
  const projectDirs = projects
    .filter(p => p.active)
    .flatMap(p => PROJECT_SUBDIRS.map(sub => `objects/projects/${p.id}/${sub}`));
  return [...projectDirs, ...ROOT_LAYOUT_DIRS];
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

// package.json "name" varsa onu, yoksa klasor adini kullanarak proje id'sini
// kurulu klasore gore otomatik turetir (her yeni kurulumda elle --name gerekmesin diye).
function deriveDefaultProjectId(projectRoot) {
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
    if (typeof pkg.name === "string" && pkg.name.trim()) return slugify(pkg.name);
  } catch {
    // package.json yok/parse edilemedi — klasor adina dus
  }
  return slugify(basename(projectRoot));
}

// Bu paketin kendi flagship reposu (serif-platform) icin eski 4-projeli
// bootstrap listesi (legacy migration icin) korunur. Baska HERHANGI bir
// klasorde 'serif-brain init' calistirinca bu liste asla varsayilan OLMAMALI —
// eskiden oyleydi ve her yeni kurulumda yanlislikla "serif-platform" projesi
// olusuyordu.
function isFlagshipSelfHost(projectRoot) {
  return deriveDefaultProjectId(projectRoot) === "serif-platform";
}

function resolveProjects(args, projectRoot) {
  // --name ve --project_id es anlamli (--name onceden sessizce yutuluyordu)
  const explicitId = args.flags.name || args.flags.project_id;
  if (!explicitId && isFlagshipSelfHost(projectRoot)) return DEFAULT_PROJECTS;

  const customId = explicitId || deriveDefaultProjectId(projectRoot);
  const description =
    typeof args.flags.description === "string"
      ? args.flags.description
      : `Custom project: ${customId}`;
  return [{ id: customId, active: true, migrate: false, description }];
}

// serif-platform'a ozgu liste — yalniz default (isimsiz) init'te kullanilir
const VALID_MODULES = [
  "contentx", "presentx", "animatorx", "studiox", "testx",
  "dashboard", "auth", "billing", "shared", "infra", "unknown"
];

// Custom (--name / --project_id) init'lerde notr baslangic listesi
const NEUTRAL_MODULES = ["core", "ui", "api", "pipeline", "infra", "docs", "unknown"];

const VALID_STATUS = ["queued", "open", "active", "in_progress", "blocked", "done", "rejected", "archived"];
const VALID_PRIORITY = ["critical", "high", "medium", "low"];
// Bug severity'nin kendi ölçeği (priority'den ayrı). Tanımlı değilse şema
// doğrulaması valid_priority'ye düşer (geriye-uyumlu).
const VALID_SEVERITY = ["critical", "high", "medium", "low"];
const CONTEXT_EXCLUDED_STATUS = ["done", "rejected", "archived"];

// Klasor yapisindan modul eslemesi turet.
//
// NEDEN: `module_paths` config'e YORUMLU yaziliyordu. Sonucu temiz oda
// testinde olculdu: yeni bir projede `api` moduluine bug acilip
// `guard src/api/users.js` calistirildiginda kapi "Bilinen kisit/risk yok"
// diyordu — urunun ANA VAADI varsayilan kurulumda sessizce calismiyordu.
// Iki satir elle eklenince "DIKKAT · 1 acik bug" oldu.
//
// Kesif icin yorumlu ornek yeterli DEGIL: kullanici o satiri gormeden once
// aracin ise yaramadigina karar verir. Tahmin yanlissa duzeltmesi ucuz
// (config'i elle degistir); tahmin YOKSA arac hic konusmaz.
function deriveModulePaths(projectRoot) {
  const adaylar = ["src", "app", "lib", "packages", "apps", "modules"];
  const disla = new Set(["node_modules", "dist", "build", "out", ".git", "coverage", "__tests__", "test", "tests"]);
  const esleme = [];
  for (const kok of adaylar) {
    const tam = join(projectRoot, kok);
    if (!existsSync(tam)) continue;
    let alt = [];
    try {
      alt = readdirSync(tam, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !disla.has(e.name) && !e.name.startsWith("."))
        .map((e) => e.name).sort();
    } catch { continue; }
    // Alt klasor yoksa kokun kendisi tek modul olsun (duz src/ yerlesimi).
    if (!alt.length) esleme.push([`${kok}/`, slugify(kok)]);
    else for (const ad of alt) esleme.push([`${kok}/${ad}/`, slugify(ad)]);
  }
  // Tek bir esleme bile yoksa yorumlu ornege dus (bos harita parser'i kirar).
  return esleme.slice(0, 40);
}

function buildConfig(projectRoot, storeEngine, projects, { custom = false } = {}) {
  const hasMigrating = projects.some(p => p.migrate);
  const modulePaths = deriveModulePaths(projectRoot);
  // valid_modules turetilen modullerle ayni kumeden gelsin; yoksa `add --module api`
  // "bilinmeyen modul" uyarisi verir ve kullanici iki ayri yeri elle esitler.
  const turetilen = [...new Set(modulePaths.map(([, m]) => m))].sort();
  const modules = custom
    ? [...new Set([...turetilen, ...NEUTRAL_MODULES])]
    : VALID_MODULES;
  const lines = [
    `# serif-brain config — auto-generated by 'serif-brain init'`,
    `# Edit freely. Re-running init will not overwrite this file.`,
    ``,
    `schema_version: "1.0"`,
    `created_at: "${new Date().toISOString()}"`,
    `project_root: "${projectRoot}"`,
    ``,
    `store:`,
    `  engine: ${storeEngine.engine}     # node:sqlite | jsonl`,
    `  db_path: brain.db`,
    `  jsonl_dir: objects-jsonl`,
    `  node_version: "${storeEngine.node_version}"`,
    ``,
    `projects:`,
    ...projects.flatMap(p => [
      `  - id: ${p.id}`,
      `    active: ${p.active}`,
      `    migrate: ${p.migrate}`,
      `    description: "${p.description}"`
    ]),
    ``,
    `valid_modules:`,
    ...modules.map(m => `  - ${m}`),
    ``,
    `valid_status:`,
    ...VALID_STATUS.map(s => `  - ${s}`),
    ``,
    `valid_priority:`,
    ...VALID_PRIORITY.map(p => `  - ${p}`),
    ``,
    `# Bug severity ölçeği (priority'den ayrı). Kaldırılırsa valid_priority kullanılır.`,
    `valid_severity:`,
    ...VALID_SEVERITY.map(s => `  - ${s}`),
    ``,
    `# Context compiler will exclude records with these statuses from Claude context`,
    `context_excluded_status:`,
    ...CONTEXT_EXCLUDED_STATUS.map(s => `  - ${s}`),
    ``,
    `# Graf orphan analizinde EK giriş-noktası desenleri (regex). Framework/araç`,
    `# varsayılanları koda gömülü; buraya projeye özel giriş noktaları eklenir.`,
    `entrypoint_patterns: []`,
    ``,
    `# Otomasyon-üretimi obje id desenleri (regex). Bu objeler stale/owner`,
    `# sinyalinden dışlanır ve ayrı sayılır (churn küratörlü kararları kirletmesin).`,
    `automation_id_patterns:`,
    `  - "-bridge-"`,
    ``,
    `# Status normalization (legacy -> canonical) — applied during ingest/migration`,
    `status_normalization:`,
    `  completed: done`,
    `  closed: done`,
    `  planned: queued`,
    ``,
    `# Dosya yolu -> modul eslemesi (en uzun prefix kazanir).`,
    `# touch/impact/risk/guard/graph BUNU kullanir — bos birakilirsa her dosya`,
    `# 'unknown' moduline duser ve dosya-hafiza baglantisi kurulamaz.`,
    `# Asagisi klasor yapisindan TURETILDI; yanlissa duzelt/sil.`,
    ...(modulePaths.length
      ? [`module_paths:`, ...modulePaths.map(([yol, mod]) => `  "${yol}": ${mod}`)]
      : [`# module_paths:`, `#   "src/ui/": ui`, `#   "src/db/": db`]),
    ``,
    `# Mimari katman kurallari — layers/review ihlalde exit 2 verir; '*' joker.`,
    `# layer_rules:`,
    `#   - { from: ui, to: db, reason: "UI veriye dogrudan dokunmasin, servis katmani kullan" }`,
    ``,
    `# Hafizaya gecmemis commit hatirlaticisi (brief + 'bitti' kapisi). Kapatmak icin false.`,
    `# Kapi YAZMAZ, yalnizca gorunur kilar; yazma karari sende: serif-brain capture --apply`,
    `capture_reminder: true`,
    ``,
    `# Projeye-ozel bug imzalari — lint/review tarar (gecmis hatalarin 'sekli', regex).`,
    `# bug_signatures:`,
    `#   - { name: rls-eksik, pattern: "create table", message: "Yeni tabloda RLS?", severity: high }`,
    ``,
    // module_normalization yalniz serif-platform default'unda anlamli;
    // custom projelerde atlanir (bos inline map {} config parser'i kirar)
    ...(custom ? [] : [
      `# Module normalization`,
      `module_normalization:`,
      `  testlms: testx`,
      `  TestLMS: testx`,
      `  TestX: testx`,
      `  PresentX: presentx`,
      `  ContentX: contentx`,
      `  AnimatorX: animatorx`,
      `  StudioX: studiox`,
      ``
    ])
  ];
  if (hasMigrating) {
    lines.push(
      `# Sources to read during migration (Faz 5). Read-only references.`,
      `legacy_sources:`,
      `  archive_root: "${join(homedir(), "SerifBrainArchive")}"`,
      `  read_from_archive: true     # always read from archive, not live sources`,
      ``
    );
  }
  return lines.join("\n");
}

function writeIfMissing(path, content, label) {
  if (existsSync(path)) {
    console.log(`  - skipped (exists): ${label}`);
    return false;
  }
  writeFileSync(path, content);
  console.log(`  + created: ${label}`);
  return true;
}

function copyTemplateIfMissing(src, dst, label) {
  if (existsSync(dst)) {
    console.log(`  - skipped (exists): ${label}`);
    return false;
  }
  writeFileSync(dst, readFileSync(src));
  console.log(`  + created: ${label}`);
  return true;
}

// ── Claude skill kurulumu ───────────────────────────────────────────────────
// Paketle gelen skill'ler (skill/<ad>/) hedef projenin .claude/skills/ dizinine
// kopyalanir. Boylece 'serif-brain init' calisan her proje, Claude'un calisma
// disiplinini de otomatik kazanir:
//   - cerrahi-plan     → koda dokunmadan ONCE tehis/etki/kapsam/bitti-olcutu
//   - kanit-disiplini  → "bitti" demeden ONCE build/test/TR-tarama kaniti
//   - serif-brain-core → brain komutlarinin oturum ici kullanimi
// Var olan dosyalar overwrite EDILMEZ (writeIfMissing ile ayni sozlesme) —
// kullanicinin skill uzerinde yaptigi yerel duzenlemeler korunur.
// Kopyalama mantigi src/skills/sync.mjs'te (tek kaynak) — 'skills update' komutu
// ayni kodu "sync" modunda cagirir. Burada mode "missing": var olan ezilmez.
// Paket skill'i guncellenmisse init onu TASIMAZ; bunun icin 'serif-brain skills update'.
function installSkills(projectRoot) {
  if (listPackageSkills().length === 0) return;
  console.log(``);
  console.log(`Claude skill kurulumu (.claude/skills/):`);
  const plan = planSkillSync(projectRoot);
  applySkillSync(plan, { mode: "missing", apply: true, log: msg => console.log(msg) });
}

// ── Claude Code kapisi ──────────────────────────────────────────────────────
// Skill'ler DISIPLINI ANLATIR, kapi onu DEVREYE SOKAR. Paket uzun sure kapi
// betigini tasiyip onu hicbir yere baglamiyordu; kurulmayan kapi kapi degildir
// (ajan `guard` calistirmayi hatirlamak zorunda kalir). init artik yalnizca
// EKSIK olaylari ekler — kullanicinin kendi hook'una ve bizim degistirilmis
// kaydimiza dokunmaz; guncelleme icin: serif-brain hooks install --apply.
function installGate(projectRoot) {
  const r = applyHookInstall(projectRoot, { mode: "missing" });
  console.log(``);
  console.log(`Claude Code kapisi (.claude/settings.json):`);
  if (r.error) {
    console.log(`  ⚠ ${r.error}`);
    console.log(`    Dokunulmadi. Duzeltince: serif-brain hooks install --apply`);
    return;
  }
  if (!r.gateExists) {
    console.log(`  ⚠ kapi betigi bulunamadi (${r.gateScript}) — atlandi`);
    return;
  }
  if (!r.written) {
    console.log(`  = zaten kurulu`);
    return;
  }
  for (const c of r.changes) console.log(`  + ${c.event}`);
  console.log(`  Kapi YENI oturumda devreye girer. Durum: serif-brain hooks status`);
}

export async function initCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  const explicitId = args.flags.name ?? args.flags.project_id ?? null;
  const projects = resolveProjects(args, projectRoot);
  const isFlagship = !explicitId && isFlagshipSelfHost(projectRoot);

  console.log(`[serif-brain init]`);
  console.log(`  Project:     ${projectRoot}`);
  console.log(`  Brain root:  ${brainRoot}`);
  if (explicitId) {
    console.log(`  Project ID:  ${explicitId} (custom, migrate=false)`);
  } else if (!isFlagship) {
    console.log(`  Project ID:  ${projects[0].id} (auto-detected from folder, migrate=false)`);
  }
  console.log(``);

  if (!existsSync(projectRoot)) {
    throw new Error(`Project path does not exist: ${projectRoot}`);
  }

  const storeEngine = await detectStoreEngine();
  console.log(`  Store engine: ${storeEngine.engine} (Node ${storeEngine.node_version})`);
  console.log(``);

  const created = existsSync(brainRoot) ? "EXISTS" : "NEW";
  mkdirSync(brainRoot, { recursive: true });
  console.log(`Brain root [${created}]: ${brainRoot}`);

  const dirLayout = buildDirLayout(projects);
  console.log(``);
  console.log(`Klasor yapisi:`);
  for (const dir of dirLayout) {
    const full = join(brainRoot, dir);
    if (existsSync(full)) {
      console.log(`  - skipped (exists): ${dir}/`);
    } else {
      mkdirSync(full, { recursive: true });
      console.log(`  + created: ${dir}/`);
    }
  }

  console.log(``);
  console.log(`Konfigurasyon ve template'ler:`);
  writeIfMissing(join(brainRoot, "config.yaml"), buildConfig(projectRoot, storeEngine, projects, { custom: !isFlagship }), "config.yaml");
  writeIfMissing(join(brainRoot, ".gitignore"), gitignoreContent(), ".gitignore");
  writeIfMissing(join(brainRoot, "README.md"), readmeContent(), "README.md");

  // Object templates (read-only references for human + tooling)
  for (const tpl of ["bug.md", "decision.md", "note.md", "session.md"]) {
    const src = join(TEMPLATES, "object-templates", tpl);
    const dst = join(brainRoot, "indexes", `_template-${tpl}`);
    if (existsSync(src)) copyTemplateIfMissing(src, dst, `indexes/_template-${tpl}`);
  }

  installSkills(projectRoot);
  installGate(projectRoot);

  // Kok CLAUDE.md'ye kisa isaret blogu — ajanin ILK baktigi yer burasidir.
  // Isaretlerin disindaki icerige dokunulmaz.
  const cm = applyClaudeMd(projectRoot);
  console.log(``);
  console.log(`CLAUDE.md isareti:`);
  console.log(`  ${cm.written ? "+" : "="} ${cm.path}`);

  console.log(``);
  console.log(`✓ init complete`);
  console.log(``);
  console.log(`Sonraki adim:`);
  console.log(`  serif-brain doctor --project ${projectRoot}`);

  // Merkezi paneli ac. Kurulan proje orada kart olarak zaten gorunur — "brain
  // kurdum, nerede?" sorusu hic olusmasin. Panel bir KOLAYLIK: acilamazsa
  // init'i basarisiz etmez, CI/etkilesimsiz oturumda hic denenmez.
  await initSonrasiPanel(args.flags);
  return 0;
}

function gitignoreContent() {
  return [
    `# serif-brain — derived/cache files only`,
    `# Canonical data (config.yaml, objects/, archive-index/) IS tracked.`,
    ``,
    `# Derived — regenerable via 'serif-brain analyze'`,
    `graph/`,
    `reports/`,
    `context/`,
    `indexes/`,
    ``,
    `# SQLite engine artifacts`,
    `brain.db`,
    `brain.db-journal`,
    `brain.db-shm`,
    `brain.db-wal`,
    ``,
    `# JSONL fallback artifacts (if engine=jsonl)`,
    `objects-jsonl/`,
    ``
  ].join("\n");
}

function readmeContent() {
  return [
    `# .serif-brain — Serif Brain Core canonical store`,
    ``,
    `Bu klasor proje hafizasinin TEK gercek kaynagidir. Eski Obsidian/Graphify/eski`,
    `\`.claude/brain\` YAML sistemine runtime bagimliligi YOKTUR.`,
    ``,
    `## Yapi`,
    ``,
    `- \`config.yaml\` — sema versiyonu, gecerli modul/status/priority listeleri`,
    `- \`objects/projects/<project>/\` — canonical Markdown object dosyalari`,
    `  - \`bugs/\`, \`decisions/\`, \`notes/\`, \`modules/\`, \`sessions/\`, \`sprints/\``,
    `- \`brain.db\` — SQLite (veya \`objects-jsonl/\` JSONL fallback)`,
    `- \`graph/\` — derived: \`graph.json\`, \`graph.dot\``,
    `- \`reports/\` — derived: health/bugs/decisions/architecture/context-pollution/...`,
    `- \`context/\` — derived: Claude context dosyalari`,
    `- \`indexes/\` — derived: project/module/bug/decision/tag/backlink indexleri`,
    `- \`archive-index/\` — legacy migration manifest ve audit raporu`,
    ``,
    `## Komutlar`,
    ``,
    `\`\`\``,
    `serif-brain doctor              # sistem sagligi`,
    `serif-brain ingest legacy --dry-run`,
    `serif-brain migrate --dry-run`,
    `serif-brain scan code`,
    `serif-brain analyze`,
    `serif-brain context`,
    `\`\`\``,
    ``,
    `## Notlar`,
    ``,
    `- Derived veri (\`graph/\`, \`reports/\`, \`context/\`, \`indexes/\`) silinebilir;`,
    `  \`serif-brain analyze\` ile yeniden uretilir.`,
    `- \`done\`, \`rejected\`, \`archived\` kayitlar Claude aktif context'ine girmez.`,
    `- Eski Obsidian vault sadece migration kaynagidir — runtime'da okunmaz.`,
    ``
  ].join("\n");
}
