// serif-brain lint [dosya...] [--json]
// config 'bug_signatures' imzalarini dosyalara karsi tarar (projeye-ozel linter).
import { resolve, join, relative, isAbsolute } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { scanFiles, readFileSafe } from "../scanner/scan-files.mjs";
import { lintContent, formatLint } from "../query/signatures.mjs";
import { posixYol } from "../util/yol.mjs";

export async function lintCommand({ args, subcommand }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);

  const config = loadConfig(brainRoot);
  const signatures = config?.bug_signatures || [];

  if (!signatures.length) {
    console.log(formatLint([], { sigCount: 0 }));
    return 0;
  }

  // Hedef dosyalar: argumanlar (yol) veya tum kaynak dosyalar.
  let targets;
  if (subcommand.length) {
    targets = subcommand.map((p) => {
      const abs = isAbsolute(p) ? p : resolve(projectRoot, p);
      return { abs, rel: posixYol(relative(projectRoot, abs)) || p };
    });
  } else {
    targets = scanFiles(projectRoot).map((f) => ({ abs: join(projectRoot, f.rel_path), rel: f.rel_path }));
  }

  const findings = [];
  for (const t of targets) {
    const text = readFileSafe(t.abs);
    if (text == null) continue;
    findings.push(...lintContent(t.rel, text, signatures));
  }

  if (args.flags.json) {
    console.log(JSON.stringify({ signatures: signatures.length, files: targets.length, count: findings.length, findings }, null, 2));
    return findings.length ? 2 : 0;
  }
  console.log(formatLint(findings, { sigCount: signatures.length, fileCount: targets.length }));
  return findings.length ? 2 : 0; // CI: eslesme varsa non-zero
}
