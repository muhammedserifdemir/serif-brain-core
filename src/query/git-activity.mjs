// Git aktivite sinyali — son N gunde degisen dosyalar + commit basliklari.
// `stale` ve `brief` ortak kullanir (eskiden stale icinde inline'di). Git yoksa
// veya repo degilse sessizce bos doner — brain git-bagimsiz calismali.
import { execSync } from "node:child_process";

export function getRecentChangedFiles(projectRoot, days) {
  try {
    const out = execSync(
      `git -C "${projectRoot}" log --since="${days} days ago" --name-only --pretty=format:`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return new Set(out.split("\n").map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function getRecentCommitTitles(projectRoot, days) {
  try {
    return execSync(
      `git -C "${projectRoot}" log --since="${days} days ago" --pretty=format:%s`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).toLowerCase();
  } catch {
    return "";
  }
}

// Calisma agacindaki degisen dosyalar (review-diff icin). ref vs working tree.
// Default HEAD: commit'lenmemis tum degisiklikler. Untracked'i de ekler.
export function getChangedFiles(projectRoot, ref = "HEAD") {
  const files = new Set();
  try {
    const diff = execSync(`git -C "${projectRoot}" diff --name-only ${ref}`, {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    });
    for (const f of diff.split("\n").map((s) => s.trim()).filter(Boolean)) files.add(f);
  } catch { /* git yok/ref yok */ }
  try {
    const untracked = execSync(`git -C "${projectRoot}" ls-files --others --exclude-standard`, {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    });
    for (const f of untracked.split("\n").map((s) => s.trim()).filter(Boolean)) files.add(f);
  } catch { /* yoksay */ }
  return [...files];
}

// Son N gundeki commit'ler + degisen dosyalari — auto-capture (write-back) icin.
// Sekil: [{ hash, date, subject, files: [...] }]. Git yoksa bos dizi.
// `date` (ISO, %aI) sonradan eklendi: "son bakisimdan beri" hesabi gun degil AN
// hassasiyeti ister — gun penceresi, ayni gun icinde bakilani da kacirilan
// sayar.
export function getRecentCommits(projectRoot, days) {
  try {
    // \x1e (RS) her commit'i ayirir; \x1f (US) hash ile subject'i ayirir.
    const out = execSync(
      `git -C "${projectRoot}" log --since="${days} days ago" --name-only --pretty=format:"%x1e%H%x1f%aI%x1f%s"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 },
    );
    const commits = [];
    for (const rec of out.split("\x1e")) {
      const lines = rec.split("\n").map((s) => s.trim()).filter(Boolean);
      if (!lines.length) continue;
      const [hash, date = "", subject = ""] = lines[0].split("\x1f");
      if (!hash) continue;
      commits.push({ hash, date, subject, files: lines.slice(1) });
    }
    return commits;
  } catch {
    return [];
  }
}

/** brief/stale icin tek cagrida toplu git sinyali. Git yoksa bos+available:false. */
export function gitActivity(projectRoot, days) {
  const changedFiles = getRecentChangedFiles(projectRoot, days);
  const commitTitles = getRecentCommitTitles(projectRoot, days);
  return {
    available: changedFiles.size > 0 || commitTitles.length > 0,
    changedFiles,
    commitTitles,
  };
}
