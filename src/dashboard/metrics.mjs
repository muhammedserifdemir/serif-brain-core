// Dashboard metrikleri — bir brain'in objelerinden proje özetini hesaplar.
// Saf fonksiyon: objeleri (loadObjects çıktısı) alır, sayıları/listeleri döner.

import { bucketOf, isTaskType } from "./normalize.mjs";

function ts(fm) {
  const t = fm.completed_at || fm.updated_at || fm.created_at;
  const ms = t ? new Date(t).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

const PRIO_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * @param {Array} objects loadObjects() çıktısı: {frontmatter, type, ...}
 * @returns proje metrikleri
 */
export function computeMetrics(objects) {
  let done = 0, open = 0, blocked = 0;
  const doneItems = [];
  const critItems = [];
  let lastActivityMs = 0;

  for (const o of objects) {
    const fm = o.frontmatter || {};
    const m = ts(fm);
    if (m > lastActivityMs) lastActivityMs = m;
    if (!isTaskType(o.type)) continue;

    const b = bucketOf(fm.status);
    if (b === "dropped") continue;
    if (b === "done") {
      done++;
      doneItems.push({ title: fm.title || fm.id, when: fm.completed_at || fm.updated_at, type: o.type });
    } else if (b === "blocked") {
      blocked++;
    } else {
      open++;
    }

    // açık kritik/yüksek kalemler (done değil)
    if (b !== "done") {
      const prio = String(fm.priority || "").toLowerCase();
      if (prio === "critical" || prio === "high") {
        critItems.push({ title: fm.title || fm.id, priority: prio, status: fm.status, type: o.type, _r: PRIO_RANK[prio] ?? 9, _t: m });
      }
    }
  }

  const denom = done + open + blocked;
  const percent = denom > 0 ? Math.round((done / denom) * 100) : null;
  const criticalOpen = critItems.filter((c) => c.priority === "critical").length;

  doneItems.sort((a, b) => (new Date(b.when || 0)) - (new Date(a.when || 0)));
  critItems.sort((a, b) => (a._r - b._r) || (b._t - a._t));

  return {
    total: objects.length,
    done, open, blocked,
    percent,
    criticalOpen,
    doneItems: doneItems.slice(0, 8),
    critItems: critItems.slice(0, 6).map(({ _r, _t, ...c }) => c),
    lastActivityMs,
    statusHealthWarn: open > 0 && done === 0 && blocked === 0 && (open >= 8),
  };
}
