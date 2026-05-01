// Import specifier -> file path resolver.
// Relative + index.{ts,tsx,js,jsx,mjs,cjs} resolution.
// Bare imports return null (handled as 'package' nodes upstream).
import { existsSync, statSync } from "node:fs";
import { dirname, resolve as pResolve, relative, join } from "node:path";

const TRY_EXTS = [".ts", ".tsx", ".mjs", ".js", ".jsx", ".cjs"];
const INDEX_FILES = TRY_EXTS.map(e => `index${e}`);

export function isRelative(spec) {
  return spec.startsWith("./") || spec.startsWith("../") || spec === "." || spec === "..";
}

export function isAbsolute(spec) {
  return spec.startsWith("/");
}

export function isAlias(spec) {
  return spec.startsWith("@/") || spec.startsWith("~/") || spec.startsWith("$");
}

export function isNodeBuiltin(spec) {
  return spec.startsWith("node:") ||
    /^(fs|path|crypto|os|util|child_process|stream|events|http|https|url|querystring|buffer|net|tls|zlib|readline|module|process|assert|cluster|dns|dgram|tty|vm|worker_threads|perf_hooks|inspector|repl|sqlite|test)$/.test(spec.split("/")[0]);
}

export function isExternalPackage(spec) {
  if (isRelative(spec) || isAbsolute(spec) || isAlias(spec)) return false;
  return true; // bare like "react", "@scope/pkg"
}

function tryFile(p) {
  if (existsSync(p)) {
    try {
      const s = statSync(p);
      if (s.isFile()) return p;
    } catch {}
  }
  return null;
}

function tryWithExts(base) {
  if (tryFile(base)) return base;
  for (const ext of TRY_EXTS) {
    const f = tryFile(base + ext);
    if (f) return f;
  }
  // directory + index.*
  if (existsSync(base)) {
    try {
      if (statSync(base).isDirectory()) {
        for (const idx of INDEX_FILES) {
          const f = tryFile(join(base, idx));
          if (f) return f;
        }
      }
    } catch {}
  }
  return null;
}

export function resolveImport(spec, fromAbsPath, projectRoot, aliases = {}) {
  if (isNodeBuiltin(spec)) return { kind: "node-builtin", spec };
  if (isRelative(spec)) {
    const base = pResolve(dirname(fromAbsPath), spec);
    const file = tryWithExts(base);
    if (file) return { kind: "file", abs: file, rel: relative(projectRoot, file) };
    return { kind: "unresolved-relative", spec };
  }
  if (isAlias(spec)) {
    // Try aliases mapping (from tsconfig 'paths' if loaded)
    for (const [from, toList] of Object.entries(aliases)) {
      const fromPattern = from.replace(/\*$/, "");
      if (spec.startsWith(fromPattern)) {
        const tail = spec.slice(fromPattern.length);
        for (const to of toList) {
          const toPattern = to.replace(/\*$/, "");
          const candidate = pResolve(projectRoot, toPattern + tail);
          const file = tryWithExts(candidate);
          if (file) return { kind: "file", abs: file, rel: relative(projectRoot, file) };
        }
      }
    }
    return { kind: "alias-unresolved", spec };
  }
  if (isAbsolute(spec)) {
    return { kind: "absolute", spec };
  }
  return { kind: "package", spec };
}

export function loadTsconfigPaths(projectRoot) {
  // Best effort — tsconfig.json varsa paths field'ini parse et.
  // JSON5 destegi yok; basit JSON varsayiyoruz.
  const tsconfig = pResolve(projectRoot, "tsconfig.json");
  if (!existsSync(tsconfig)) return {};
  try {
    const raw = require("node:fs").readFileSync(tsconfig, "utf8");
    // strip comments (basit)
    const cleaned = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const json = JSON.parse(cleaned);
    return json?.compilerOptions?.paths || {};
  } catch {
    return {};
  }
}
