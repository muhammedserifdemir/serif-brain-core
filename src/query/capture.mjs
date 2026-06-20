// Auto-capture (write-back) cekirdegi — Faz: Active Memory son adimi.
// Git commit'lerinden aday bug/karar OBJESI onerir. Amac: `add`'i unutma sorunu;
// hafiza kendiliginden dolsun. YUKSEK PRECISION hedefi: emin olunmayan commit ATLANIR
// (gurultulu oneren yok sayilir). `fix` commit'leri "cozulmus bug" olarak yakalanir —
// bu ayni zamanda Faz: Bug Signatures icin tohum (gecmis hata sekilleri).
// SAF fonksiyon: commit listesi -> oneri listesi. I/O yok, test edilebilir.

// Conventional commit / dogal dil prefiksini temizle: "fix(scope): foo" -> "foo".
function cleanTitle(subject) {
  return String(subject || "")
    .replace(/^\s*(fix|feat|refactor|perf|bug|hotfix|patch|chore|build|revert)(\([^)]*\))?\s*[:\-]\s*/i, "")
    .trim() || String(subject || "").trim();
}

// EN: kelime sinirli. TR: eklemeli dil — sinir KOYMA (düzelt+ildi, hata+sı eslessin).
const BUG_RE = /\b(fix|fixe[sd]|bug|hotfix|patch|regression|crash|leak)\b|(düzelt|duzelt|hata|bozuk|kırıl|kiril|sızıntı|siznti)/i;
const DECISION_RE = /\b(use|adopt|switch to|migrate to|move to|introduce|replace\b.*\bwith|standardi[sz]e)\b|(karar|benimse|gecis|geçiş)/i;

const BUG = () => ({ type: "bug", status: "done", priority: "medium", severity: "medium" });
const DECISION = () => ({ type: "decision", status: "active", priority: "medium" });

/** Bir commit'i sinifa ata. Emin degilse null (atla). Prefix kelime-anahtardan onceliklidir. */
export function classifyCommit(subject) {
  const s = String(subject || "");
  if (!s.trim()) return null;
  // Surum/merge/format commit'leri hafiza degeri tasimaz.
  if (/^(merge\b|release\b|bump\b|v?\d+\.\d+\.\d+|wip\b)/i.test(s.trim())) return null;

  // Conventional commit prefiksi varsa O belirler (govdedeki kelimeler degil).
  const m = s.match(/^\s*([a-zçğıöşü]+)(\([^)]*\))?\s*[:\-]/i);
  const prefix = m ? m[1].toLowerCase() : null;
  if (prefix) {
    if (["fix", "bug", "hotfix", "patch", "revert"].includes(prefix)) return BUG();
    if (["refactor", "perf"].includes(prefix)) return DECISION();
    // feat/chore/build/ci/docs/test/style → hafiza-degeri yok (yuksek precision): atla.
    if (["feat", "chore", "build", "ci", "docs", "test", "style"].includes(prefix)) return null;
  }

  // Prefiks yok / taninmiyor → dogal dil kelime-anahtarlari.
  if (BUG_RE.test(s)) return BUG();
  if (DECISION_RE.test(s)) return DECISION();
  return null;
}

/**
 * @param commits getRecentCommits() ciktisi [{hash, subject, files}]
 * @param opts { existingHashes:Set, ownerFor:(files)=>module, limit=20 }
 * @returns [{ type, status, priority, severity?, title, module, hash, evidence }]
 */
export function proposeFromCommits(commits, opts = {}) {
  const existing = opts.existingHashes || new Set();
  const ownerFor = opts.ownerFor || (() => "unknown");
  const limit = opts.limit ?? 20;

  const proposals = [];
  const seenTitles = new Set();
  for (const c of commits) {
    if (!c || !c.hash) continue;
    if (existing.has(c.hash) || existing.has(c.hash.slice(0, 7))) continue; // zaten yakalanmis
    const cls = classifyCommit(c.subject);
    if (!cls) continue;

    const title = cleanTitle(c.subject);
    const titleKey = `${cls.type}:${title.toLowerCase()}`;
    if (seenTitles.has(titleKey)) continue; // ayni baslikli mukerrer commit'i tek say
    seenTitles.add(titleKey);

    proposals.push({
      ...cls,
      title,
      module: ownerFor(c.files || []),
      hash: c.hash,
      evidence: `git ${c.hash.slice(0, 7)}: ${c.subject}`,
    });
    if (proposals.length >= limit) break;
  }
  return proposals;
}

/** Degisen dosyalardan baskin (en cok gecen, unknown-disi) modulu sec. */
export function dominantModule(files, ownerOfFn) {
  const counts = new Map();
  for (const f of files || []) {
    const m = ownerOfFn(f);
    if (!m || m === "unknown") continue;
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  let best = "unknown", bestN = 0;
  for (const [m, n] of counts) if (n > bestN) { best = m; bestN = n; }
  return best;
}
