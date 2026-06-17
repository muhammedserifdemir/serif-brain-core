// serif-brain doctor — sistem sagligi raporu
import { existsSync, statSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { detectStoreEngine } from "../store/engine.mjs";
import { loadConfig, validateObject } from "../markdown/schema.mjs";
import { listAllObjects, listProjects } from "../markdown/object.mjs";
import { buildBacklinks } from "../markdown/backlinks.mjs";

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
const LEGACY_SOURCES = [
  { id: "project-brain",       path: join(HOME, "Desktop/serif-platform/.claude/brain") },
  { id: "claude-brain-package", path: join(HOME, "Desktop/seriftech-packages/claude-brain") },
  { id: "skill-sherif-brain-claude", path: join(HOME, ".claude/skills/sherif-brain-claude") },
  { id: "obsidian-vault",      path: join(HOME, "Obsidian-Dev-Vault") },
  { id: "graphify-out",        path: join(HOME, "Desktop/serif-platform/graphify-out") }
];

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
          for (const sub of ["bugs", "decisions", "notes", "modules", "sessions", "sprints"]) {
            const subPath = join(projDir, sub);
            const ok = existsSync(subPath);
            const count = ok ? readdirSync(subPath).filter(f => f.endsWith(".md") && !f.startsWith("_template-")).length : 0;
            check(`  ${sub}/`, ok, ok ? `${count} object${count === 1 ? "" : "s"}` : "missing");
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

  // 3c. Graph engine health (Faz 4)
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
      } catch (e) {
        check("graph.json parse", false, e.message);
        errors++;
      }
    }
    check("graph.dot", existsSync(dotPath) ? true : "warn", existsSync(dotPath) ? `${statSync(dotPath).size} byte` : "missing");
    check("graph-analysis.md", existsSync(reportPath) ? true : "warn", existsSync(reportPath) ? `${statSync(reportPath).size} byte` : "missing — run 'serif-brain graph report'");
  }

  // 4. Migration readiness
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
  for (const src of LEGACY_SOURCES) {
    const ok = existsSync(src.path);
    check(`  ${src.id}`, ok, ok ? "present (untouched)" : "MOVED/REMOVED");
  }

  // 6. Legacy hook detection in .claude/settings.json
  header("6. Legacy Hooks (Faz 8 input)");
  const settingsPath = join(projectRoot, ".claude/settings.json");
  if (!existsSync(settingsPath)) {
    check("settings.json", false, "missing");
  } else {
    const content = readFileSync(settingsPath, "utf8");
    const matches = [];
    for (const pattern of LEGACY_HOOK_PATTERNS) {
      const m = content.match(pattern);
      if (m) matches.push(m[0]);
    }
    if (matches.length > 0) {
      check("Legacy hooks present", "warn", `${matches.length} reference(s): ${[...new Set(matches)].join(", ")}`);
      console.log(`        → Will be migrated in Faz 8 (with explicit approval)`);
      warnings++;
    } else {
      check("Legacy hooks present", true, "none — already migrated");
    }
  }

  // 7. Summary
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
