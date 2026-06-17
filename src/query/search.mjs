// Sorgu/arama çekirdeği — hem `search` CLI'ı hem MCP sunucusu bunu kullanır.
// Saf-Node, bağımlılık yok. Yapısal filtreler + tam-metin (başlık ağırlıklı) skor.
import { listAllObjects, listProjects } from "../markdown/object.mjs";

function asArr(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export function modulesOf(fm) {
  return asArr(fm.module).filter(Boolean);
}

/** Brain'deki (geçerli) tüm objeleri yükle. */
export function loadObjects(brainRoot, { project } = {}) {
  let projects = listProjects(brainRoot);
  if (project) projects = projects.filter((p) => p === project);
  const out = [];
  for (const p of projects) {
    for (const o of listAllObjects(brainRoot, p)) {
      if (!o.error) out.push(o);
    }
  }
  return out;
}

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

function recencyMs(fm) {
  const t = fm.updated_at || fm.created_at;
  const ms = t ? new Date(t).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function byPriorityThenRecency(a, b) {
  const pa = PRIORITY_RANK[a.frontmatter.priority] ?? 9;
  const pb = PRIORITY_RANK[b.frontmatter.priority] ?? 9;
  if (pa !== pb) return pa - pb;
  return recencyMs(b.frontmatter) - recencyMs(a.frontmatter);
}

// Tam-metin skoru: başlık eşleşmesi gövdeden ağır; tüm terimler geçmeli (AND).
function scoreText(o, terms) {
  const title = String(o.frontmatter.title || "").toLowerCase();
  const id = String(o.frontmatter.id || "").toLowerCase();
  const body = String(o.body || "").toLowerCase();
  let score = 0;
  for (const t of terms) {
    const inTitle = title.includes(t);
    const inId = id.includes(t);
    const bodyHits = body.split(t).length - 1;
    if (!inTitle && !inId && bodyHits === 0) return 0; // AND: terim hiç yoksa eleme
    if (inTitle) score += 10;
    if (inId) score += 6;
    score += Math.min(bodyHits, 5); // gövde tekrarını sınırla
  }
  return score;
}

/**
 * Objeleri sorgula.
 * q: { text, type, status, priority, module, project, owner, tag, updated_since, limit }
 */
export function searchObjects(objects, q = {}) {
  const statusF = asArr(q.status);
  const priorityF = asArr(q.priority);

  let res = objects.filter((o) => {
    const fm = o.frontmatter || {};
    if (q.type && fm.type !== q.type) return false;
    if (statusF.length && !statusF.includes(fm.status)) return false;
    if (priorityF.length && !priorityF.includes(fm.priority)) return false;
    if (q.module && !modulesOf(fm).includes(q.module)) return false;
    if (q.project && fm.project !== q.project) return false;
    if (q.owner && (fm.owner || "") !== q.owner) return false;
    if (q.tag && !asArr(fm.tags).includes(q.tag)) return false;
    if (q.updated_since && recencyMs(fm) < new Date(q.updated_since).getTime()) return false;
    return true;
  });

  const text = (q.text || "").trim().toLowerCase();
  if (text) {
    const terms = text.split(/\s+/).filter(Boolean);
    res = res
      .map((o) => ({ o, score: scoreText(o, terms) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.o);
  } else {
    res = res.slice().sort(byPriorityThenRecency);
  }

  const limit = Number.isFinite(q.limit) && q.limit > 0 ? q.limit : res.length;
  return res.slice(0, limit);
}

/** Bir objeyi kompakt sonuç şekline indir (CLI/MCP çıktısı için). */
export function toResult(o, { snippet = false } = {}) {
  const fm = o.frontmatter || {};
  const r = {
    id: fm.id,
    type: fm.type,
    title: fm.title,
    status: fm.status,
    priority: fm.priority || null,
    module: modulesOf(fm),
    project: fm.project,
    updated_at: fm.updated_at || fm.created_at || null,
    file: o.file_path,
  };
  if (snippet) {
    const body = String(o.body || "").replace(/\s+/g, " ").trim();
    r.snippet = body.slice(0, 200);
  }
  return r;
}
