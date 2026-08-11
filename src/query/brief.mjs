// Oturum-acilisi "neredeyiz" brief'i — Faz: Active Memory'nin cekirdegi.
// SAF fonksiyon: objeler (+ opsiyonel git sinyali) -> yapisal ozet. I/O yok,
// boylece test edilebilir; CLI (`brain brief`) ve MCP (`brain_brief`) bunu sarar.
//
// Amac: ajan oturum acar acmaz "gecen sefer neredeydik" gormeli — aktif
// kritik/yuksek bug'lar, aktif kararlar, son dokunulan kalemler, ve PARK edilmis
// (queued) faz kuyrugu. Hafiza ajana GELIR; ajan onu aramak zorunda kalmaz.
import { searchObjects, toResult, modulesOf } from "./search.mjs";

// Aktif is = acik/devam eden; queued backlog ayri raporlanir (park kuyrugu).
const WORKING_STATUSES = ["open", "active", "in_progress", "blocked"];
const CLOSED_STATUSES = new Set(["done", "rejected", "archived", "closed", "completed"]);

function updatedMs(fm) {
  const t = fm.updated_at || fm.created_at;
  const ms = t ? new Date(t).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * @param objects loadObjects() ciktisi (hatasiz objeler)
 * @param opts { now, days=7, module=null, limit=5, git=null }
 *   git: { changedFiles:Set, commitTitles:string } | null  (gitActivity ciktisi)
 */
// opts.uncaptured: { count, top:[{type,title}] } — hafizada karsiligi olmayan
// commit'ler. compileBrief SAF kalsin diye git'e kendisi bakmaz; CLI doldurur.
export function compileBrief(objects, opts = {}) {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? 7;
  const module = opts.module ?? null;
  const limit = opts.limit ?? 5;
  const windowStart = now - days * 86400000;

  // 1-2) Aktif kalemler.
  //
  // SINIR NEDEN SART: brief ciktisi her oturuma girer. Bu uc liste
  // SINIRSIZDI — `limit` parametresi vardi ama yalnizca asagidaki iki liste
  // onu kullaniyordu. Olcum (5000 kayitlik sentetik brain): brief ciktisi
  // 6.297 token. Hafiza sistemi olmanin sarti bagliami SINIRLI tutmaktir;
  // sinirsiz buyuyen ozet, ozetlemenin kendisini iptal eder.
  //
  // Kirpilan sayi GIZLENMEZ ("+N daha") — sessiz kirpma, "hepsi bu" gibi
  // okunur ve yanlis guven uretir.
  const kirp = (arr) => ({ top: arr.slice(0, limit), count: arr.length });

  const bugsAll = searchObjects(objects, {
    type: "bug",
    status: WORKING_STATUSES,
    priority: ["critical", "high"],
    module,
  }).map((o) => toResult(o, { snippet: true }));
  const decisionsAll = searchObjects(objects, {
    type: "decision",
    status: ["active", "in_progress"],
    module,
  }).map((o) => toResult(o));
  const plansAll = searchObjects(objects, {
    type: "plan",
    status: ["active", "in_progress"],
    module,
  }).map((o) => toResult(o));

  const activeBugs = bugsAll.slice(0, limit);
  const activeDecisions = decisionsAll.slice(0, limit);
  const activePlans = plansAll.slice(0, limit);
  const totals = { bugs: bugsAll.length, decisions: decisionsAll.length, plans: plansAll.length };

  // 3) Pencere icinde son dokunulan (aktif) kalemler — "neredeydik".
  // queued ayri "park kuyrugu" bolumunde gosterilir → burada cift-listeleme.
  const recentlyTouched = objects
    .filter((o) => {
      const fm = o.frontmatter || {};
      if (CLOSED_STATUSES.has(fm.status) || fm.status === "queued") return false;
      if (module && !modulesOf(fm).includes(module)) return false;
      return updatedMs(fm) >= windowStart;
    })
    .sort((a, b) => updatedMs(b.frontmatter) - updatedMs(a.frontmatter))
    .slice(0, limit)
    .map((o) => toResult(o));

  // 4) Park kuyrugu (queued) = gelecek-faz backlog'u. Faz sinirinda gozden gecirilir.
  const parkedAll = objects.filter((o) => {
    const fm = o.frontmatter || {};
    if (fm.status !== "queued") return false;
    if (module && !modulesOf(fm).includes(module)) return false;
    return true;
  });
  const parked = {
    count: parkedAll.length,
    top: parkedAll
      .sort((a, b) => updatedMs(b.frontmatter) - updatedMs(a.frontmatter))
      .slice(0, limit)
      .map((o) => toResult(o)),
  };

  // 5) Git sinyali (opsiyonel) — commit basliklarinda gecen modul adlari + sayac
  let git = null;
  if (opts.git && opts.git.available !== false) {
    const titles = String(opts.git.commitTitles || "");
    const known = new Set();
    for (const o of objects) for (const m of modulesOf(o.frontmatter || {})) known.add(m);
    const modulesInCommits = [...known].filter(
      (m) => m && m !== "unknown" && titles.includes(String(m).toLowerCase()),
    );
    git = {
      changed_files: opts.git.changedFiles?.size ?? 0,
      modules_in_commits: modulesInCommits,
    };
  }

  return {
    scope: module ? `module:${module}` : "global",
    window_days: days,
    active_bugs: activeBugs,
    active_decisions: activeDecisions,
    active_plans: activePlans,
    // Kirpilan sayilar: liste 'limit' ile sinirli, TOPLAM burada durur.
    totals,
    recently_touched: recentlyTouched,
    parked,
    since: opts.since ?? null,
    uncaptured: opts.uncaptured ?? null,
    git,
  };
}

// Kirpilan kayit sayisini ACIKCA soyler. Sessiz kirpma "hepsi bu" gibi okunur.
function fazla(toplam, gosterilen, komut) {
  if (!Number.isFinite(toplam) || toplam <= gosterilen) return [];
  return [`    … +${toplam - gosterilen} daha (serif-brain search ${komut})`];
}

/** Brief'i kompakt, token-ucuz metne dok (CLI/hook ciktisi). */
export function formatBrief(b) {
  const L = [];
  L.push(`[serif-brain brief] ${b.scope} · son ${b.window_days} gun`);

  if (b.git) {
    const mods = b.git.modules_in_commits.length ? ` · aktif modul: ${b.git.modules_in_commits.join(",")}` : "";
    L.push(`  git: ${b.git.changed_files} dosya degisti${mods}`);
  }

  L.push(``);
  L.push(`  🗺  Aktif plan (${(b.active_plans || []).length}):`);
  if (!(b.active_plans || []).length) L.push(`    (yok)`);
  for (const r of b.active_plans || []) L.push(`    ${r.id} — ${r.title}`);

  L.push(``);
  L.push(`  ⛔ Aktif kritik/yuksek bug (${b.totals?.bugs ?? b.active_bugs.length}):`);
  if (!b.active_bugs.length) L.push(`    (yok)`);
  for (const r of b.active_bugs) {
    L.push(`    [${r.priority}] ${r.id} — ${r.title}${r.module.length ? ` (${r.module.join(",")})` : ""}`);
  }
  L.push(...fazla(b.totals?.bugs, b.active_bugs.length, "--type bug --status open"));

  L.push(``);
  L.push(`  📌 Aktif kararlar (${b.totals?.decisions ?? b.active_decisions.length}):`);
  if (!b.active_decisions.length) L.push(`    (yok)`);
  for (const r of b.active_decisions) L.push(`    ${r.id} — ${r.title}`);
  L.push(...fazla(b.totals?.decisions, b.active_decisions.length, "--type decision --status active"));

  L.push(``);
  L.push(`  🕑 Son dokunulan (${b.recently_touched.length}):`);
  if (!b.recently_touched.length) L.push(`    (yok)`);
  for (const r of b.recently_touched) {
    L.push(`    ${r.type} ${r.id} — ${r.title} · ${r.status}`);
  }

  if (b.since && !b.since.sessiz) {
    L.push(``);
    L.push(`  🆕 Son bakistan beri (${b.since.gun} gun): ` +
      `${b.since.yeni_kayit} yeni kayit · ${b.since.kapanan_kayit} kapandi · ${b.since.commit} commit`);
    for (const r of b.since.ornek_yeni) L.push(`    + [${r.type}] ${r.title}`);
    for (const r of b.since.ornek_kapanan) L.push(`    ✓ [${r.type}] ${r.title}`);
  }

  if (b.uncaptured?.count) {
    L.push(``);
    L.push(`  📝 Hafizaya gecmemis commit (${b.uncaptured.count}):`);
    for (const r of b.uncaptured.top) L.push(`    [${r.type}] ${r.title}`);
    if (b.uncaptured.count > b.uncaptured.top.length) {
      L.push(`    … +${b.uncaptured.count - b.uncaptured.top.length} daha`);
    }
    L.push(`    Yaz: serif-brain capture --days ${b.uncaptured.days ?? 14} --apply`);
  }

  L.push(``);
  L.push(`  📥 Park kuyrugu / queued (${b.parked.count}):`);
  if (!b.parked.count) L.push(`    (bos)`);
  for (const r of b.parked.top) L.push(`    ${r.type} ${r.id} — ${r.title}`);
  if (b.parked.count > b.parked.top.length) {
    L.push(`    … +${b.parked.count - b.parked.top.length} daha (serif-brain search --status queued)`);
  }

  return L.join("\n");
}
