// CLI komut yonlendirici
import { initCommand } from "./init.mjs";
import { doctorCommand } from "../doctor/doctor.mjs";
import { rebuildIndexesCommand } from "./rebuild-indexes.mjs";
import { addCommand } from "./add.mjs";
import { closeCommand } from "./close.mjs";
import { staleCommand } from "./stale.mjs";
import { syncCommitsCommand } from "./sync-commits.mjs";
import { scanCodeCommand } from "./scan-code.mjs";
import { graphCommand } from "./graph.mjs";
import { migrateCommand } from "./migrate.mjs";
import { analyzeCommand } from "./analyze.mjs";
import { contextCommand } from "./context.mjs";
import { hooksCommand } from "./hooks.mjs";
import { validateCommand } from "./validate.mjs";
import { searchCommand } from "./search.mjs";
import { briefCommand } from "./brief.mjs";
import { touchCommand } from "./touch.mjs";
import { captureCommand } from "./capture.mjs";
import { impactCommand } from "./impact.mjs";
import { hotspotCommand } from "./hotspot.mjs";
import { layersCommand } from "./layers.mjs";
import { checkCommand } from "./check.mjs";
import { lintCommand } from "./lint.mjs";
import { riskCommand } from "./risk.mjs";
import { clusterCommand } from "./cluster.mjs";
import { reviewCommand } from "./review.mjs";
import { guardCommand } from "./guard.mjs";
import { mcpCommand } from "./mcp.mjs";
import { relatedCommand } from "./related.mjs";
import { pruneCommand } from "./prune.mjs";
import { dashboardCommand } from "./dashboard.mjs";
import { skillsCommand } from "./skills.mjs";

const COMMANDS = {
  init:    { handler: initCommand,   help: "Proje icin .serif-brain/ yapisini olustur" },
  doctor:  { handler: doctorCommand, help: "Sistem sagligi ve store engine raporu" },
  add:     { handler: addCommand,    help: "Bug/decision/plan/record ekle (add bug | add decision | add plan | add record)" },
  close:   { handler: closeCommand,  help: "Bug/decision kapat (status flip + completed_at + opsiyonel commit/note)" },
  stale:   { handler: staleCommand,  help: "Acik kalemleri son commit aktivitesine gore tara (--days N, --quiet)" },
  "sync-commits": { handler: syncCommitsCommand, help: "Commit mesajindaki 'Brain-Closes: <id>' trailer'ini okuyup objeleri kapat (--since-days N, --dry-run)" },
  "rebuild-indexes": { handler: rebuildIndexesCommand, help: "Tum indexleri yeniden uret" },
  validate: { handler: validateCommand, help: "Objeleri semaya gore dogrula; hatali dosyalari yol+neden ile listele (--warnings, --project_id)" },
  scan:    { handler: scanCodeCommand, help: "Kod scanner — files/imports/todos (scan code)" },
  graph:   { handler: graphCommand,    help: "Graph build / report / viewer (graph build | graph report | graph viewer)" },
  migrate: { handler: migrateCommand,  help: "Migration dry-run (legacy YAML + Obsidian + Graphify ref)" },
  analyze: { handler: analyzeCommand,  help: "Tum raporlari uret (health/bugs/decisions/architecture/...)" },
  context: { handler: contextCommand,  help: "Claude bagliami uret (--module <X> ile filtre)" },
  hooks:   { handler: hooksCommand,    help: "Hook migration plan/dry-run (apply Faz 8'de devre disi)" },
  search:  { handler: searchCommand,   help: "Hafizada yapisal + tam-metin arama ('text' --type --status --priority --module --tag --json --limit)" },
  brief:   { handler: briefCommand,    help: "Oturum-acilisi 'neredeyiz' ozeti: aktif bug/karar + son dokunulan + park kuyrugu (--module --days N --json)" },
  touch:   { handler: touchCommand,    help: "Bir dosyaya dokunmadan once ilgili hafiza: o dosya/modulun karar + bug'lari (yara izi dahil) <dosya> --module --json" },
  guard:   { handler: guardCommand,    help: "Edit-oncesi BIRLESIK brifing: touch+impact+risk+lint tek cikti (verdict + kararlar + blast + imza) <dosya> --json" },
  capture: { handler: captureCommand,  help: "Git commit'lerinden aday bug/karar oner (write-back). Dry-run; --apply yazar (--days N --json)" },
  impact:  { handler: impactCommand,    help: "Canli blast-radius: bir dosyayi degistirirsem ne kirilir (gecisli bagimlilar + etkilenen modul + hafiza) <dosya> --json" },
  hotspot: { handler: hotspotCommand,   help: "Tehlike bolgesi: churn × merkezilik + modul bug yogunlugu fuzyonu (--days N --limit N --json)" },
  layers:  { handler: layersCommand,    help: "Mimari katman ihlalleri (config layer_rules: ui→db yasak gibi). Ihlal varsa exit 2 (--json)" },
  check:   { handler: checkCommand,     help: "PostEdit graf saglik: bir dosyada katman ihlali + dongu + god-file <dosya> (--json)" },
  lint:    { handler: lintCommand,      help: "Projeye-ozel bug imza linter (config bug_signatures). Eslesme varsa exit 2 [dosya...] (--json)" },
  risk:    { handler: riskCommand,      help: "Tek dosya edit-ani risk skoru: churn+merkezilik+modul/dosya bug+imza fuzyonu <dosya> (--days N --json)" },
  cluster: { handler: clusterCommand,   help: "Bug'lari benzerlige gore grupla — olasi ayni-kok-neden kumeleri (--threshold N --json)" },
  review:  { handler: reviewCommand,    help: "Pre-commit kapi: degisen dosyalarda check (katman/dongu/god) + lint (imza). Sorun varsa exit 2 (--ref --json)" },
  related: { handler: relatedCommand,  help: "Bir objeye otomatik kesfedilen iliskili objeler (modul/etiket/metin benzerligi) <id> --limit --json" },
  prune:   { handler: pruneCommand,    help: "Stale + otomasyon churn objelerini guvenle arsivle (dry-run; --apply, --days N)" },
  skills:  { handler: skillsCommand,     help: "Paket Claude skill'lerini projeye tasi/guncelle (status|list|update). init var olani ezmez; guncelleme icin: skills update --apply" },
  dashboard:{ handler: dashboardCommand, help: "Cok-brain yonetici paneli: CANLI panel (serve/open/app) + statik HTML (build|add <yol>|scan|list|archive|rm). Tum projelerin durumu/port/calistirma/biten isler" },
  mcp:     { handler: mcpCommand,       help: "MCP sunucusu (stdio/JSON-RPC) — Claude Code brain'i canli okur (brain_search/get/context/related)" },
  // Emekli isimler. Bunlar bir zamanlar "sonraki fazda gelecek" diye yardim
  // ciktisinda "(stub)" olarak duruyordu — ama isleri BASKA komutlar ustlendi;
  // liste bitmemislik sinyali veriyordu, oysa eksik olan sey yoktu. Isim yine
  // taniniyor: eski aliskanlikla yazan kisi sessiz basari degil, YON alir.
  archive: { handler: retiredCommand("archive", "prune", "stale/churn objelerini guvenle arsivler") },
  ingest:  { handler: retiredCommand("ingest",  "migrate", "legacy YAML/Obsidian kaynaklarini okur ve normalize eder") },
  report:  { handler: retiredCommand("report",  "analyze", "tum raporlari (health/bugs/decisions/architecture) uretir") },
};

function retiredCommand(name, yerine, ne) {
  return async () => {
    console.error(`[serif-brain ${name}] bu komut yok — yerine: serif-brain ${yerine}`);
    console.error(`  ${yerine}: ${ne}`);
    return 1;
  };
}

function printHelp() {
  console.log(`serif-brain — bagimsiz proje hafiza, bilgi ag ve graf analiz sistemi`);
  console.log(``);
  console.log(`Kullanim: serif-brain <komut> [opsiyonlar]`);
  console.log(``);
  const active = ["init", "doctor", "add", "close", "stale", "sync-commits", "rebuild-indexes", "validate", "search", "brief", "touch", "guard", "capture", "impact", "hotspot", "layers", "check", "lint", "risk", "cluster", "review", "related", "prune", "skills", "dashboard", "mcp", "scan", "graph", "migrate", "analyze", "context", "hooks"];
  console.log(`Komutlar:`);
  for (const name of active) {
    console.log(`  ${name.padEnd(20)} ${COMMANDS[name].help}`);
  }
  console.log(``);
  console.log(`Genel bayraklar:`);
  console.log(`  --help, -h               bu yardim`);
  console.log(`  --version, -v            versiyon`);
  console.log(`  --project <yol>          proje koku (default: cwd)`);
  console.log(``);
  console.log(`Ortam:`);
  console.log(`  SERIF_BRAIN_DEBUG=1      stack trace goster`);
}

export function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) { args.flags[key] = next; i++; }
      else args.flags[key] = true;
    } else if (a.startsWith("-")) {
      args.flags[a.slice(1)] = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

export async function run(argv) {
  const args = parseArgs(argv);

  if (args.flags.version || args.flags.v) {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "../../package.json"), "utf8"));
    console.log(`serif-brain ${pkg.version}`);
    return 0;
  }
  if (args.flags.help || args.flags.h || args._.length === 0) {
    printHelp();
    return 0;
  }

  const cmdName = args._[0];
  const cmd = COMMANDS[cmdName];
  if (!cmd) {
    console.error(`[serif-brain] bilinmeyen komut: ${cmdName}`);
    console.error(`'serif-brain --help' icin yardimi gor.`);
    return 1;
  }

  return await cmd.handler({ args, subcommand: args._.slice(1) });
}
