// serif-brain scan code — sadece scan + ozet (graph build degil)
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { scanFiles, readFileSafe, countLines } from "../scanner/scan-files.mjs";
import { parseImports, parseTodos } from "../scanner/parse-imports.mjs";
import { ownerOf, moduleStats } from "../scanner/module-owner.mjs";
import { scanPackageJsons, allDependencies } from "../scanner/package-scan.mjs";

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
  const files = scanFiles(projectRoot);
  const stats = moduleStats(files);
  const packages = scanPackageJsons(projectRoot);
  const deps = allDependencies(packages);

  let totalImports = 0, totalTodos = 0, totalLoc = 0;
  for (const f of files) {
    const text = readFileSafe(f.abs_path);
    totalLoc += countLines(text);
    totalImports += parseImports(text).length;
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
