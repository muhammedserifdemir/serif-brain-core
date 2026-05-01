// Backlink resolver: relations[] + [[id]] mention'lardan ters indeks.
// Mention regex sadece SerifBrain canonical id formatlarini eslestirir.
// Eski Obsidian wiki-link basename'leri (ornek: [[2026-04-28-...]]) goz ardi edilir.
const MENTION_RE = /\[\[((?:bug|decision|note|session)-[a-z0-9-]+)\]\]/g;

export function buildBacklinks(objects) {
  const backlinks = new Map();
  const allIds = new Set(objects.map(o => o.frontmatter?.id).filter(Boolean));
  const broken = [];

  function add(target, source, kind) {
    if (!backlinks.has(target)) backlinks.set(target, []);
    backlinks.get(target).push({ source, kind });
  }

  for (const obj of objects) {
    if (obj.error) continue;
    const fm = obj.frontmatter;
    const sourceId = fm.id;
    if (!sourceId) continue;

    // 1) Explicit relations
    const rel = fm.relations || {};
    for (const k of ["bugs", "decisions"]) {
      const list = Array.isArray(rel[k]) ? rel[k] : [];
      for (const t of list) {
        if (typeof t !== "string") continue;
        if (allIds.has(t)) add(t, sourceId, `relations.${k}`);
        else broken.push({ source: sourceId, target: t, kind: `relations.${k}` });
      }
    }

    // 2) [[id]] mentions in body
    const body = obj.body || "";
    let m;
    MENTION_RE.lastIndex = 0;
    while ((m = MENTION_RE.exec(body)) !== null) {
      const target = m[1];
      if (allIds.has(target)) add(target, sourceId, "mention");
      else broken.push({ source: sourceId, target, kind: "mention" });
    }
  }

  return { backlinks, broken };
}
