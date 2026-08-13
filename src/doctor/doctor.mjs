// serif-brain doctor — sistem sagligi raporu
import { existsSync, statSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { detectStoreEngine } from "../store/engine.mjs";
import { loadConfig, validateObject } from "../markdown/schema.mjs";
import { listAllObjects, listProjects } from "../markdown/object.mjs";
import { buildBacklinks } from "../markdown/backlinks.mjs";
import { planHookInstall } from "../hooks/install.mjs";
import { fileURLToPath } from "node:url";

const HERE_BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin");
function pkgSurum() {
  try { return JSON.parse(readFileSync(join(HERE_BIN, "..", "package.json"), "utf8")).version; }
  catch { return "?"; }
}

const LEGACY_HOOK_PATTERNS = [
  /sherif-brain-claude/,
  /claude-brain\/hooks/,
  /generate-claude-md/,
  /graphify-out/
];

// Legacy migration referans kontrolleri — kullanıcı ev dizinine göre türetilir
// (hardcoded kullanıcı adı DEĞİL). Bunlar yalnız "eski kaynaklar temizlendi mi"
// bilgi kontrolüdür; yoksa doctor "kaldırıldı ✓" der.
const HOME = homedir();
// Bu liste bir zamanlar SABITTI ve paket yazarinin kendi klasor duzenini
// (Desktop/serif-platform/...) tasiyordu — genel amacli bir aracin icinde tek
// bir kullanicinin gocu. Artik goc eden kisi kendi kaynaklarini config'e yazar:
//   legacy_sources:
//     - { id: eski-brain, path: "~/eski/yol" }
function legacySources(config) {
  const list = Array.isArray(config?.legacy_sources) ? config.legacy_sources : [];
  return list
    .filter((s) => s && s.path)
    .map((s) => ({
      id: s.id || String(s.path).split("/").filter(Boolean).pop(),
      path: String(s.path).replace(/^~(?=\/|$)/, HOME),
    }));
}

function check(label, ok, detail = "") {
  const mark = ok === true ? "✓" : ok === false ? "✗" : "·";
  const color = ok === true ? "" : ok === false ? "!" : " ";
  console.log(`  [${color}${mark}] ${label.padEnd(40)} ${detail}`);
  return ok;
}

function header(text) {
  console.log(``);
  console.log(`=== ${text} ===`);
}

export async function doctorCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");

  console.log(`[serif-brain doctor]`);
  console.log(`  Project: ${projectRoot}`);
  console.log(``);

  let warnings = 0;
  let errors = 0;
  let config = null;
  try { config = loadConfig(brainRoot); } catch { /* config yoksa asagida zaten raporlanir */ }

  // 0. Hangi kopya calisiyor?
  //
  // Eski bir surumu calistiran kullanici HICBIR uyari gormuyordu; arac kendi
  // eskiligini bilmiyordu. Windows'ta modul eslemesi tamamen bozuk bir surum
  // sessizce calisiyor olabilirdi (2026-08-12'de fark edildi).
  header("0. Calisan Kopya");
  try {
    const { kurulumBilgisi, kurulumSatirlari } = await import("../util/kurulum.mjs");
    const bilgi = kurulumBilgisi(join(HERE_BIN, "serif-brain.mjs"));
    check("Surum", true, pkgSurum());
    for (const l of kurulumSatirlari(bilgi)) console.log(l);
    if (bilgi.git?.geride) warnings++;
  } catch (e) {
    check("Kurulum bilgisi", "warn", e.message);
    warnings++;
  }

  // 1. Node + store engine
  header("1. Runtime & Store Engine");
  const engine = await detectStoreEngine();
  check("Node version", true, `v${engine.node_version}`);
  if (engine.engine === "node:sqlite") {
    check("Store engine", true, `node:sqlite (${engine.reason})`);
  } else {
    check("Store engine", "warn", `JSONL fallback (${engine.reason})`);
    warnings++;
  }

  // 2. Brain root + canonical layout
  header("2. Canonical Layout");
  const brainExists = existsSync(brainRoot);
  if (!check("Brain root", brainExists, brainExists ? brainRoot : "MISSING — run 'serif-brain init'")) errors++;

  if (brainExists) {
    const requiredDirs = ["objects", "graph", "reports", "context", "indexes", "archive-index"];
    for (const d of requiredDirs) {
      const ok = existsSync(join(brainRoot, d));
      if (!check(`  ${d}/`, ok, ok ? "" : "missing")) errors++;
    }

    const configPath = join(brainRoot, "config.yaml");
    if (check("config.yaml", existsSync(configPath), existsSync(configPath) ? `${statSync(configPath).size} byte` : "MISSING")) {
      // basic shape check
    } else {
      errors++;
    }
  }

  // 3. Active projects layout (config-driven)
  if (brainExists && existsSync(join(brainRoot, "config.yaml"))) {
    let activeProjects = [];
    let configError = null;
    try {
      const cfg = loadConfig(brainRoot);
      activeProjects = (cfg.projects || []).filter(p => p.active);
    } catch (e) {
      configError = e.message;
    }

    if (configError) {
      header("3. Active Projects");
      check("Config parse for active projects", false, configError);
      errors++;
    } else if (activeProjects.length === 0) {
      header("3. Active Projects");
      check("Active project count", false, "no active projects in config.yaml");
      errors++;
    } else {
      for (const project of activeProjects) {
        header(`3. Active Project — ${project.id}`);
        const projDir = join(brainRoot, "objects/projects", project.id);
        const projOk = existsSync(projDir);
        if (!check("Project dir", projOk, projDir)) errors++;
        if (projOk) {
          // Tip dizinleri YAZMA ANINDA olusturulur (writeObject mkdirSync
          // recursive yapar). Ayrica git BOS DIZIN SAKLAMAZ: repoyu klonlayan
          // herkeste `notes/`, `sessions/` vb. "missing" gorunur.
          // Once bunlar kirmizi ✗ olarak raporlaniyordu — hicbir sey bozuk
          // olmadigi halde herkese "bir seyler eksik" dedirten yanlis alarm.
          // Artik yalnizca BILGI: dolu olan sayilir, bos olan "—" gecer.
          for (const sub of ["bugs", "decisions", "notes", "modules", "sessions", "sprints"]) {
            const subPath = join(projDir, sub);
            const ok = existsSync(subPath);
            const count = ok ? readdirSync(subPath).filter(f => f.endsWith(".md") && !f.startsWith("_template-")).length : 0;
            check(`  ${sub}/`, count > 0 ? true : " ", count > 0 ? `${count} object${count === 1 ? "" : "s"}` : "— (ilk kayitta olusur)");
          }
        }
      }
    }
  }

  // 3b. Object schema health (Faz 3)
  if (brainExists && existsSync(join(brainRoot, "config.yaml"))) {
    header("3b. Object Schema Health");
    try {
      loadConfig(brainRoot);
      const projects = listProjects(brainRoot);
      let total = 0, parseFailed = 0, schemaInvalid = 0, warnings_ = 0;
      // Sorunlu dosyaları yol + neden ile topla ki sadece sayı değil, NEREYE
      // bakılacağı da görünsün (önceden yalnız sayaç vardı → tanı kör-noktası).
      const parseFailedFiles = [];
      const schemaInvalidFiles = [];
      const warningFiles = [];
      const rel = (f) => (f && f.startsWith(brainRoot) ? f.slice(brainRoot.length + 1) : f);
      for (const project of projects) {
        const objs = listAllObjects(brainRoot, project);
        total += objs.length;
        for (const obj of objs) {
          if (obj.error) { parseFailed++; parseFailedFiles.push({ file: rel(obj.file_path), error: obj.error }); continue; }
          const v = validateObject(obj.frontmatter);
          if (!v.valid) { schemaInvalid++; schemaInvalidFiles.push({ file: rel(obj.file_path), errors: v.errors }); }
          if (v.warnings.length) { warnings_ += v.warnings.length; warningFiles.push({ file: rel(obj.file_path), warnings: v.warnings }); }
        }
      }
      check(`Total objects`, total >= 0, `${total}`);
      if (!check(`Parse failures`, parseFailed === 0, parseFailed === 0 ? "0" : `${parseFailed}`)) errors++;
      if (!check(`Schema-invalid`, schemaInvalid === 0, schemaInvalid === 0 ? "0" : `${schemaInvalid}`)) errors++;
      check(`Schema warnings`, warnings_ === 0 || "warn", `${warnings_}`);
      if (warnings_ > 0) warnings++;

      // Hatalı dosyaları açıkça listele (parse + şema = hata; uyarılar capped).
      if (parseFailedFiles.length) {
        console.log(`\n  Parse hatası olan dosyalar:`);
        for (const f of parseFailedFiles) console.log(`    ✗ ${f.file}\n        ${f.error}`);
      }
      if (schemaInvalidFiles.length) {
        console.log(`\n  Şema-geçersiz dosyalar:`);
        for (const f of schemaInvalidFiles) console.log(`    ✗ ${f.file}\n        ${f.errors.join("; ")}`);
      }
      if (warningFiles.length) {
        const shown = warningFiles.slice(0, 10);
        console.log(`\n  Şema uyarısı olan dosyalar${warningFiles.length > 10 ? ` (ilk 10/${warningFiles.length})` : ""}:`);
        for (const f of shown) console.log(`    · ${f.file} — ${f.warnings.join("; ")}`);
      }

      // Indexes presence
      const idxDir = join(brainRoot, "indexes");
      const expected = ["project-index.md","module-index.md","bug-index.md","decision-index.md","tag-index.md","backlink-index.md","stale-report.md"];
      const builtCount = expected.filter(f => existsSync(join(idxDir, f))).length;
      check(`Indexes built`, builtCount === expected.length || "warn", `${builtCount}/${expected.length} (run 'rebuild-indexes' to refresh)`);
      if (builtCount < expected.length) warnings++;

      // Broken backlinks
      const all = projects.flatMap(p => listAllObjects(brainRoot, p)).filter(o => !o.error);
      const { broken } = buildBacklinks(all);
      check(`Broken backlinks`, broken.length === 0 || "warn", `${broken.length}`);
      if (broken.length > 0) warnings++;
    } catch (e) {
      check(`Schema check`, false, `failed: ${e.message}`);
      errors++;
    }
  }

  // 3c. Graph engine health (graph engine)
  if (brainExists) {
    header("3c. Graph Engine");
    const graphPath = join(brainRoot, "graph", "graph.json");
    const dotPath = join(brainRoot, "graph", "graph.dot");
    const reportPath = join(brainRoot, "reports", "graph-analysis.md");
    if (!existsSync(graphPath)) {
      check("graph.json", "warn", "missing — run 'serif-brain graph build'");
      warnings++;
    } else {
      try {
        const g = JSON.parse(readFileSync(graphPath, "utf8"));
        check("graph.json", true, `${g.stats?.node_count} nodes, ${g.stats?.edge_count} edges, ${g.stats?.files_scanned} files`);
        const ageMs = Date.now() - new Date(g.generated_at).getTime();
        const ageMin = Math.floor(ageMs / 60000);
        check("Graph age", ageMin > 60 ? "warn" : true, `${ageMin}m old`);
        if (ageMin > 60) warnings++;

        // MODUL ATFI KAPSAMI. "unknown" bir deger degil, bir BOSLUKTUR: o
        // dosyalar icin modul-seviyesi hafiza baglantisi, hotspot'un modul bug
        // yogunlugu ve risk fuzyonunun modul bileseni CALISMAZ — ama hicbiri
        // hata vermez, sadece sessizce zayiflar. `scan code` sayiyi zaten
        // basiyordu; sayiyi gormek ile SONUCUNU bilmek ayri seylerdir.
        // Olculdu (11 gercek proje): 5'inde oran %25 ustu, birinde %100.
        const dosyalar = (g.nodes || []).filter((n) => n.type === "file");
        if (dosyalar.length >= 10) {
          const bos = dosyalar.filter((n) => !n.module || n.module === "unknown").length;
          const oran = Math.round((bos / dosyalar.length) * 100);
          const kotu = oran >= 25;
          check("Module attribution", kotu ? "warn" : true,
            `${dosyalar.length - bos}/${dosyalar.length} dosya bir module bagli (unknown %${oran})`);
          if (kotu) {
            console.log(`        → unknown dosyalarda modul-seviyesi hafiza/hotspot/risk ZAYIF calisir`);
            console.log(`        → duzelt: config.yaml 'module_paths' ("src/oyun/": oyun), sonra 'graph build'`);
            warnings++;
          }
        }
      } catch (e) {
        check("graph.json parse", false, e.message);
        errors++;
      }
    }
    check("graph.dot", existsSync(dotPath) ? true : "warn", existsSync(dotPath) ? `${statSync(dotPath).size} byte` : "missing");
    check("graph-analysis.md", existsSync(reportPath) ? true : "warn", existsSync(reportPath) ? `${statSync(reportPath).size} byte` : "missing — run 'serif-brain graph report'");
  }

  // 4-5. GOC bolumleri — YALNIZCA gocu olan brain'de gosterilir.
  //
  // NEDEN KOSULLU: bu iki bolum paketin YAZARININ eski sistemden gecis
  // gecmisini denetliyordu (SerifBrainArchive, Obsidian-Dev-Vault,
  // graphify-out). Temiz oda testinde olculdu: bambaska bir makinede yeni bir
  // proje kuran kullanici `doctor` calistirinca 3 kirmizi ✗ + 2 uyari
  // goruyordu — hicbiri kendisiyle ilgili degildi. "Ilk 60 saniye" tam olarak
  // burada kaybedilir: arac bozukmus gibi gorunur.
  // Kosul MAKINEYE degil BRAIN'e bakar: `legacy_sources` config'te varsa bu
  // brain gercekten bir gocten geliyordur. Makinede arsiv klasoru bulunmasi
  // yetmez — ayni makinede kurulan YENI bir proje de o bolumleri gorurdu.
  const gocVar = !!config?.legacy_sources;
  if (gocVar) {
  header("4. Migration Readiness");
  const archiveRoot = join(HOME, "SerifBrainArchive");
  const archiveExists = existsSync(archiveRoot);
  check("Archive root", archiveExists, archiveExists ? archiveRoot : "missing — run 'serif-brain archive legacy --apply'");
  if (archiveExists) {
    const archives = readdirSync(archiveRoot).filter(d => d.startsWith("legacy-"));
    check("Archive snapshots", archives.length > 0, archives.length === 0 ? "0 found" : `${archives.length}: ${archives.join(", ")}`);
    if (archives.length > 0) {
      for (const a of archives) {
        const manifestPath = join(archiveRoot, a, "archive-manifest.json");
        if (existsSync(manifestPath)) {
          try {
            const m = JSON.parse(readFileSync(manifestPath, "utf8"));
            check(`  ${a}/manifest`, true, `${m.totals?.copied_files} files, ${(m.totals?.copied_bytes/1024/1024).toFixed(2)}MB, ${Object.keys(m.hashes||{}).length} hashes`);
          } catch (e) {
            check(`  ${a}/manifest`, false, `corrupt: ${e.message}`);
            errors++;
          }
        }
      }
    }
  }

  // 5. Legacy sources still present (informational)
  header("5. Legacy Sources (read-only references)");
  // Isaret TERSTI: eski kaynagin KALDIRILMIS olmasi ISTENEN durumdur, ama
  // "MOVED/REMOVED" kirmizi ✗ ile basiliyordu — goc tamamlanmis bir brain
  // basarisiz gorunuyordu. Artik: gitmisse ✓ (goc tamam), duruyorsa bilgi.
  for (const src of legacySources(config)) {
    const duruyor = existsSync(src.path);
    check(`  ${src.id}`, duruyor ? " " : true, duruyor ? "hala duruyor (dokunulmadi)" : "temizlenmis ✓");
  }
  }

  // 6a. Claude Code kapisi kurulu mu?
  // Kurulmayan kapi kapi degildir — bu satir olmadan "kapi var" sanilir.
  header("6. Claude Code Kapisi");
  const gate = planHookInstall(projectRoot);
  if (gate.error) {
    check("settings.json", false, gate.error);
    errors++;
  } else if (!gate.gateExists) {
    check("kapi betigi", false, `bulunamadi: ${gate.gateScript}`);
    errors++;
  } else {
    const kurulu = gate.hooks.filter(h => h.state === "same").length;
    const bayat = gate.hooks.filter(h => h.state === "stale").length;
    if (kurulu === gate.hooks.length) {
      check("Kapi (Session/Pre/Post/Stop)", true, `${kurulu}/${gate.hooks.length} kurulu`);
    } else if (bayat) {
      check("Kapi (Session/Pre/Post/Stop)", "warn", `${kurulu}/${gate.hooks.length} kurulu, ${bayat} bayat → serif-brain hooks install --apply`);
      warnings++;
    } else {
      check("Kapi (Session/Pre/Post/Stop)", "warn", `${kurulu}/${gate.hooks.length} kurulu → serif-brain hooks install --apply`);
      warnings++;
    }
    if (gate.foreign) check("  yabanci hook", true, `${gate.foreign} kayit (dokunulmuyor)`);

    // Kapinin KENDI hata gunlugu. Kapi oturumu bozmamak icin hata firlatmaz;
    // eskiden bunu "hatayi yok ederek" yapiyordu ve AYLARCA sessizce bozuk
    // kaldi. Artik iz birakiyor — iz varsa burada gorunur.
    const gateLog = join(brainRoot, ".cache", "gate.log");
    if (existsSync(gateLog)) {
      let kayitlar = [];
      try { kayitlar = readFileSync(gateLog, "utf8").split("\n").filter(Boolean); } catch { /* okunamadi */ }
      const sonGun = kayitlar.filter(l => {
        try { return Date.now() - Date.parse(JSON.parse(l).t) < 7 * 86400000; } catch { return false; }
      });
      if (sonGun.length) {
        check("  kapi hata gunlugu", "warn", `son 7 gunde ${sonGun.length} hata → serif-brain hooks test`);
        warnings++;
      } else {
        check("  kapi hata gunlugu", true, `${kayitlar.length} eski kayit, son 7 gun temiz`);
      }
    }
  }

  // 6b. Legacy hook detection in .claude/settings.json
  const settingsPath = join(projectRoot, ".claude/settings.json");
  if (gocVar && existsSync(settingsPath)) {
    header("7. Eski Hook Kalintilari");
    const content = readFileSync(settingsPath, "utf8");
    const matches = [];
    for (const pattern of LEGACY_HOOK_PATTERNS) {
      const m = content.match(pattern);
      if (m) matches.push(m[0]);
    }
    if (matches.length > 0) {
      check("Legacy hooks present", "warn", `${matches.length} reference(s): ${[...new Set(matches)].join(", ")}`);
      console.log(`        → Will be migrated in apply asamasi (with explicit approval)`);
      warnings++;
    } else {
      check("Legacy hooks present", true, "none — already migrated");
    }
  }

  // 8. Summary
  header("Sonuc");
  console.log(`  Errors:   ${errors}`);
  console.log(`  Warnings: ${warnings}`);
  if (errors === 0 && warnings === 0) {
    console.log(`  Durum:    HEALTHY ✓`);
    return 0;
  } else if (errors === 0) {
    console.log(`  Durum:    OK with warnings`);
    return 0;
  } else {
    console.log(`  Durum:    NEEDS ATTENTION`);
    return 1;
  }
}
