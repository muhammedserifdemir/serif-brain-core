// Bir registry'deki tüm brain'leri tarar, her biri için proje kaydı üretir.
// override (kullanıcı) > detect (otomatik) önceliği. Brain objeleri salt-okunur.

import { existsSync } from "node:fs";
import { loadObjects } from "../query/search.mjs";
import { loadConfig } from "../markdown/schema.mjs";
import { brainRootOf, repoOf } from "./registry.mjs";
import { detectProject } from "./detect.mjs";
import { computeMetrics } from "./metrics.mjs";

const DAY = 86400000;

function relTime(ms, nowMs) {
  if (!ms) return "—";
  const d = Math.floor((nowMs - ms) / DAY);
  if (d <= 0) return "bugün";
  if (d === 1) return "dün";
  if (d < 14) return `${d}g`;
  if (d < 60) return `${Math.floor(d / 7)}hf`;
  return `${Math.floor(d / 30)}ay`;
}

/** Tek brain → proje kaydı. now: Date.now() (script dışından verilir, deterministiklik). */
export function collectBrain(entry, now = Date.now()) {
  const brainRoot = brainRootOf(entry.repo);
  const repo = repoOf(brainRoot);
  const out = {
    name: entry.name || repo.split("/").pop(),
    repo,
    archived: !!entry.archived,
    archiveReason: entry.archiveReason || (entry.override && entry.override.archiveReason) || "",
    error: null,
    // KAYIP/hatali kayitlar da BU SEKILDE doner. Yarim kayit dondurmek, tek bir
    // silinmis klasorun `collectAll` icindeki toplamlari (critItems.some) patlatip
    // TUM paneli dusurmesine yol aciyordu: 19 brain'in 18'i sagliklidir ama panel
    // hicbirini gosteremezdi. Sozlesme: kayit her zaman sema-tamdir, eksik olan
    // veridir — `error` alani onu soyler.
    objCount: 0, done: 0, open: 0, blocked: 0, criticalOpen: 0,
    doneItems: [], critItems: [], statusHealthWarn: false,
    percent: 0, percentSource: "status",
    lastMs: 0, last: "—", activeDev: false, hasGit: false,
    port: (entry.override && entry.override.port) || "",
    run: entry.override ? entry.override.run : undefined,
    prereqs: (entry.override && entry.override.prereqs) || [],
    liveUrl: (entry.override && entry.override.liveUrl) || "",
    note: (entry.override && entry.override.note) || "",
    projectId: null,
  };
  if (!existsSync(brainRoot)) { out.error = "brain bulunamadı"; return out; }

  const det = detectProject(repo);
  let objects = [];
  let cfgId = null;
  try { objects = loadObjects(brainRoot); } catch (e) { out.error = e.message; }
  try { cfgId = loadConfig(brainRoot)?.projects?.find((p) => p.active)?.id || null; } catch { /* config opsiyonel */ }

  const m = computeMetrics(objects);
  const ov = entry.override || {};

  // son aktivite: git (varsa) yoksa obje updated_at
  const gitMs = det.git.hasGit ? det.git.ms : 0;
  const lastMs = Math.max(gitMs, m.lastActivityMs);

  return {
    ...out,
    projectId: cfgId,
    port: ov.port || det.port,
    run: ov.run !== undefined ? ov.run : det.run,
    prereqs: ov.prereqs || det.prereqs,
    liveUrl: ov.liveUrl || "",
    // yüzde: kullanıcı hedefi varsa onu kullan, yoksa status'tan
    percent: ov.progressTarget != null ? ov.progressTarget : m.percent,
    percentSource: ov.progressTarget != null ? "manuel" : "status",
    objCount: m.total,
    done: m.done, open: m.open, blocked: m.blocked,
    criticalOpen: m.criticalOpen,
    doneItems: m.doneItems,
    critItems: m.critItems,
    statusHealthWarn: m.statusHealthWarn,
    lastMs,
    last: relTime(lastMs, now),
    activeDev: gitMs > 0 && (now - gitMs) < 14 * DAY,
    hasGit: det.git.hasGit,
    note: ov.note || "",
  };
}

/** Registry → {active:[], archived:[], totals:{}} */
export function collectAll(reg, now = Date.now()) {
  const recs = reg.brains.map((b) => collectBrain(b, now));
  const active = recs.filter((r) => !r.archived);
  const archived = recs.filter((r) => r.archived);
  const totals = {
    active: active.length,
    activeDev: active.filter((r) => r.activeDev).length,
    blocked: active.filter((r) => r.blocked > 0 || r.critItems.some((c) => c.status && /block/i.test(c.status))).length,
    criticalOpen: active.reduce((s, r) => s + (r.criticalOpen || 0), 0),
    deployWaiting: active.filter((r) => /deploy|onay|bekl/i.test(r.note)).length,
  };
  return { active, archived, totals, generatedAt: now };
}
