// Import specifier -> file path resolver.
// Relative + index.{ts,tsx,js,jsx,mjs,cjs} resolution.
// Bare imports return null (handled as 'package' nodes upstream).
import { existsSync, statSync, readFileSync } from "node:fs";
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

// JSONC (yorumlu + trailing-virgüllü JSON) -> temiz JSON metni.
// KRİTİK: string-farkında. Naive regex blok-yorum sıyırma, string içindeki
// glob/alias değerlerinde geçen yorum-benzeri dizileri yanlış eşleyip paths'i
// siliyordu (tsconfig "@/*" + "**/*.ts" bir arada olunca). Bu sürüm string ve
// escape durumunu izleyerek YALNIZ gerçek yorumları atar.
function stripJsonc(src) {
  let out = "";
  let inStr = false, strCh = "", inLine = false, inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === "\n") { inLine = false; out += c; } continue; }
    if (inBlock) { if (c === "*" && n === "/") { inBlock = false; i++; } continue; }
    if (inStr) {
      out += c;
      if (c === "\\") { out += (n ?? ""); i++; continue; }
      if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; out += c; continue; }
    if (c === "/" && n === "/") { inLine = true; i++; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, "$1"); // trailing virgül
}

export function loadTsconfigPaths(projectRoot) {
  // tsconfig.json (yoksa jsconfig.json) compilerOptions.paths + baseUrl oku.
  // KRİTİK: bu paket ESM ("type":"module") — `require` TANIMSIZ. Eskiden burada
  // `require("node:fs")` çağrılıyordu → her zaman fırlatıp catch'e düşüyor, paths
  // DAİMA {} dönüyordu → tüm `@/...` alias import'ları çözülemiyordu (yüzlerce
  // sahte "unresolved" + şişmiş orphan). readFileSync ile düzeltildi.
  // JSON5 değil; yorumlar + trailing virgül kabaca sıyrılır.
  for (const name of ["tsconfig.json", "jsconfig.json"]) {
    const cfgPath = pResolve(projectRoot, name);
    if (!existsSync(cfgPath)) continue;
    try {
      const raw = readFileSync(cfgPath, "utf8");
      const json = JSON.parse(stripJsonc(raw));
      const co = json?.compilerOptions || {};
      const paths = co.paths || {};
      const baseUrl = (co.baseUrl || ".").replace(/\/$/, "");
      // Hedefleri baseUrl'e göre projectRoot-göreli normalize et (resolveImport
      // pResolve(projectRoot, ...) yapıyor; '*' korunur).
      const norm = {};
      for (const [from, toList] of Object.entries(paths)) {
        const list = Array.isArray(toList) ? toList : [toList];
        norm[from] = list.map((to) => {
          const t = String(to).replace(/^\.\//, "");
          return baseUrl === "." ? t : `${baseUrl}/${t}`;
        });
      }
      return norm;
    } catch {
      return {};
    }
  }
  return {};
}
