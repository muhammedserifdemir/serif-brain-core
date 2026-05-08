// serif-brain close <id> [--commit <sha>] [--note "..."] [--project_id <name>]
// Frontmatter'i flip eder: status -> done|closed, completed_at + updated_at set,
// optional commit/note appended.
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { readObject, writeObject, objectPath, listProjects } from "../markdown/object.mjs";

export async function closeCommand({ args, subcommand }) {
  const id = subcommand[0];
  if (!id || args.flags.help || args.flags.h) {
    console.error(`[serif-brain close] kullanim: serif-brain close <id> [--commit <sha>] [--note "..."] [--project_id <name>]`);
    console.error(`  Decision -> status: done`);
    console.error(`  Bug      -> status: closed`);
    console.error(`  Auto: completed_at + updated_at = bugun, opsiyonel commit/note frontmatter'a yazilir,`);
    console.error(`        --note verilirse body sonuna "## Tamamlanma (YYYY-MM-DD)" basligi eklenir.`);
    return id ? 0 : 1;
  }

  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  loadConfig(brainRoot);

  const type = id.startsWith("bug-") ? "bug"
            : id.startsWith("decision-") ? "decision"
            : null;
  if (!type) {
    console.error(`[serif-brain close] id 'bug-' veya 'decision-' ile baslamali: ${id}`);
    return 1;
  }

  // Project resolution: explicit flag > single-project default > error
  let project = args.flags.project_id;
  if (!project) {
    const projects = listProjects(brainRoot);
    if (projects.length === 1) project = projects[0];
    else if (projects.length === 0) { console.error(`[serif-brain close] hic proje yok`); return 1; }
    else {
      console.error(`[serif-brain close] coklu proje var, --project_id <name> ekle: ${projects.join(", ")}`);
      return 1;
    }
  }

  const targetPath = objectPath(brainRoot, project, type, id);
  if (!existsSync(targetPath)) {
    console.error(`[serif-brain close] bulunamadi: ${targetPath}`);
    return 1;
  }

  const { frontmatter: fm, body } = readObject(targetPath);
  // Schema valid statuses: queued, open, active, in_progress, blocked, done, rejected, archived.
  // Hem bug hem decision icin terminal status: done.
  const newStatus = "done";
  const wasAlreadyClosed = ["done", "rejected", "archived"].includes(fm.status);
  if (wasAlreadyClosed && !args.flags.force) {
    console.log(`[serif-brain close] ${id} zaten ${fm.status} (force icin --force)`);
    return 0;
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const prevStatus = fm.status;
  fm.status = newStatus;
  fm.updated_at = nowIso;
  fm.completed_at = today;
  if (args.flags.commit) fm.commit = args.flags.commit;

  let newBody = body;
  if (args.flags.note) {
    const noteSection = [
      ``,
      ``,
      `## Tamamlanma (${today})`,
      ``,
      args.flags.note,
      ``
    ];
    if (args.flags.commit) noteSection.push(`Commit: \`${args.flags.commit}\``, ``);
    newBody = newBody.replace(/\s+$/, "") + noteSection.join("\n");
  }

  const result = writeObject(brainRoot, fm, newBody);
  console.log(`[serif-brain close] ${id}`);
  console.log(`  ✓ status: ${prevStatus} → ${newStatus}`);
  console.log(`  ✓ completed_at: ${today}`);
  if (args.flags.commit) console.log(`  ✓ commit: ${args.flags.commit}`);
  if (args.flags.note) console.log(`  ✓ note appended`);
  if (result.validation.warnings.length > 0) {
    for (const w of result.validation.warnings) console.log(`  ⚠ ${w}`);
  }
  console.log(``);
  console.log(`  Sonraki: serif-brain rebuild-indexes && serif-brain context`);
  return 0;
}
