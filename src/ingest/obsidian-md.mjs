// Obsidian-Dev-Vault ingest — sadece arsivden okur.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { parseFrontmatter } from "../markdown/frontmatter.mjs";

const DECISION_GLOB = "decisions";
const BUG_GLOB = "bugs";
const SPRINT_GLOB = "sprints";

function listMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(".md"))
    .map(f => join(dir, f));
}

function readAndParse(file, sourcePath) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch (e) { return { error: `read failed: ${e.message}`, source: sourcePath }; }
  try {
    const { frontmatter, body, has_frontmatter } = parseFrontmatter(text);
    return { frontmatter, body, has_frontmatter, source: sourcePath };
  } catch (e) {
    return { error: `parse failed: ${e.message}`, source: sourcePath, raw_text_excerpt: text.slice(0, 200) };
  }
}

export function ingestObsidianDecisions(archivePath) {
  const dir = join(archivePath, "4-obsidian-vault", "projects", "serif-platform", "decisions");
  const out = [];
  for (const file of listMd(dir)) {
    const name = basename(file);
    const sourcePath = `4-obsidian-vault/projects/serif-platform/decisions/${name}`;
    const r = readAndParse(file, sourcePath);
    if (r.error) {
      out.push({ source: { kind: "obsidian", path: sourcePath }, error: r.error, raw_excerpt: r.raw_text_excerpt });
      continue;
    }
    const fm = r.frontmatter || {};
    const titleFromBody = (r.body || "").match(/^#\s+(.+)$/m)?.[1] || name.replace(/\.md$/, "").replace(/-/g, " ");
    out.push({
      source: { kind: "obsidian", path: sourcePath },
      raw: fm,
      proposed: {
        type: "decision",
        project: fm.project || "serif-platform",
        title: titleFromBody.trim(),
        module: fm.module || "unknown",
        status: fm.status,
        priority: fm.priority,
        created_at: fm.date || null,
        updated_at: fm.date || null,
        body: r.body
      },
      file_basename: name
    });
  }
  return out;
}

export function ingestObsidianBugs(archivePath) {
  const dir = join(archivePath, "4-obsidian-vault", "projects", "serif-platform", "bugs");
  const out = [];
  for (const file of listMd(dir)) {
    const name = basename(file);
    const sourcePath = `4-obsidian-vault/projects/serif-platform/bugs/${name}`;
    const r = readAndParse(file, sourcePath);
    if (r.error) {
      out.push({ source: { kind: "obsidian", path: sourcePath }, error: r.error, raw_excerpt: r.raw_text_excerpt });
      continue;
    }
    const fm = r.frontmatter || {};
    const titleFromBody = (r.body || "").match(/^#\s+(.+)$/m)?.[1] || name.replace(/\.md$/, "").replace(/-/g, " ");
    out.push({
      source: { kind: "obsidian", path: sourcePath },
      raw: fm,
      proposed: {
        type: "bug",
        project: fm.project || "serif-platform",
        title: titleFromBody.trim(),
        module: fm.module || "unknown",
        status: fm.status,
        priority: fm.priority,
        severity: fm.severity,
        created_at: fm.date || null,
        updated_at: fm.date || null,
        body: r.body
      },
      legacy_id: fm.id || null,
      file_basename: name
    });
  }
  return out;
}

export function ingestObsidianSprints(archivePath) {
  const dir = join(archivePath, "4-obsidian-vault", "projects", "serif-platform", "sprints");
  const out = [];
  for (const file of listMd(dir)) {
    const name = basename(file);
    const sourcePath = `4-obsidian-vault/projects/serif-platform/sprints/${name}`;
    const r = readAndParse(file, sourcePath);
    if (r.error) {
      out.push({ source: { kind: "obsidian", path: sourcePath }, error: r.error });
      continue;
    }
    const fm = r.frontmatter || {};
    const titleFromBody = (r.body || "").match(/^#\s+(.+)$/m)?.[1] || name;
    out.push({
      source: { kind: "obsidian", path: sourcePath },
      raw: fm,
      proposed: {
        type: "note",
        project: "serif-platform",
        title: `Sprint: ${titleFromBody.trim()}`,
        status: fm.status || "archived",
        created_at: fm.date || null,
        updated_at: fm.date || null,
        tags: ["sprint"],
        body: r.body
      },
      file_basename: name
    });
  }
  return out;
}

export function listObsidianDailies(archivePath) {
  const dir = join(archivePath, "4-obsidian-vault", "daily");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith(".md")).map(f => `4-obsidian-vault/daily/${f}`);
}

export function listObsidianRootDocs(archivePath) {
  const dir = join(archivePath, "4-obsidian-vault");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of ["identity.md","feedback.md","00-index.md"]) {
    if (existsSync(join(dir, f))) out.push(`4-obsidian-vault/${f}`);
  }
  // serif-platform/ project root docs
  const projectRoot = join(dir, "projects", "serif-platform");
  if (existsSync(projectRoot)) {
    for (const f of ["STATE.md","project.md","tech.md","index.md"]) {
      if (existsSync(join(projectRoot, f))) out.push(`4-obsidian-vault/projects/serif-platform/${f}`);
    }
  }
  return out;
}
