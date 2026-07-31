// Markdown object reader/writer/lister.
// Canonical store path: .serif-brain/objects/projects/<project>/<type>s/<id>.md
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.mjs";
import { validateObject } from "./schema.mjs";

const TYPE_DIR = {
  bug: "bugs",
  decision: "decisions",
  plan: "plans",
  note: "notes",
  session: "sessions"
};

// Alias tipler: kendi dizini OLMAYAN, mevcut bir dizine yazilan tipler.
// 'record' = bitmis is kaydi (status: done dogar); decisions/ altinda yasar.
// TYPE_DIR'e KOYULMAZ — listAllObjects onun anahtarlarini geziyor, koysaydik
// decisions/ iki kez taranir ve her karar cift sayilirdi.
const TYPE_DIR_ALIAS = {
  record: "decisions"
};

function dirForType(type) {
  return TYPE_DIR[type] || TYPE_DIR_ALIAS[type];
}

export function objectsRoot(brainRoot, project) {
  return join(brainRoot, "objects", "projects", project);
}

export function objectPath(brainRoot, project, type, id) {
  const dir = dirForType(type);
  if (!dir) throw new Error(`Unknown object type: ${type}`);
  return join(objectsRoot(brainRoot, project), dir, `${id}.md`);
}

export function readObject(filePath) {
  if (!existsSync(filePath)) throw new Error(`Object not found: ${filePath}`);
  const text = readFileSync(filePath, "utf8");
  const { frontmatter, body, has_frontmatter } = parseFrontmatter(text);
  if (!has_frontmatter) throw new Error(`No frontmatter in ${filePath}`);
  return { frontmatter, body, file_path: filePath, mtime: statSync(filePath).mtime };
}

export function writeObject(brainRoot, frontmatter, body) {
  const validation = validateObject(frontmatter);
  if (!validation.valid) {
    throw new Error(`Schema validation failed for ${frontmatter.id}:\n  - ${validation.errors.join("\n  - ")}`);
  }
  const path = objectPath(brainRoot, frontmatter.project, frontmatter.type, frontmatter.id);
  const dir = path.replace(/\/[^/]+$/, "");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const text = serializeFrontmatter(frontmatter, body || "\n");
  writeFileSync(path, text);
  return { path, validation };
}

export function listObjects(brainRoot, project, type) {
  const dir = join(objectsRoot(brainRoot, project), dirForType(type));
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(".md") && !f.startsWith("_template-"))
    .map(f => join(dir, f));
}

export function listAllObjects(brainRoot, project) {
  const out = [];
  for (const type of Object.keys(TYPE_DIR)) {
    for (const file of listObjects(brainRoot, project, type)) {
      try {
        const obj = readObject(file);
        out.push({ ...obj, type });
      } catch (err) {
        out.push({ file_path: file, type, error: err.message });
      }
    }
  }
  return out;
}

export function listProjects(brainRoot) {
  const root = join(brainRoot, "objects", "projects");
  if (!existsSync(root)) return [];
  return readdirSync(root).filter(d => statSync(join(root, d)).isDirectory());
}

// Slugify Turkish/English title to id-safe form
export function slugify(s) {
  const tr = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };
  return s.split("").map(c => tr[c] ?? c).join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function makeId(type, title, date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${type}-${ymd}-${slugify(title)}`;
}
