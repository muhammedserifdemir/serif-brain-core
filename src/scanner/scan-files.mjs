// File walker — code source dosyalarini topla, build/cache/test atla.
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";

export const EXCLUDED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", ".vite",
  ".cache", "coverage", ".serif-brain", "graphify-out", ".turbo",
  ".vercel", ".idea", ".vscode", ".obsidian", "__pycache__"
]);

export const INCLUDED_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

export const TEST_PATTERNS = [/\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/, /__tests__/, /\.stories\.[tj]sx?$/];
export const TYPE_DECL_PATTERN = /\.d\.ts$/;

// Route/page heuristics — Next.js, SvelteKit, Astro, generic
export const ROUTE_PATTERNS = [
  /\/(page|layout|route|loading|error|not-found)\.[tj]sx?$/,
  /\/\+page\.svelte$/, /\/\+layout\.svelte$/,
  /\/pages\/[^/]+\.[tj]sx?$/
];

export function classifyFile(relPath) {
  if (TYPE_DECL_PATTERN.test(relPath)) return "type-declaration";
  if (TEST_PATTERNS.some(re => re.test(relPath))) return "test";
  if (ROUTE_PATTERNS.some(re => re.test(relPath))) return "route";
  if (/\/components?\//i.test(relPath) && /\.[tj]sx$/.test(relPath)) return "component";
  return "source";
}

export function scanFiles(root, opts = {}) {
  const out = [];
  const includeTests = opts.include_tests ?? false;
  const includeTypes = opts.include_types ?? false;

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && !["src","app"].includes(entry.name)) {
        // Allow .serif-platform-style dot dirs are still excluded if in EXCLUDED_DIRS
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (!INCLUDED_EXTS.has(ext)) continue;
        const rel = relative(root, full);
        const kind = classifyFile(rel);
        if (kind === "test" && !includeTests) continue;
        if (kind === "type-declaration" && !includeTypes) continue;
        let stat;
        try { stat = statSync(full); } catch { continue; }
        out.push({
          abs_path: full,
          rel_path: rel,
          ext,
          kind,
          size: stat.size,
          mtime: stat.mtime
        });
      }
    }
  }

  walk(root);
  return out;
}

export function readFileSafe(path) {
  try { return readFileSync(path, "utf8"); }
  catch { return ""; }
}

export function countLines(text) {
  if (!text) return 0;
  let n = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}
