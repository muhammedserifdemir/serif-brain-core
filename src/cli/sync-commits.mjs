// serif-brain sync-commits [--since-days N] [--dry-run]
// Commit mesajindaki `Brain-Closes: <id>[, <id>...]` trailer'ini okuyup ilgili
// bug/decision objesini otomatik kapatir. "Isi bitirdim ama brain'i guncellemeyi
// unuttum" sorununu commit'in kendisiyle cozer.
import { resolve, join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { listProjects } from "../markdown/object.mjs";

const TRAILER_RE = /^\s*Brain-Closes:\s*(.+)$/gim;
const CLOSED_STATUS = ["done", "closed", "completed"];
const SEARCH_DIRS = ["decisions", "bugs"];

// Son N gundeki commit'ler: hash \x1f subject \x1f body \x1e. Git yoksa bos dizi.
function recentCommits(projectRoot, days) {
  try {
    const out = execSync(
      `git -C "${projectRoot}" log --since="${days} days ago" --pretty=format:%H%x1f%s%x1f%b%x1e`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 },
    );
    const commits = [];
    for (const rec of out.split("\x1e")) {
      const [hash, subject = "", body = ""] = rec.split("\x1f");
      const h = (hash || "").trim();
      if (!h) continue;
      commits.push({ hash: h, subject, body });
    }
    return commits;
  } catch {
    return [];
  }
}

// Trailer degeri virgul VEYA bosluk ayrilmis liste olabilir.
function idsFromCommit(commit) {
  const ids = [];
  const text = `${commit.subject}\n${commit.body}`;
  for (const m of text.matchAll(TRAILER_RE)) {
    for (const raw of m[1].split(/[,\s]+/)) {
      const id = raw.trim().replace(/[.,;]+$/, "");
      if (id) ids.push(id);
    }
  }
  return ids;
}

function findObjectFile(brainRoot, id) {
  for (const project of listProjects(brainRoot)) {
    for (const dir of SEARCH_DIRS) {
      const p = join(brainRoot, "objects", "projects", project, dir, `${id}.md`);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

function statusOf(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const s = m[1].match(/^status:\s*["']?([a-z_]+)["']?\s*$/mi);
  return s ? s[1].toLowerCase() : null;
}

// Frontmatter blogunu YERINDE duzenler — geri kalan dosya bit-birebir korunur.
// Bilerek readObject/writeObject kullanmiyoruz: o yol YAML'i yeniden serialize
// eder ve tanimadigi alanlarin bicimini degistirebilir.
function closeInText(text, shortSha, nowIso) {
  const m = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!m) return null;
  let fm = m[2];

  fm = /^status:\s*.*$/mi.test(fm)
    ? fm.replace(/^status:\s*.*$/mi, `status: done`)
    : `${fm}\nstatus: done`;

  fm = /^updated_at:\s*.*$/mi.test(fm)
    ? fm.replace(/^updated_at:\s*.*$/mi, `updated_at: "${nowIso}"`)
    : `${fm}\nupdated_at: "${nowIso}"`;

  const head = m[1] + fm + m[3];
  const rest = text.slice(m[0].length);
  const stamp = `\n\n> Kapatildi: commit ${shortSha} (Brain-Closes trailer, ${nowIso})\n`;
  return head + rest.replace(/\s+$/, "") + stamp;
}

export async function syncCommitsCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }

  const days = parseInt(args.flags["since-days"], 10) || 14;
  const dryRun = !!args.flags["dry-run"];

  const commits = recentCommits(projectRoot, days);
  const nowIso = new Date().toISOString();
  const closed = [];
  const already = [];
  const missing = [];
  const seen = new Set();

  for (const commit of commits) {
    const shortSha = commit.hash.slice(0, 7);
    for (const id of idsFromCommit(commit)) {
      if (seen.has(id)) continue;
      seen.add(id);

      const file = findObjectFile(brainRoot, id);
      if (!file) { missing.push(id); continue; }

      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        missing.push(id);
        continue;
      }

      const status = statusOf(text);
      if (status && CLOSED_STATUS.includes(status)) { already.push(id); continue; }

      const next = closeInText(text, shortSha, nowIso);
      if (next === null) { missing.push(id); continue; }

      if (!dryRun) {
        try {
          writeFileSync(file, next);
        } catch (e) {
          console.error(`  ⚠ yazilamadi (${id}): ${e.message}`);
          continue;
        }
      }
      closed.push({ id, shortSha, from: status || "(yok)", file });
    }
  }

  console.log(`[serif-brain sync-commits] ${commits.length} commit tarandi (son ${days} gun)${dryRun ? " — DRY-RUN" : ""}`);
  for (const c of closed) {
    console.log(`  ${dryRun ? "~" : "✓"} ${c.id}: ${c.from} → done (commit ${c.shortSha})`);
  }
  console.log(`[serif-brain sync-commits] kapatildi: ${closed.length} | zaten kapali: ${already.length} | bulunamadi: ${missing.length}`);
  if (missing.length > 0) {
    for (const id of missing) console.log(`  ? bulunamadi: ${id}`);
  }
  if (dryRun && closed.length > 0) {
    console.log(``);
    console.log(`  DRY-RUN — yazilmadi. Yazmak icin: serif-brain sync-commits --since-days ${days}`);
  }
  if (!dryRun && closed.length > 0) {
    console.log(``);
    console.log(`  Sonraki: serif-brain rebuild-indexes && serif-brain context`);
  }
  return 0;
}
