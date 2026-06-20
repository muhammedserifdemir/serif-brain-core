// serif-brain stale [--days N] [--quiet]
// Acik kararlar/bug'larin son N gunde degisen dosyalarla overlap'ini tespit eder.
// SessionStart hook'unda kullanilmak uzere lightweight: hicbir sey yoksa cikis 0 ve sessiz.
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { listAllObjects, listProjects } from "../markdown/object.mjs";
import { getRecentChangedFiles, getRecentCommitTitles } from "../query/git-activity.mjs";

const OPEN_STATUSES = new Set(["in_progress", "open", "active", "queued"]);
const CLOSED_STATUSES = new Set(["done", "closed", "completed", "rejected", "archived"]);

export async function staleCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    if (!args.flags.quiet) console.error(`[serif-brain stale] brain root yok: ${brainRoot}`);
    return 0;
  }

  const days = parseInt(args.flags.days, 10) || 14;
  const quiet = !!args.flags.quiet;

  const projects = listProjects(brainRoot);
  if (projects.length === 0) return 0;

  const changedFiles = getRecentChangedFiles(projectRoot, days);
  const commitTitles = getRecentCommitTitles(projectRoot, days);

  const candidates = [];
  for (const project of projects) {
    const objs = listAllObjects(brainRoot, project);
    for (const obj of objs) {
      if (obj.error || !obj.frontmatter) continue;
      const fm = obj.frontmatter;
      if (!OPEN_STATUSES.has(fm.status)) continue;
      if (fm.type !== "decision" && fm.type !== "bug") continue;

      let signal = null;
      let evidence = "";

      const relFiles = (fm.relations && fm.relations.files) || [];
      const fileHit = relFiles.find(p => changedFiles.has(p));
      if (fileHit) { signal = "strong"; evidence = `file: ${fileHit}`; }

      if (!signal) {
        const modules = Array.isArray(fm.module) ? fm.module : [fm.module];
        const mod = modules.find(m => m && m !== "unknown" && commitTitles.includes(String(m).toLowerCase()));
        if (mod) { signal = "weak"; evidence = `module: ${mod} in commits`; }
      }

      if (signal) {
        candidates.push({
          id: fm.id,
          type: fm.type,
          status: fm.status,
          title: fm.title,
          signal,
          evidence
        });
      }
    }
  }

  if (candidates.length === 0) {
    if (!quiet) console.log(`[serif-brain stale] son ${days} gunde overlap yok — temiz.`);
    return 0;
  }

  const strong = candidates.filter(c => c.signal === "strong");
  const weak = candidates.filter(c => c.signal === "weak");

  console.log(``);
  console.log(`[serif-brain stale] ⚠ ${candidates.length} acik kalem son ${days} gun aktivitesiyle ortusuyor`);
  console.log(`  Strong (relations.files match): ${strong.length}`);
  console.log(`  Weak   (module name in commit): ${weak.length}`);
  console.log(``);
  console.log(`  Kapatma onerisi icin: /reconcile-brain`);
  console.log(``);

  if (!quiet && process.env.SERIF_BRAIN_DEBUG) {
    for (const c of candidates) {
      console.log(`  [${c.signal}] ${c.id} (${c.status}) — ${c.evidence}`);
    }
  }

  return 0;
}
