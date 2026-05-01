// package.json deps + scripts okur. Tek root, ya da workspaces taranabilir.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export function scanPackageJsons(projectRoot) {
  const out = [];
  function walk(dir, depth = 0) {
    if (depth > 5) return;
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const json = JSON.parse(readFileSync(pkgPath, "utf8"));
        out.push({
          rel_path: relative(projectRoot, pkgPath),
          name: json.name || null,
          version: json.version || null,
          scripts: json.scripts || {},
          dependencies: json.dependencies || {},
          devDependencies: json.devDependencies || {},
          peerDependencies: json.peerDependencies || {}
        });
      } catch (e) {
        out.push({ rel_path: relative(projectRoot, pkgPath), error: e.message });
      }
    }
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", "build", ".next", ".serif-brain"].includes(entry.name)) continue;
        if (entry.name.startsWith(".")) continue;
        walk(join(dir, entry.name), depth + 1);
      }
    }
  }
  walk(projectRoot);
  return out;
}

export function allDependencies(packages) {
  const all = new Map();
  for (const pkg of packages) {
    if (pkg.error) continue;
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const [name, version] of Object.entries(pkg[field] || {})) {
        if (!all.has(name)) all.set(name, { version, declared_in: [] });
        all.get(name).declared_in.push(`${pkg.rel_path}:${field}`);
      }
    }
  }
  return all;
}
