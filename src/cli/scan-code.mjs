// serif-brain scan code — sadece scan + ozet (graph build degil)
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { scanFiles, readFileSafe, countLines } from "../scanner/scan-files.mjs";
import { parseImportsFor, parseTodos } from "../scanner/parse-imports.mjs";
import { languageDef, LANGUAGES } from "../scanner/languages.mjs";
import { moduleStats } from "../scanner/module-owner.mjs";
import { scanPackageJsons, allDependencies } from "../scanner/package-scan.mjs";
import { loadConfig } from "../markdown/schema.mjs";

export async function scanCodeCommand({ args, subcommand }) {
  const target = subcommand[0];
  if (target !== "code") {
    console.error("Kullanim: serif-brain scan code [--project <yol>]");
    return 1;
  }
  const projectRoot = resolve(args.flags.project || process.cwd());
  if (!existsSync(projectRoot)) throw new Error(`Project not found: ${projectRoot}`);

  console.log(`[serif-brain scan code]`);
  console.log(`  Project: ${projectRoot}`);
  console.log(``);

  const t0 = Date.now();
  const brainRoot = join(projectRoot, ".serif-brain");
  const config = existsSync(brainRoot) ? loadConfig(brainRoot) : null;
  const files = scanFiles(projectRoot, { exclude_paths: config?.scan_exclude_paths });
  const stats = moduleStats(files, config);
  const packages = scanPackageJsons(projectRoot);
  const deps = allDependencies(packages);

  let totalImports = 0, totalTodos = 0, totalLoc = 0;
  for (const f of files) {
    const text = readFileSafe(f.abs_path);
    totalLoc += countLines(text);
    totalImports += parseImportsFor(f.rel_path, text).length;
    totalTodos += parseTodos(text).length;
  }
  const elapsed = Date.now() - t0;

  console.log(`  Files scanned: ${files.length}`);
  console.log(`  Lines of code: ${totalLoc.toLocaleString()}`);
  console.log(`  Imports parsed: ${totalImports}`);
  console.log(`  TODO/FIXME: ${totalTodos}`);
  console.log(`  package.json found: ${packages.length}`);
  console.log(`  External deps: ${deps.size}`);
  console.log(`  Elapsed: ${elapsed}ms`);
  console.log(``);
  // DIL DAGILIMI — ve en onemlisi: hangi dilde import grafi VAR, hangisinde YOK.
  // Sessizce yarim calismak yok: Swift/C# dosyalari indekslenir ama dosya-dosya
  // kenari uretilmez (o dillerde ayni modul icindeki dosyalar birbirini import
  // ETMEZ). Bunu soylemezsek kullanici "blast-radius 0" gorup "kimse kullanmiyor,
  // silebilirim" der — tehlikeli bir yanlis.
  const dilSayim = new Map();
  for (const f of files) {
    const d = languageDef(f.rel_path);
    const ad = d ? d.id : "diger";
    dilSayim.set(ad, (dilSayim.get(ad) || 0) + 1);
  }
  if (dilSayim.size) {
    console.log(``);
    console.log(`  Diller:`);
    for (const [id, n] of [...dilSayim].sort((a, b) => b[1] - a[1])) {
      const d = LANGUAGES[id];
      const etiket = !d ? "" : d.resolvable ? "import grafi VAR" : `import grafi YOK — ${d.note || "modul-tabanli dil"}`;
      console.log(`    ${(d?.label || id).padEnd(22)} ${String(n).padStart(5)} dosya   ${etiket}`);
    }
  }
  console.log(``);
  console.log(`  Module breakdown:`);
  const sorted = [...stats.entries()].sort((a, b) => b[1].files - a[1].files);
  for (const [mod, s] of sorted) {
    const kindStr = Object.entries(s.kinds).map(([k, c]) => `${k}:${c}`).join(", ");
    console.log(`    ${mod.padEnd(12)} ${String(s.files).padStart(4)} files  (${kindStr})`);
  }
  console.log(``);
  console.log(`  Sonraki: serif-brain graph build`);
  return 0;
}
