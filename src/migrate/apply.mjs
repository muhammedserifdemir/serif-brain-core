// Migration apply — migrate --apply'in 'move' kayitlarini canonical'a yaz, 'summarize' ozetle, 'archive' manifest'e dus.
// SADECE .serif-brain/ icine yazar. Eski kaynaklara dokunmaz.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeObject, makeId, objectPath } from "../markdown/object.mjs";

const VALID_STATUS = new Set(["queued","open","active","in_progress","blocked","done","rejected","archived"]);
const VALID_PRIORITY = new Set(["critical","high","medium","low"]);
// Gecerli modul listesi PROJEYE OZELDIR; config'ten gelir. Yoksa KISITLAMA YOK:
// sabit liste paket yazarinin urun modulleriydi ve goc eden yabancinin listede
// olmayan TUM modullerini "unknown"a indiriyordu (isim sizintisindan agir: veri
// kaybi). Bkz. migrate/normalize.mjs — ayni kural.
function gecerliModuller(config) {
  return Array.isArray(config?.valid_modules) && config.valid_modules.length
    ? new Set(config.valid_modules.map((m) => String(m).toLowerCase()))
    : null;
}

function defensiveNormalize(c, config = null) {
  const gecerli = gecerliModuller(config);
  const fm = c.proposed;
  const warnings = [];

  // Status: bilinmeyense archived'a defensiv dus
  if (!fm.status || !VALID_STATUS.has(fm.status)) {
    warnings.push(`status '${fm.status}' invalid → archived (defensive)`);
    fm.status = "archived";
  }

  // Priority: bilinmeyense medium
  if (!fm.priority || !VALID_PRIORITY.has(fm.priority)) {
    warnings.push(`priority '${fm.priority}' invalid → medium (defensive)`);
    fm.priority = "medium";
  }

  // Severity (bug only)
  if (fm.type === "bug") {
    if (!fm.severity || !VALID_PRIORITY.has(fm.severity)) {
      fm.severity = fm.priority;
    }
  }

  // Module: array tek elementse string yap; her elemanı valid değilse "unknown"a indir
  let mods = Array.isArray(fm.module) ? fm.module : (fm.module ? [fm.module] : ["unknown"]);
  mods = mods.map(m => {
    if (typeof m !== "string" || (gecerli && !gecerli.has(m.toLowerCase()))) {
      warnings.push(`module '${m}' invalid → unknown`);
      return "unknown";
    }
    return m;
  });
  // Tek elementse string'e indirgeme (schema bunu kabul ediyor)
  fm.module = mods.length === 1 ? mods[0] : mods;

  // Date normalization
  fm.created_at = normalizeDate(fm.created_at);
  fm.updated_at = normalizeDate(fm.updated_at) || fm.created_at;

  return { fm, warnings };
}

function normalizeDate(d) {
  if (!d) return new Date().toISOString();
  if (typeof d !== "string") return new Date().toISOString();
  // "2026-04-16-afternoon" → "2026-04-16"
  const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) {
    if (d === m[1]) return `${m[1]}T00:00:00.000Z`;
    return `${m[1]}T00:00:00.000Z`;
  }
  // ISO check
  if (/^\d{4}-\d{2}-\d{2}T/.test(d)) return d;
  // Last resort
  const parsed = new Date(d);
  if (!isNaN(parsed)) return parsed.toISOString();
  return new Date().toISOString();
}

function buildBody(c) {
  const raw = c.proposed.body || "";
  const provenance = `\n\n---\n\n_Migrated from ${c.source.kind}: \`${c.source.path}\` on ${new Date().toISOString().slice(0,10)}._`;
  return `\n# ${c.proposed.title}\n\n${raw}${provenance}\n`;
}

export function applyMigration({ brainRoot, candidates, dryRunData, archivePath, projeId = "unknown", config = null }) {
  const written = [];
  const archived = [];
  const summarized = [];
  const collisions = [];
  const writeErrors = [];
  const allWarnings = [];
  const idsThisRun = new Set();

  // ─── 1. 'move' candidates → canonical write ───
  for (const c of candidates) {
    if (c.error) continue;
    if (c.classification !== "move") {
      if (c.classification === "summarize") summarized.push(c);
      else if (c.classification === "archive") archived.push(c);
      continue;
    }

    // Defensiv normalize
    const { fm: normalized, warnings } = defensiveNormalize(c, config);
    for (const w of warnings) allWarnings.push({ source: c.source.path, warning: w });

    // ID üret
    const project = normalized.project || projeId;
    const created = new Date(normalized.created_at);
    let id = makeId(normalized.type, normalized.title, isNaN(created) ? new Date() : created);

    // Internal collision (apply içi) — id'ye suffix ekle
    let attempt = id;
    let suffix = 2;
    while (idsThisRun.has(attempt) || existsSync(objectPath(brainRoot, project, normalized.type, attempt))) {
      attempt = `${id}-${suffix}`;
      suffix++;
      if (suffix > 50) break;
    }
    if (attempt !== id) {
      collisions.push({ original_id: id, resolved_id: attempt, source: c.source.path });
      id = attempt;
    }
    idsThisRun.add(id);

    // Frontmatter olusrutu
    const now = new Date().toISOString();
    const finalFm = {
      id,
      type: normalized.type,
      project,
      module: normalized.module,
      title: normalized.title,
      status: normalized.status,
      priority: normalized.priority,
      ...(normalized.type === "bug" ? { severity: normalized.severity, owner: "" } : {}),
      created_at: normalized.created_at,
      updated_at: normalized.updated_at,
      source: { kind: "migration", path: c.source.path || "" },
      relations: {
        files: [],
        decisions: [],
        bugs: [],
        modules: Array.isArray(normalized.module) ? normalized.module : [normalized.module]
      },
      tags: ["migrated"],
      ...(normalized.type === "bug" ? { summary: normalized.title } : {})
    };

    const body = buildBody(c);
    try {
      const result = writeObject(brainRoot, finalFm, body);
      written.push({ id, type: normalized.type, source: c.source.path, path: result.path });
    } catch (e) {
      writeErrors.push({ source: c.source.path, error: e.message });
      // Fallback: archive'a düşür
      archived.push({ ...c, classification_reason: `Write failed: ${e.message}` });
    }
  }

  // ─── 2. 'summarize' (daily notes) → tek summary note ───
  let summaryNoteId = null;
  if (summarized.length > 0) {
    const items = [];
    for (const c of summarized) {
      const fullPath = join(archivePath, c.source.path);
      let excerpt = "";
      if (existsSync(fullPath)) {
        try {
          const text = readFileSync(fullPath, "utf8");
          excerpt = text.slice(0, 300).replace(/\s+/g, " ").trim();
        } catch {}
      }
      const date = c.source.path.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || "(no-date)";
      items.push({ date, source: c.source.path, excerpt });
    }
    items.sort((a, b) => a.date.localeCompare(b.date));

    const summaryBody = [
      `\n# Migrated Daily/Reference Notes Summary`,
      ``,
      `${summarized.length} kayit eski Obsidian vault'tan tek ozet not olarak korundu. Tam icerik arsivde:`,
      `\`${archivePath}\``,
      ``,
      `## Daily Excerpts`,
      ``,
      ...items.map(it => `### ${it.date}\n\n_Source: \`${it.source}\`_\n\n${it.excerpt || "_(empty or unreadable)_"}\n`),
      ``,
      `---`,
      ``,
      `_Status: archived. Aktif context'e girmez. migrate --apply tarafindan uretildi._`,
      ``
    ].join("\n");

    const fm = {
      id: makeId("note", "Migrated Daily Notes Summary"),
      type: "note",
      project: projeId,
      title: "Migrated Daily Notes Summary",
      status: "archived",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: ["migrated", "daily", "summary"],
      relations: { files: [], modules: [], bugs: [], decisions: [] }
    };

    try {
      const result = writeObject(brainRoot, fm, summaryBody);
      summaryNoteId = fm.id;
      written.push({ id: fm.id, type: "note", source: "daily-summary", path: result.path });
    } catch (e) {
      writeErrors.push({ source: "daily-summary", error: e.message });
    }
  }

  // ─── 3. Archive manifest ───
  const archiveIndexDir = join(brainRoot, "archive-index");
  if (!existsSync(archiveIndexDir)) mkdirSync(archiveIndexDir, { recursive: true });

  const archiveManifest = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    archive_path: archivePath,
    total: archived.length,
    records: archived.map(c => ({
      source_kind: c.source.kind,
      source_path: c.source.path,
      proposed_type: c.proposed?.type,
      proposed_title: c.proposed?.title,
      proposed_status: c.proposed?.status,
      classification_reason: c.classification_reason,
      dedup_cluster: c.dedup_cluster || null,
      is_duplicate_non_representative: c.is_duplicate_non_representative || false
    }))
  };
  const archivedPath = join(archiveIndexDir, "archived-records.json");
  writeFileSync(archivedPath, JSON.stringify(archiveManifest, null, 2));

  // ─── 4. Migrated manifest ───
  const migratedManifest = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    archive_path: archivePath,
    total_written: written.length,
    breakdown: {
      bugs: written.filter(w => w.type === "bug").length,
      decisions: written.filter(w => w.type === "decision").length,
      notes: written.filter(w => w.type === "note").length
    },
    daily_summary_note_id: summaryNoteId,
    summarized_count: summarized.length,
    archived_count: archived.length,
    collisions,
    write_errors: writeErrors,
    defensive_warnings: allWarnings,
    records: written
  };
  const migratedPath = join(archiveIndexDir, "migrated-records.json");
  writeFileSync(migratedPath, JSON.stringify(migratedManifest, null, 2));

  return {
    written,
    archived,
    summarized,
    collisions,
    write_errors: writeErrors,
    defensive_warnings: allWarnings,
    archived_manifest_path: archivedPath,
    migrated_manifest_path: migratedPath
  };
}
