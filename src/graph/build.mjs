// Full graph builder — code scan + objects'i birlestirir.
import { resolve as pResolve, basename } from "node:path";
import { scanFiles, readFileSafe, countLines } from "../scanner/scan-files.mjs";
import { parseImports, parseTodos, parseIdMentions } from "../scanner/parse-imports.mjs";
import { resolveImport, loadTsconfigPaths, loadWorkspacePackages, isExternalPackage, isNodeBuiltin } from "../scanner/resolve-import.mjs";
import { ownerOf } from "../scanner/module-owner.mjs";
import { scanPackageJsons, allDependencies } from "../scanner/package-scan.mjs";
import { loadScanCache, saveScanCache } from "../scanner/cache.mjs";
import { listAllObjects, listProjects } from "../markdown/object.mjs";

// Node types — prompt sozlesmesi ile ayni
const NODE_TYPES = ["project","file","module","component","route","api","bug","decision","task","concept","dependency","session","package"];
const EDGE_TYPES = ["imports","uses","owns","mentions","fixes","caused_by","blocked_by","duplicates","related_to","stale_after","belongs_to","generated_from","scripts"];

function nid(type, key) { return `${type}:${key}`; }

export async function buildGraph({ projectRoot, brainRoot, projectId }) {
  const startedAt = Date.now();

  // ─── 1. Code scan ───
  const files = scanFiles(projectRoot);
  const aliases = loadTsconfigPaths(projectRoot);
  const workspaces = loadWorkspacePackages(projectRoot);
  const packages = scanPackageJsons(projectRoot);
  const allDeps = allDependencies(packages);

  const fileByRel = new Map();
  for (const f of files) fileByRel.set(f.rel_path, f);

  // ─── 2. Build nodes ───
  const nodes = new Map();
  const edges = [];

  function addNode(node) {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
    return nodes.get(node.id);
  }
  function addEdge(source, target, type, meta = {}) {
    edges.push({ source, target, type, ...meta });
  }

  // Project node — projectId parametresinden gelir (CLI --project_id veya
  // brain config'ten). Hardcoded "serif-platform" değişti (v0.2 hotfix).
  const pid = projectId || basename(projectRoot) || "project";
  addNode({ id: nid("project", pid), type: "project", label: pid, path: projectRoot });

  // Module nodes (her benzersiz module icin)
  const modules = new Set();
  for (const f of files) modules.add(ownerOf(f.rel_path));
  for (const m of modules) {
    addNode({ id: nid("module", m), type: "module", label: m });
    addEdge(nid("project", pid), nid("module", m), "owns");
  }

  // Package (dependency) nodes
  for (const [name, info] of allDeps) {
    addNode({ id: nid("package", name), type: "dependency", label: name, version: info.version });
  }

  // File nodes + analysis pass
  let totalImports = 0, unresolved = 0, externalRefs = 0, todoCount = 0;
  const tsconfigAliases = aliases;

  // 2a. File metadata + import parse (ARTIMLI: değişmeyen dosyalar cache'ten)
  const prevCache = loadScanCache(brainRoot);
  const nextCache = {};
  let cacheHits = 0;
  const fileImports = new Map(); // rel_path -> [resolved imports]
  for (const f of files) {
    const mtimeMs = f.mtime?.getTime?.() ?? 0;
    const prev = prevCache.files?.[f.rel_path];
    let loc, imports, todos, mentions;
    if (prev && prev.mtimeMs === mtimeMs && prev.size === f.size) {
      ({ loc, imports, todos, mentions } = prev);
      cacheHits++;
    } else {
      const text = readFileSafe(f.abs_path);
      loc = countLines(text);
      imports = parseImports(text);
      todos = parseTodos(text);
      mentions = parseIdMentions(text);
    }
    nextCache[f.rel_path] = { mtimeMs, size: f.size, loc, imports, todos, mentions };
    todoCount += todos.length;

    addNode({
      id: nid("file", f.rel_path),
      type: f.kind === "route" ? "route" : f.kind === "component" ? "component" : "file",
      label: basename(f.rel_path),
      path: f.rel_path,
      module: ownerOf(f.rel_path),
      kind: f.kind,
      loc,
      size: f.size,
      mtime: f.mtime?.toISOString?.() || null,
      todo_count: todos.length,
      todos: todos.slice(0, 5)
    });
    addEdge(nid("module", ownerOf(f.rel_path)), nid("file", f.rel_path), "owns");

    fileImports.set(f.rel_path, { imports, mentions });
  }
  saveScanCache(brainRoot, nextCache);

  // 2b. Resolve imports (dosyalar arasi)
  for (const f of files) {
    const { imports, mentions } = fileImports.get(f.rel_path);
    for (const spec of imports) {
      totalImports++;
      const r = resolveImport(spec, f.abs_path, projectRoot, tsconfigAliases, workspaces);
      if (r.kind === "file" && fileByRel.has(r.rel)) {
        addEdge(nid("file", f.rel_path), nid("file", r.rel), "imports");
      } else if (r.kind === "package") {
        externalRefs++;
        const pkgRoot = spec.startsWith("@") ? spec.split("/").slice(0,2).join("/") : spec.split("/")[0];
        if (!nodes.has(nid("package", pkgRoot))) {
          // bare import declared deps'te yoksa hala ekleyelim, "unresolved" flag ile
          addNode({ id: nid("package", pkgRoot), type: "dependency", label: pkgRoot, declared: false });
        }
        addEdge(nid("file", f.rel_path), nid("package", pkgRoot), "uses");
      } else if (r.kind === "node-builtin") {
        // skip — node:* is implicit
      } else {
        unresolved++;
      }
    }
    // [[id]] mentions in code
    for (const targetId of mentions) {
      const type = targetId.split("-")[0];
      addEdge(nid("file", f.rel_path), nid(type, targetId), "mentions");
    }
  }

  // ─── 3. Object nodes (bug/decision/note/session) ───
  const projects = listProjects(brainRoot);
  let objectCount = 0;
  for (const project of projects) {
    const objs = listAllObjects(brainRoot, project);
    for (const obj of objs) {
      if (obj.error) continue;
      const fm = obj.frontmatter;
      objectCount++;
      const node = {
        id: nid(fm.type, fm.id),
        type: fm.type,
        label: fm.title || fm.id,
        status: fm.status,
        priority: fm.priority,
        owner: fm.owner || null,
        created_at: fm.created_at,
        updated_at: fm.updated_at,
        module: Array.isArray(fm.module) ? fm.module : (fm.module ? [fm.module] : [])
      };
      addNode(node);

      // belongs_to module(s)
      for (const m of node.module) {
        if (!nodes.has(nid("module", m))) {
          addNode({ id: nid("module", m), type: "module", label: m });
        }
        addEdge(node.id, nid("module", m), "belongs_to");
      }

      // explicit relations
      const rel = fm.relations || {};
      for (const targetId of (rel.bugs || [])) addEdge(node.id, nid("bug", targetId), "related_to");
      for (const targetId of (rel.decisions || [])) addEdge(node.id, nid("decision", targetId), "related_to");
      for (const fileRel of (rel.files || [])) {
        if (fileByRel.has(fileRel)) {
          addEdge(node.id, nid("file", fileRel), fm.type === "bug" ? "fixes" : "mentions");
        }
      }
    }
  }

  const elapsed = Date.now() - startedAt;
  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    project_root: projectRoot,
    stats: {
      files_scanned: files.length,
      packages_found: packages.length,
      external_deps: allDeps.size,
      objects: objectCount,
      total_imports: totalImports,
      unresolved_imports: unresolved,
      external_refs: externalRefs,
      todos: todoCount,
      node_count: nodes.size,
      edge_count: edges.length,
      cache_hits: cacheHits,
      build_ms: elapsed
    },
    nodes: [...nodes.values()],
    edges,
    aliases: tsconfigAliases,
    valid_node_types: NODE_TYPES,
    valid_edge_types: EDGE_TYPES
  };
}
