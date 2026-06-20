// "Bu dosyaya dokunmadan once ne bilmeliyim?" — PreToolUse(Edit) fisiltisinin cekirdegi.
// SAF fonksiyon: objeler + hedef dosya/modul -> ilgili hafiza (karar + bug).
// Faz: Active Memory. Amac: ajan editlemeden ONCE o dosya/modulun gecmis bug'larini
// ve bagli kararlarini gorsun → regresyon kod yazilmadan durur.
//
// Onemli: KAPALI bug'lar da dahil edilir ("yara izi" = bu dosyada bir kez su hata
// cozuldu, tekrar acma). Aktif kararlar ihlal edilmemesi gereken kisitlardir.
import { toResult, modulesOf } from "./search.mjs";

const WORKING = new Set(["open", "active", "in_progress", "blocked"]);
const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

function basenameOf(p) {
  return String(p || "").split("/").pop();
}

function fileMatches(relFiles, relPath, basename) {
  for (const f of relFiles) {
    if (!f) continue;
    if (relPath && (f === relPath || f.endsWith(relPath) || relPath.endsWith(f))) return true;
    if (basename && basenameOf(f) === basename) return true;
  }
  return false;
}

function rankBug(a, b) {
  const aw = WORKING.has(a.frontmatter.status) ? 0 : 1;
  const bw = WORKING.has(b.frontmatter.status) ? 0 : 1;
  if (aw !== bw) return aw - bw; // acik bug'lar once
  const pa = PRIORITY_RANK[a.frontmatter.priority] ?? 9;
  const pb = PRIORITY_RANK[b.frontmatter.priority] ?? 9;
  return pa - pb;
}

/**
 * @param objects loadObjects() ciktisi
 * @param opts { relPath, basename, module, limit=6 }
 */
export function compileTouch(objects, opts = {}) {
  const relPath = opts.relPath || null;
  const basename = opts.basename || (relPath ? basenameOf(relPath) : null);
  const module = opts.module && opts.module !== "unknown" ? opts.module : null;
  const limit = opts.limit ?? 6;

  // 1) Dogrudan dosya bagi (en guclu sinyal): relations.files eslesmesi
  const fileHitSet = new Set();
  const fileHits = [];
  for (const o of objects) {
    const relFiles = o.frontmatter?.relations?.files || [];
    if (relFiles.length && fileMatches(relFiles, relPath, basename)) {
      fileHits.push(o);
      if (o.frontmatter?.id) fileHitSet.add(o.frontmatter.id);
    }
  }

  // 2) Modul-seviyesi sinyal (dosya bagi olmayan, ayni modulde olanlar)
  const inModule = (o) =>
    module &&
    modulesOf(o.frontmatter || {}).includes(module) &&
    !fileHitSet.has(o.frontmatter?.id);

  const moduleDecisions = objects
    .filter((o) => o.frontmatter?.type === "decision" && inModule(o))
    .filter((o) => o.frontmatter.status !== "rejected" && o.frontmatter.status !== "archived")
    .slice(0, limit)
    .map((o) => toResult(o));

  const moduleBugs = objects
    .filter((o) => o.frontmatter?.type === "bug" && inModule(o))
    .sort(rankBug)
    .slice(0, limit)
    .map((o) => ({ ...toResult(o), closed: !WORKING.has(o.frontmatter.status) }));

  return {
    path: relPath,
    module,
    file_hits: fileHits.slice(0, limit).map((o) => toResult(o, { snippet: true })),
    module_decisions: moduleDecisions,
    module_bugs: moduleBugs,
    empty: fileHits.length === 0 && moduleDecisions.length === 0 && moduleBugs.length === 0,
  };
}

/** Kompakt, edit-basinda enjekte edilebilir uyari blogu. */
export function formatTouch(t) {
  if (t.empty) {
    return `[serif-brain touch] ${t.path || t.module || "?"} — ilgili hafiza kaydi yok (temiz).`;
  }
  const L = [];
  L.push(`[serif-brain touch] ${t.path || ""}${t.module ? ` · modul:${t.module}` : ""}`);

  if (t.file_hits.length) {
    L.push(`  🔗 Bu dosyaya dogrudan bagli (${t.file_hits.length}):`);
    for (const r of t.file_hits) L.push(`    ${r.type} ${r.id} — ${r.title} · ${r.status}`);
  }
  if (t.module_decisions.length) {
    L.push(`  📌 Modul kararlari — IHLAL ETME (${t.module_decisions.length}):`);
    for (const r of t.module_decisions) L.push(`    ${r.id} — ${r.title} · ${r.status}`);
  }
  if (t.module_bugs.length) {
    L.push(`  ⚠ Modul bug'lari (yara izi dahil) (${t.module_bugs.length}):`);
    for (const r of t.module_bugs) {
      const tag = r.closed ? "[cozuldu]" : `[${r.priority || "?"}]`;
      L.push(`    ${tag} ${r.id} — ${r.title}`);
    }
  }
  return L.join("\n");
}
