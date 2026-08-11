// "Son bakisimdan beri ne oldu?"
//
// NEDEN VAR: devralinan bir oturumda ILK sorulan soru budur ve brief'te
// karsiligi yoktu. `--days 7` sabit bir pencere sunuyordu; "benim gormedigim"
// ile "son 7 gun" ayni sey degil — iki gun ara verdiysen 7 gunluk pencere
// zaten bildiklerini de tekrar gosterir, bir hafta ara verdiysen kacirdigini
// hic gostermez.
//
// ISARET NEREDE: `.serif-brain/.cache/last-seen.json` — TUREVDIR, versiyonlanmaz
// (.serif-brain/.gitignore zaten .cache/ diyor). Hafiza objeleriyle karismaz.
//
// NE ZAMAN ILERLER: yalnizca acikca damgalandiginda (SessionStart hook'u
// damgalar). Elle `brief` calistirmak isareti ILERLETMEZ — yoksa ayni turda
// ikinci kez brief calistiran kisi farki kaybederdi.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getRecentCommits } from "./git-activity.mjs";

const CACHE_DIR = ".cache";
const FILE = "last-seen.json";

function markerPath(brainRoot) {
  return join(brainRoot, CACHE_DIR, FILE);
}

/** ISO string veya null (hic bakilmamis). */
export function readLastSeen(brainRoot) {
  try {
    const raw = JSON.parse(readFileSync(markerPath(brainRoot), "utf8"));
    return typeof raw?.at === "string" ? raw.at : null;
  } catch { return null; }
}

export function stampLastSeen(brainRoot, now = new Date()) {
  try {
    mkdirSync(join(brainRoot, CACHE_DIR), { recursive: true });
    writeFileSync(markerPath(brainRoot), JSON.stringify({ at: now.toISOString() }, null, 2) + "\n");
    return true;
  } catch { return false; }
}

const ts = (v) => {
  const t = Date.parse(v || "");
  return Number.isFinite(t) ? t : null;
};

/**
 * Isaretten bu yana degisenler. SAF: objeler ve commit listesi disaridan gelir.
 * @returns null (hic bakilmamis / isaret yok) veya ozet
 */
export function diffSince(objects, sinceIso, { commits = [], now = Date.now() } = {}) {
  const since = ts(sinceIso);
  if (!since) return null;

  const yeni = [];
  const kapanan = [];
  for (const o of objects || []) {
    const fm = o.frontmatter || o;
    if (!fm?.id) continue;
    const created = ts(fm.created_at);
    const completed = ts(fm.completed_at);
    if (created && created > since) yeni.push({ id: fm.id, type: fm.type, title: fm.title });
    // completed_at gun hassasiyetinde (YYYY-MM-DD) — gun sonuna kadar say ki
    // ayni gun kapatilan kayit "kapanmadi" gorunmesin.
    else if (completed && completed + 86399000 > since) kapanan.push({ id: fm.id, type: fm.type, title: fm.title });
  }

  return {
    since: sinceIso,
    gun: Math.max(0, Math.round((now - since) / 86400000)),
    yeni_kayit: yeni.length,
    kapanan_kayit: kapanan.length,
    commit: commits.length,
    ornek_yeni: yeni.slice(0, 3),
    ornek_kapanan: kapanan.slice(0, 3),
    sessiz: yeni.length === 0 && kapanan.length === 0 && commits.length === 0,
  };
}

/** CLI/hook icin: isareti oku, git'i tara, ozeti uret. */
export function summarizeSince(brainRoot, projectRoot, objects, { now = new Date() } = {}) {
  const sinceIso = readLastSeen(brainRoot);
  if (!sinceIso) return null;
  const gun = Math.max(1, Math.ceil((now.getTime() - Date.parse(sinceIso)) / 86400000));
  let commits = [];
  try { commits = getRecentCommits(projectRoot, Math.min(gun, 90)); } catch { /* git yok */ }
  const sinceMs = Date.parse(sinceIso);
  const yeniCommits = commits.filter((c) => {
    const t = ts(c.date);
    return t === null ? true : t > sinceMs;
  });
  return diffSince(objects, sinceIso, { commits: yeniCommits, now: now.getTime() });
}
