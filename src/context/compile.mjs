// Context compiler — kisa, gorev-odakli Claude bagliami.
// 3 cikti: CLAUDE.generated.md (insan-okur), compact.json (makine-okur), active-work.md (odak).
// Filtreler:
//   - done / closed / completed / rejected / archived  → DAHIL DEGIL
//   - dry-run preview kayitlari ayrı işaretlenir, "canonical" gibi sunulmaz.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../markdown/schema.mjs";

function resolvePrimaryProject(brainRoot) {
  try {
    const cfg = loadConfig(brainRoot);
    const active = (cfg.projects || []).filter(p => p.active);
    return active[0]?.id || "serif-platform";
  } catch {
    return "serif-platform";
  }
}

// Baslik icin proje gorunum adi: config'te opsiyonel `name`, yoksa `id`.
// Config okunamazsa null doner — baslik "Serif Brain" fallback'ine duser.
function resolveProjectTitle(brainRoot) {
  try {
    const cfg = loadConfig(brainRoot);
    const active = (cfg.projects || []).filter(p => p.active);
    return active[0]?.name || active[0]?.id || null;
  } catch {
    return null;
  }
}

const CONTEXT_EXCLUDED = new Set(["done", "closed", "completed", "rejected", "archived"]);

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
function pri(p) { return PRIORITY_ORDER[p] ?? 4; }

function modulesOf(fm) {
  if (Array.isArray(fm.module)) return fm.module;
  if (fm.module) return [fm.module];
  return ["unknown"];
}

function isActive(fm) { return !CONTEXT_EXCLUDED.has(fm.status); }

function ensureContextDir(brainRoot) {
  const dir = join(brainRoot, "context");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// Canonical aktif objeleri sınıflandır
function partition(data, moduleFilter) {
  const allCanonical = data.canonical.objects.filter(o => !o.error).map(o => ({ ...o.frontmatter, _src: "canonical" }));
  const allPreview = (data.dry_run?.candidates || [])
    .filter(c => !c.error && c.classification === "move")
    .map(c => ({
      ...c.proposed,
      _src: "preview",
      _source_kind: c.source.kind,
      _source_path: c.source.path,
      _normalizations: c.normalizations || []
    }));

  function filterByModule(list) {
    if (!moduleFilter) return list;
    return list.filter(fm => modulesOf(fm).includes(moduleFilter));
  }

  return {
    canonical_bugs:    filterByModule(allCanonical.filter(o => o.type === "bug" && isActive(o))),
    canonical_decisions: filterByModule(allCanonical.filter(o => o.type === "decision" && isActive(o))),
    preview_bugs:      filterByModule(allPreview.filter(o => o.type === "bug" && isActive(o))),
    preview_decisions: filterByModule(allPreview.filter(o => o.type === "decision" && isActive(o)))
  };
}

function getConfigPrinciples(brainRoot) {
  const cfgPath = join(brainRoot, "config.yaml");
  if (!existsSync(cfgPath)) return null;
  // Sadece raw text — kisaltma için ilk 80 satır.
  const text = readFileSync(cfgPath, "utf8");
  const lines = text.split("\n").slice(0, 50);
  return lines.join("\n");
}

function moduleStatsFromGraph(graph, moduleFilter) {
  if (!graph?.nodes) return {};
  const stats = {};
  for (const n of graph.nodes) {
    if (!["file","route","component"].includes(n.type)) continue;
    const m = n.module || "unknown";
    if (moduleFilter && m !== moduleFilter) continue;
    if (!stats[m]) stats[m] = { files: 0, loc: 0 };
    stats[m].files++;
    stats[m].loc += (n.loc || 0);
  }
  return stats;
}

function topGodFiles(graph, moduleFilter, limit = 5) {
  if (!graph?.nodes || !graph?.edges) return [];
  const fileNodes = graph.nodes.filter(n => ["file","route","component"].includes(n.type));
  const inMap = new Map(); const outMap = new Map();
  for (const n of fileNodes) { inMap.set(n.id, 0); outMap.set(n.id, 0); }
  for (const e of graph.edges) {
    if (e.type !== "imports") continue;
    if (outMap.has(e.source)) outMap.set(e.source, outMap.get(e.source) + 1);
    if (inMap.has(e.target)) inMap.set(e.target, inMap.get(e.target) + 1);
  }
  return fileNodes
    .filter(n => !moduleFilter || n.module === moduleFilter)
    .map(n => ({ path: n.path, module: n.module, in: inMap.get(n.id), out: outMap.get(n.id), total: inMap.get(n.id) + outMap.get(n.id) }))
    .filter(n => n.total >= 30)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function migrationPreviewSummary(data) {
  if (!data.dry_run) return null;
  return {
    classification: data.dry_run.classification,
    duplicates: data.dry_run.duplicates?.length || 0,
    duplicate_records: data.dry_run.duplicate_record_count || 0,
    top_priority_anomalies: data.dry_run.top_priority_count || 0,
    module_renames: data.dry_run.module_renames || 0,
    apply_status: "PENDING — Faz 5 apply user approval bekliyor"
  };
}

// ─── CLAUDE.generated.md ───
export function buildClaudeMarkdown(data, opts = {}) {
  const moduleFilter = opts.module || null;
  const part = partition(data, moduleFilter);
  const lines = [];

  lines.push(`<!-- AUTO-GENERATED by 'serif-brain context' at ${new Date().toISOString()} -->`);
  lines.push(`<!-- DO NOT EDIT — regenerate with 'serif-brain context' -->`);
  lines.push(``);
  lines.push(`# ${opts.projectTitle || "Serif Brain"} — Active Context${moduleFilter ? ` (module: ${moduleFilter})` : ""}`);
  lines.push(``);
  lines.push(`> Brain: serif-brain-core. Canonical store: \`.serif-brain/objects/\`.`);
  lines.push(`> Filtered: \`done|closed|completed|rejected|archived\` excluded.`);
  if (data.dry_run) {
    lines.push(`> ⚠ Migration not yet applied (Faz 5 dry-run only). Preview records labeled below.`);
  }
  lines.push(``);

  // ─── 1. Project + module summary ───
  lines.push(`## Project State`);
  lines.push(``);
  if (moduleFilter) {
    const ms = moduleStatsFromGraph(data.graph, moduleFilter);
    const s = ms[moduleFilter] || { files: 0, loc: 0 };
    lines.push(`- Module: **${moduleFilter}**`);
    lines.push(`- Source files: ${s.files} (${s.loc.toLocaleString()} LOC)`);
  } else {
    if (data.graph?.stats) {
      const s = data.graph.stats;
      lines.push(`- Files: ${s.files_scanned} | Imports: ${s.total_imports} | Modules: ${Object.keys(moduleStatsFromGraph(data.graph)).length}`);
    }
    lines.push(`- Canonical objects: ${data.canonical.objects.length}`);
  }
  lines.push(``);

  // ─── 2. Critical & high open bugs (canonical) ───
  const criticalBugs = part.canonical_bugs.filter(b => ["critical","high"].includes(b.priority));
  if (criticalBugs.length > 0) {
    lines.push(`## 🔴 Open Critical/High Bugs (canonical, ${criticalBugs.length})`);
    lines.push(``);
    criticalBugs.sort((a, b) => pri(a.priority) - pri(b.priority));
    for (const b of criticalBugs) {
      const m = modulesOf(b).join(",");
      lines.push(`- **[${b.priority}]** ${b.title} _(${m}, ${b.status})_ — \`${b.id}\``);
    }
    lines.push(``);
  }

  // ─── 3. Active/in_progress decisions (canonical) ───
  const activeDecisions = part.canonical_decisions.filter(d => ["active","in_progress","queued"].includes(d.status));
  if (activeDecisions.length > 0) {
    lines.push(`## 🎯 Active Decisions (canonical, ${activeDecisions.length})`);
    lines.push(``);
    activeDecisions.sort((a, b) => pri(a.priority) - pri(b.priority));
    for (const d of activeDecisions) {
      const m = modulesOf(d).join(",");
      lines.push(`- **[${d.priority}]** ${d.title} _(${m}, ${d.status})_ — \`${d.id}\``);
    }
    lines.push(``);
  }

  // ─── 4. Migration preview (NOT yet applied) ───
  if (data.dry_run && (part.preview_bugs.length > 0 || part.preview_decisions.length > 0)) {
    lines.push(`## 📥 Migration Preview (not yet written, ${part.preview_bugs.length + part.preview_decisions.length} records)`);
    lines.push(``);
    lines.push(`> ⚠ These are **preview only** from Faz 5 dry-run. Run \`serif-brain migrate --apply\` (separate approval) to migrate.`);
    lines.push(``);

    if (part.preview_decisions.length > 0) {
      const previewDecCritical = part.preview_decisions.filter(d => ["critical","high"].includes(d.priority));
      if (previewDecCritical.length > 0) {
        lines.push(`### High-priority preview decisions (top 10)`);
        previewDecCritical.sort((a, b) => pri(a.priority) - pri(b.priority));
        for (const d of previewDecCritical.slice(0, 10)) {
          const m = modulesOf(d).join(",");
          lines.push(`- **[${d.priority}]** ${d.title} _(${m}, ${d.status})_ — _${d._source_kind}_`);
        }
        lines.push(``);
      }
    }

    if (part.preview_bugs.length > 0) {
      const previewBugsCritical = part.preview_bugs.filter(b => ["critical","high"].includes(b.priority));
      if (previewBugsCritical.length > 0) {
        lines.push(`### High-priority preview bugs (top 10)`);
        previewBugsCritical.sort((a, b) => pri(a.priority) - pri(b.priority));
        for (const b of previewBugsCritical.slice(0, 10)) {
          const m = modulesOf(b).join(",");
          lines.push(`- **[${b.priority}]** ${b.title} _(${m}, ${b.status})_ — _${b._source_kind}_`);
        }
        lines.push(``);
      }
    }
  }

  // ─── 5. Architecture risks (graph-derived) ───
  if (!moduleFilter && data.graph?.stats) {
    const god = topGodFiles(data.graph, null, 3);
    if (god.length > 0) {
      lines.push(`## ⚠ Architecture Hotspots (top 3 god files)`);
      lines.push(``);
      for (const g of god) lines.push(`- \`${g.path}\` (${g.module}) — total ${g.total} (in:${g.in}, out:${g.out})`);
      lines.push(``);
    }
  }

  // ─── 6. Migration pipeline summary ───
  if (!moduleFilter && data.dry_run) {
    const ms = migrationPreviewSummary(data);
    lines.push(`## Migration Pipeline (dry-run)`);
    lines.push(``);
    lines.push(`- move: ${ms.classification.move} · summarize: ${ms.classification.summarize} · archive: ${ms.classification.archive}`);
    lines.push(`- duplicate clusters: ${ms.duplicates} (${ms.duplicate_records} records)`);
    lines.push(`- TOP priority anomalies: ${ms.top_priority_anomalies}`);
    lines.push(`- Status: ${ms.apply_status}`);
    lines.push(``);
  }

  // ─── 7. Quick commands ───
  lines.push(`## Quick Commands`);
  lines.push(``);
  lines.push(`\`\`\``);
  lines.push(`serif-brain doctor             # saglik`);
  lines.push(`serif-brain context            # bu bagliami yenile`);
  lines.push(`serif-brain context --module <X>  # tek modul focus`);
  lines.push(`serif-brain add bug --title "..." --module <X>`);
  lines.push(`serif-brain rebuild-indexes    # backlink + index yenile`);
  lines.push(`\`\`\``);
  lines.push(``);

  return lines.join("\n");
}

// ─── compact.json ───
export function buildCompactJson(data, opts = {}, primaryProject = "serif-platform") {
  const moduleFilter = opts.module || null;
  const part = partition(data, moduleFilter);

  function summarize(fm) {
    return {
      id: fm.id || null,
      title: fm.title,
      type: fm.type,
      status: fm.status,
      priority: fm.priority,
      module: modulesOf(fm),
      source: fm._src,
      source_kind: fm._source_kind,
      source_path: fm._source_path,
      created_at: fm.created_at || null,
      updated_at: fm.updated_at || null
    };
  }

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    scope: moduleFilter ? `module:${moduleFilter}` : "global",
    project: primaryProject,
    canonical: {
      bugs: part.canonical_bugs.map(summarize),
      decisions: part.canonical_decisions.map(summarize)
    },
    preview: {
      not_yet_migrated: true,
      bugs: part.preview_bugs.map(summarize),
      decisions: part.preview_decisions.map(summarize)
    },
    code_graph: data.graph?.stats ? {
      files: data.graph.stats.files_scanned,
      modules: Object.keys(moduleStatsFromGraph(data.graph)).length,
      top_god_files: topGodFiles(data.graph, moduleFilter, 5),
      module_stats: moduleStatsFromGraph(data.graph, moduleFilter)
    } : null,
    migration_preview: migrationPreviewSummary(data),
    excluded_statuses: ["done","closed","completed","rejected","archived"]
  };
}

// ─── active-work.md ───
export function buildActiveWork(data, opts = {}) {
  const moduleFilter = opts.module || null;
  const part = partition(data, moduleFilter);
  const lines = [];

  lines.push(`# Active Work — Focus List`);
  lines.push(``);
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Scope: ${moduleFilter ? `module:${moduleFilter}` : "global"}`);
  lines.push(``);

  // Top 5 canonical critical/high
  const top = [...part.canonical_bugs.filter(b => ["critical","high"].includes(b.priority))]
    .concat(part.canonical_decisions.filter(d => ["critical","high"].includes(d.priority) && ["active","in_progress","queued","blocked"].includes(d.status)))
    .sort((a, b) => pri(a.priority) - pri(b.priority));

  lines.push(`## Now (canonical, top 5 by priority)`);
  lines.push(``);
  if (top.length === 0) lines.push(`*Hicbir canonical kritik is yok. Apply once preview kontrol edilebilir.*`);
  else for (const fm of top.slice(0, 5)) {
    const m = modulesOf(fm).join(",");
    lines.push(`- [${fm.priority}] **${fm.title}** _(${fm.type}, ${m}, ${fm.status})_ — \`${fm.id}\``);
  }
  lines.push(``);

  // Next (in_progress canonical)
  const inProgress = [...part.canonical_bugs, ...part.canonical_decisions].filter(o => o.status === "in_progress");
  if (inProgress.length > 0) {
    lines.push(`## In Progress`);
    lines.push(``);
    for (const fm of inProgress) {
      const m = modulesOf(fm).join(",");
      lines.push(`- ${fm.title} _(${fm.type}, ${m})_`);
    }
    lines.push(``);
  }

  // Next (queued)
  const queued = [...part.canonical_decisions].filter(d => d.status === "queued");
  if (queued.length > 0) {
    lines.push(`## Queued`);
    lines.push(``);
    for (const fm of queued.slice(0, 10)) {
      const m = modulesOf(fm).join(",");
      lines.push(`- ${fm.title} _(${m})_`);
    }
    lines.push(``);
  }

  // Apply blocker preview
  if (data.dry_run) {
    lines.push(`## Migration Apply Blockers (manual review needed before apply)`);
    lines.push(``);
    const top16 = data.dry_run.top_priority_count || 0;
    lines.push(`- TOP priority anomali: **${top16}** kayit (manuel critical/high karar)`);
    lines.push(`- Unknown module preview: see \`reports/migration-readiness.md\``);
    lines.push(`- Apply komutu: \`serif-brain migrate --apply\` (Faz 5 ileri seviye onayi gerekli)`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ─── Top-level write ───
export function writeContext({ brainRoot, data, opts = {} }) {
  const dir = ensureContextDir(brainRoot);
  const primaryProject = resolvePrimaryProject(brainRoot);
  const md = buildClaudeMarkdown(data, { ...opts, projectTitle: resolveProjectTitle(brainRoot) });
  const json = buildCompactJson(data, opts, primaryProject);
  const work = buildActiveWork(data, opts);

  const moduleSlug = opts.module ? `-${opts.module}` : "";
  const mdPath = join(dir, `CLAUDE.generated${moduleSlug}.md`);
  const jsonPath = join(dir, `compact${moduleSlug}.json`);
  const workPath = join(dir, `active-work${moduleSlug}.md`);

  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, JSON.stringify(json, null, 2) + "\n");
  writeFileSync(workPath, work);

  return { mdPath, jsonPath, workPath };
}
