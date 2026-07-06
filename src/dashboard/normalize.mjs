// Dashboard durum normalizasyonu — brain'ler status'u tutarsız kullanıyor
// (active/open/in_progress/in-progress/done/completed/resolved/closed...).
// Hepsini 4 kovaya indirger: done | open | blocked | dropped.
// Saf, bağımlılıksız, test edilebilir.

const MAP = {
  // tamamlanmış işler
  done: "done", completed: "done", resolved: "done", closed: "done",
  applied: "done", implemented: "done",
  // devam eden / açık işler
  open: "open", active: "open", in_progress: "open", "in-progress": "open",
  queued: "open", backlog: "open", planned: "open",
  // bekleyen / tıkanmış
  blocked: "blocked", deferred: "blocked",
  // sayıma girmeyen (arşiv / iptal / geçersiz)
  archived: "dropped", rejected: "dropped", superseded: "dropped"
};

/** Tek bir status değerini kovaya indir. Bilinmeyen → "open" (muhafazakâr: bitmemiş say). */
export function bucketOf(status) {
  if (!status) return "open";
  return MAP[String(status).toLowerCase()] || "open";
}

/** Bu obje tipi "iş" mi (yüzde/biten hesabına girer mi)? Sadece bug + decision. */
export function isTaskType(type) {
  return type === "bug" || type === "decision";
}
