// Status / module / priority normalization.
// Master prompt'tan sema ve kurallar.

const STATUS_MAP = {
  completed: "done",
  closed: "done",
  done: "done",
  planned: "queued",
  queued: "queued",
  active: "active",
  in_progress: "in_progress",
  open: "open",
  blocked: "blocked",
  rejected: "rejected",
  archived: "archived"
};

const VALID_STATUS = new Set(["queued","open","active","in_progress","blocked","done","rejected","archived"]);
const VALID_PRIORITY = new Set(["critical","high","medium","low"]);
const VALID_MODULES = new Set(["contentx","presentx","animatorx","studiox","testx","dashboard","auth","billing","shared","infra","unknown","build","electron","seriftech","misc","licensing","workflow","design-engine"]);

const MODULE_MAP = {
  testlms: "testx",
  TestLMS: "testx",
  TestX: "testx",
  PresentX: "presentx",
  ContentX: "contentx",
  AnimatorX: "animatorx",
  StudioX: "studiox"
};

export function normalizeStatus(raw) {
  if (!raw) return { value: null, normalized: false, warning: "missing status" };
  const lower = String(raw).toLowerCase().trim();
  if (STATUS_MAP[lower]) {
    return { value: STATUS_MAP[lower], normalized: lower !== STATUS_MAP[lower], original: raw };
  }
  // Special: "TOP" was used as priority, sometimes appears in status by mistake
  if (lower === "top") {
    return { value: "active", normalized: true, original: raw, warning: "TOP detected in status — treated as 'active', priority elsewhere flagged" };
  }
  return { value: lower, normalized: false, original: raw, warning: `unknown status: ${raw}` };
}

export function normalizePriority(raw) {
  if (!raw) return { value: null, normalized: false };
  const lower = String(raw).toLowerCase().trim();
  if (VALID_PRIORITY.has(lower)) {
    return { value: lower, normalized: lower !== String(raw).trim(), original: raw };
  }
  if (lower === "top") {
    return { value: "high", normalized: true, original: raw, warning: "TOP priority detected — defaulted to 'high'. Manual review recommended for critical promotion." };
  }
  return { value: lower, normalized: false, original: raw, warning: `unknown priority: ${raw}` };
}

export function normalizeModule(raw) {
  if (!raw) return { value: "unknown", normalized: false, warning: "missing module — defaulted to 'unknown'" };
  if (Array.isArray(raw)) {
    const mapped = raw.map(m => normalizeModule(m).value);
    return { value: mapped.length === 1 ? mapped[0] : mapped, normalized: true, original: raw };
  }
  const trimmed = String(raw).trim();
  if (MODULE_MAP[trimmed]) {
    return { value: MODULE_MAP[trimmed], normalized: true, original: raw };
  }
  const lower = trimmed.toLowerCase();
  if (VALID_MODULES.has(lower)) return { value: lower, normalized: lower !== trimmed, original: raw };
  return { value: "unknown", normalized: true, original: raw, warning: `unknown module '${raw}' — mapped to 'unknown'` };
}

// Apply all normalizations to a candidate; record changes.
export function normalizeCandidate(cand) {
  const changes = [];
  const warnings = cand.warnings ? [...cand.warnings] : [];

  // Status
  const s = normalizeStatus(cand.proposed.status);
  if (s.value !== null) {
    if (s.normalized) changes.push({ field: "status", from: s.original, to: s.value });
    cand.proposed.status = s.value;
  }
  if (s.warning) warnings.push(s.warning);

  // Priority
  const p = normalizePriority(cand.proposed.priority);
  if (p.value !== null) {
    if (p.normalized) changes.push({ field: "priority", from: p.original, to: p.value });
    cand.proposed.priority = p.value;
  }
  if (p.warning) warnings.push(p.warning);

  // Module
  const m = normalizeModule(cand.proposed.module);
  if (m.normalized) changes.push({ field: "module", from: JSON.stringify(m.original), to: JSON.stringify(m.value) });
  cand.proposed.module = m.value;
  if (m.warning) warnings.push(m.warning);

  cand.normalizations = changes;
  cand.warnings = warnings;
  return cand;
}
