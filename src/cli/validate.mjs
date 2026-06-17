// serif-brain validate — her objeyi şemaya göre doğrula; parse/şema hatalarını
// DOSYA YOLU + neden ile listele. doctor'ın özetinin aksine bu komut yalnızca
// doğrulamaya odaklanır ve hata varsa kod 1 ile çıkar (CI/script dostu).
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig, validateObject } from "../markdown/schema.mjs";
import { listAllObjects, listProjects } from "../markdown/object.mjs";

export async function validateCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }

  loadConfig(brainRoot);
  const showWarnings = args.flags.warnings === true || args.flags.w === true;
  const projectFilter = typeof args.flags.project_id === "string" ? args.flags.project_id : null;

  let projects = listProjects(brainRoot);
  if (projectFilter) projects = projects.filter((p) => p === projectFilter);

  const rel = (f) => (f && f.startsWith(brainRoot) ? f.slice(brainRoot.length + 1) : f);
  let total = 0, parseFailed = 0, invalid = 0, warned = 0;
  const parseFiles = [], invalidFiles = [], warnFiles = [];

  for (const project of projects) {
    for (const obj of listAllObjects(brainRoot, project)) {
      total++;
      if (obj.error) {
        parseFailed++;
        parseFiles.push({ file: rel(obj.file_path), error: obj.error });
        continue;
      }
      const v = validateObject(obj.frontmatter);
      if (!v.valid) {
        invalid++;
        invalidFiles.push({ file: rel(obj.file_path), errors: v.errors });
      }
      if (v.warnings.length) {
        warned += v.warnings.length;
        warnFiles.push({ file: rel(obj.file_path), warnings: v.warnings });
      }
    }
  }

  console.log(`[serif-brain validate]`);
  console.log(`  Brain: ${brainRoot}`);
  console.log(`  Taranan: ${total} obje${projectFilter ? ` (proje: ${projectFilter})` : ""}`);
  console.log(`  Parse hatası: ${parseFailed} · Şema-geçersiz: ${invalid} · Uyarı: ${warned}`);

  if (parseFiles.length) {
    console.log(`\n  ✗ Parse hatası (${parseFiles.length}):`);
    for (const f of parseFiles) console.log(`    - ${f.file}\n        ${f.error}`);
  }
  if (invalidFiles.length) {
    console.log(`\n  ✗ Şema-geçersiz (${invalidFiles.length}):`);
    for (const f of invalidFiles) console.log(`    - ${f.file}\n        ${f.errors.join("\n        ")}`);
  }
  if (warnFiles.length) {
    if (showWarnings) {
      console.log(`\n  · Uyarılar (${warnFiles.length}):`);
      for (const f of warnFiles) console.log(`    - ${f.file}\n        ${f.warnings.join("\n        ")}`);
    } else {
      console.log(`\n  (${warnFiles.length} dosyada uyarı var — detay için: validate --warnings)`);
    }
  }

  if (parseFailed === 0 && invalid === 0) {
    console.log(`\n  ✓ Tüm objeler şemaya uygun.`);
    return 0;
  }
  console.log(`\n  ✗ ${parseFailed + invalid} obje düzeltilmeli.`);
  return 1;
}
