// Move / Summarize / Archive classification.
// Master prompt'tan kurallar.
const CONTEXT_EXCLUDED_STATUS = ["done", "rejected", "archived"];

export function classifyCandidate(c, allClusters) {
  if (c.error) {
    c.classification = "archive";
    c.classification_reason = `Parse error — manual review needed: ${c.error}`;
    return c;
  }

  const fm = c.proposed;

  // Duplicate cluster -> non-representative gets summarized (merged)
  if (c.dedup_cluster) {
    const cluster = allClusters.get(c.dedup_cluster_key) || [];
    // representative will be classified separately; here we mark non-reps
    if (c.is_duplicate_non_representative) {
      c.classification = "archive";
      c.classification_reason = `Duplicate of cluster ${c.dedup_cluster} — merged into representative`;
      return c;
    }
  }

  // Daily notes / sprints (non-active) → summarize
  if (c.source.path && c.source.path.includes("/daily/")) {
    c.classification = "summarize";
    c.classification_reason = "Daily note — not migrated as object; summarized into project notes";
    return c;
  }

  if ((c.source.path || "").includes("/sprints/")) {
    if (CONTEXT_EXCLUDED_STATUS.includes(fm.status)) {
      c.classification = "archive";
      c.classification_reason = `Closed sprint (status: ${fm.status})`;
    } else {
      c.classification = "move";
      c.classification_reason = "Active sprint";
    }
    return c;
  }

  // Closed bugs (status: done/closed/completed) → archive (don't pollute context)
  if (fm.type === "bug" && CONTEXT_EXCLUDED_STATUS.includes(fm.status)) {
    c.classification = "archive";
    c.classification_reason = `Closed bug (status: ${fm.status}) — won't enter active context`;
    return c;
  }

  // Decisions with status done/archived → archive
  if (fm.type === "decision" && CONTEXT_EXCLUDED_STATUS.includes(fm.status)) {
    c.classification = "archive";
    c.classification_reason = `Completed decision (status: ${fm.status})`;
    return c;
  }

  // Title-less / "Bug aciklamasi" / placeholder → archive
  if (!fm.title || fm.title === "Bug açıklaması" || fm.title.length < 5) {
    c.classification = "archive";
    c.classification_reason = "Low-quality / placeholder title";
    return c;
  }

  // Legacy 'unknown' module + no priority → flag for review, archive
  if (fm.module === "unknown" && (!fm.priority || fm.priority === "low")) {
    c.classification = "archive";
    c.classification_reason = "Unknown module + low/no priority — likely deprecated or out-of-scope";
    return c;
  }

  // Default: active record → move
  c.classification = "move";
  c.classification_reason = "Active and clean — direct migration";
  return c;
}

// Mark cluster duplicates: pick representative, others get is_duplicate_non_representative
export function applyClusterMembership(candidates, dedup) {
  const clusters = dedup.clusters;
  for (const [key, list] of clusters) {
    if (list.length <= 1) continue;
    // Representative: prefer obsidian > legacy_yaml
    const order = { obsidian: 0, legacy_yaml: 1, graphify: 2 };
    const sorted = [...list].sort((a, b) => (order[a.source.kind] ?? 99) - (order[b.source.kind] ?? 99));
    const rep = sorted[0];
    for (const c of sorted) {
      c.dedup_cluster_key = key;
      if (c !== rep) c.is_duplicate_non_representative = true;
    }
    rep.is_duplicate_representative = true;
    rep.cluster_member_count = list.length;
  }
}
