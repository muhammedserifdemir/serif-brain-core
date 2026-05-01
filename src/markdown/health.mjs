// Stale / orphan / duplicate detector.
import { isContextExcluded } from "./schema.mjs";

const DAY = 86400000;
const STALE_DAYS = 30;

export function detectHealth(objects, backlinks, opts = {}) {
  const now = opts.now || Date.now();
  const staleThreshold = (opts.stale_days || STALE_DAYS) * DAY;

  const stale = [];
  const orphan = [];
  const duplicates = [];
  const broken = [];

  // Stale: aktif/in_progress kayit, updated_at staleThreshold'tan eski
  for (const obj of objects) {
    if (obj.error) continue;
    const fm = obj.frontmatter;
    if (isContextExcluded(fm)) continue;
    const upd = fm.updated_at ? new Date(fm.updated_at).getTime() : (obj.mtime?.getTime() || 0);
    if (upd && now - upd > staleThreshold) {
      stale.push({ id: fm.id, type: fm.type, status: fm.status, updated_at: fm.updated_at, days_old: Math.floor((now - upd) / DAY) });
    }
  }

  // Orphan: hicbir backlink yok ve relations bos
  for (const obj of objects) {
    if (obj.error) continue;
    const fm = obj.frontmatter;
    if (fm.type === "session") continue; // sessionlar dogal olarak orphan baslar
    const incoming = backlinks.get(fm.id) || [];
    const rel = fm.relations || {};
    const outgoing =
      (rel.bugs?.length || 0) +
      (rel.decisions?.length || 0) +
      (rel.files?.length || 0) +
      (rel.modules?.length || 0);
    if (incoming.length === 0 && outgoing === 0) {
      orphan.push({ id: fm.id, type: fm.type });
    }
  }

  // Duplicate: ayni (project, module, normalized title), id farkli
  const titleMap = new Map();
  for (const obj of objects) {
    if (obj.error) continue;
    const fm = obj.frontmatter;
    const norm = `${fm.project || "?"}::${Array.isArray(fm.module) ? fm.module.join(",") : (fm.module || "?")}::${(fm.title || "").toLowerCase().replace(/\s+/g, " ").trim()}`;
    if (!titleMap.has(norm)) titleMap.set(norm, []);
    titleMap.get(norm).push(fm.id);
  }
  for (const [key, ids] of titleMap.entries()) {
    if (ids.length > 1) duplicates.push({ key, ids });
  }

  return { stale, orphan, duplicates };
}
