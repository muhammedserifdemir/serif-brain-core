// Import specifier -> file path resolver.
// Relative + index.{ts,tsx,js,jsx,mjs,cjs} resolution.
// Bare imports return null (handled as 'package' nodes upstream).
import { existsSync, statSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve as pResolve, relative, join } from "node:path";
import { posixYol } from "../util/yol.mjs";

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

/**
 * PYTHON import cozumu.
 *   from .util import x     → ayni paket:  <dizin>/util.py | <dizin>/util/__init__.py
 *   from ..pkg.mod import y → iki ust dizin
 *   import a.b.c            → proje kokunden (ve yaygin kaynak koklerinden) a/b/c.py
 * Cozulemeyen (stdlib/3. parti) → "external": bu bir HATA degildir, bilgidir.
 */
export function resolvePythonImport(spec, fromAbsPath, projectRoot) {
  const dene = (base) => {
    for (const c of [`${base}.py`, `${base}.pyi`, join(base, "__init__.py")]) {
      if (existsSync(c) && statSync(c).isFile()) return c;
    }
    return null;
  };

  if (spec.startsWith(".")) {
    // Bastaki nokta sayisi = kac seviye yukari. "." = ayni dizin.
    const nokta = spec.match(/^\.+/)[0].length;
    const kalan = spec.slice(nokta).replace(/\./g, "/");
    let base = dirname(fromAbsPath);
    for (let i = 1; i < nokta; i++) base = dirname(base);
    const hedef = kalan ? join(base, kalan) : join(base, "__init__");
    const f = kalan ? dene(hedef) : (existsSync(join(base, "__init__.py")) ? join(base, "__init__.py") : null);
    if (f) return { kind: "file", abs: f, rel: posixYol(relative(projectRoot, f)) };
    return { kind: "unresolved-relative", spec };
  }

  const yol = spec.replace(/\./g, "/");
  // Proje koku + yaygin kaynak koklerinden dene. Python'da "src layout" da
  // yaygindir; ikisini de denemek, tek kok varsaymaktan dogru.
  for (const kok of ["", "src", "lib", "app"]) {
    const f = dene(join(projectRoot, kok, yol));
    if (f) return { kind: "file", abs: f, rel: posixYol(relative(projectRoot, f)) };
  }
  return { kind: "external", spec };  // stdlib ya da site-packages
}

/** PHP require/include: dogrudan yol. RUBY require_relative: goreli yol. */
export function resolvePathImport(spec, fromAbsPath, projectRoot, exts) {
  const temel = spec.startsWith("/") ? join(projectRoot, spec) : pResolve(dirname(fromAbsPath), spec);
  for (const c of [temel, ...exts.map((e) => temel + e)]) {
    if (existsSync(c) && statSync(c).isFile()) return { kind: "file", abs: c, rel: posixYol(relative(projectRoot, c)) };
  }
  return { kind: "external", spec };
}

export function resolveImport(spec, fromAbsPath, projectRoot, aliases = {}, workspaces = null) {
  if (isNodeBuiltin(spec)) return { kind: "node-builtin", spec };
  if (isRelative(spec)) {
    const base = pResolve(dirname(fromAbsPath), spec);
    const file = tryWithExts(base);
    if (file) return { kind: "file", abs: file, rel: posixYol(relative(projectRoot, file)) };
    return { kind: "unresolved-relative", spec };
  }
  // Takma ad: tsconfig kümesi (en yakın) VEYA klasik `@/ ~/ $` öneki.
  // Kümeler liste ise hedefler o tsconfig'in DİZİNİNE göre çözülür (projectRoot'a
  // göre değil) — monorepo'da aynı adın uygulamaya göre başka yeri göstermesinin
  // tek doğru karşılığı budur.
  const kume = yakinKume(aliases, fromAbsPath);
  const eskiSekil = !Array.isArray(aliases) && aliases && typeof aliases === "object";
  if (kume || (eskiSekil && isAlias(spec))) {
    const tablo = kume ? kume.paths : aliases;
    const taban = kume ? kume.dir : pResolve(projectRoot);
    // En UZUN önek kazansın: `@shared/quiz-interaction` ile `@shared/*` bir arada
    // tanımlıysa spesifik olan seçilmeli.
    const adaylar = Object.entries(tablo)
      .filter(([from]) => spec.startsWith(from.replace(/\*$/, "")))
      .sort((a, b) => b[0].replace(/\*$/, "").length - a[0].replace(/\*$/, "").length);
    for (const [from, toList] of adaylar) {
      const fromPattern = from.replace(/\*$/, "");
      const tail = spec.slice(fromPattern.length);
      for (const to of toList) {
        const toPattern = to.replace(/\*$/, "");
        const candidate = pResolve(taban, toPattern + tail);
        const file = tryWithExts(candidate);
        if (file) return { kind: "file", abs: file, rel: posixYol(relative(projectRoot, file)) };
      }
    }
    // Takma ad olarak TANINDI ama dosya bulunamadı → harici paket sayma.
    if (adaylar.length || isAlias(spec)) return { kind: "alias-unresolved", spec };
  }
  if (isAbsolute(spec)) {
    return { kind: "absolute", spec };
  }
  // Monorepo workspace paketi mi? (örn. @scope/pkg → packages/pkg/src)
  if (workspaces) {
    for (const [name, dir] of Object.entries(workspaces)) {
      if (spec === name || spec.startsWith(name + "/")) {
        const sub = spec.slice(name.length).replace(/^\//, "");
        const candidates = sub
          ? [join(dir, sub), join(dir, "src", sub)]
          : [join(dir, "src", "index"), join(dir, "index")];
        for (const base of candidates) {
          const file = tryWithExts(base);
          if (file) return { kind: "file", abs: file, rel: relative(projectRoot, file), workspace: name };
        }
      }
    }
  }
  return { kind: "package", spec };
}

/**
 * Monorepo workspace paketlerini yükle: { paketAdı: paketDizini }.
 * root package.json `workspaces` alanından (veya varsayılan packages/* taramasından).
 */
export function loadWorkspacePackages(projectRoot) {
  const out = {};
  let globs = [];
  const rootPkg = pResolve(projectRoot, "package.json");
  if (existsSync(rootPkg)) {
    try {
      const j = JSON.parse(stripJsonc(readFileSync(rootPkg, "utf8")));
      const ws = j.workspaces;
      globs = Array.isArray(ws) ? ws : (ws?.packages || []);
    } catch { /* yoksay */ }
  }
  if (!globs.length) globs = ["packages/*", "apps/*"]; // yaygın varsayılanları dene
  for (const g of globs) {
    const baseDir = g.replace(/\/\*+$/, "");
    const absBase = pResolve(projectRoot, baseDir);
    if (!existsSync(absBase)) continue;
    let entries;
    try { entries = readdirSync(absBase, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const pkgJson = join(absBase, e.name, "package.json");
      if (!existsSync(pkgJson)) continue;
      try {
        const pj = JSON.parse(stripJsonc(readFileSync(pkgJson, "utf8")));
        if (pj.name) out[pj.name] = join(absBase, e.name);
      } catch { /* yoksay */ }
    }
  }
  return out;
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

/** Tek bir tsconfig/jsconfig dosyasından paths+baseUrl okur; hedefler o dizine görelidir. */
function okuTsconfig(dir) {
  for (const name of ["tsconfig.json", "jsconfig.json"]) {
    const cfgPath = pResolve(dir, name);
    if (!existsSync(cfgPath)) continue;
    try {
      const raw = readFileSync(cfgPath, "utf8");
      const json = JSON.parse(stripJsonc(raw));
      const co = json?.compilerOptions || {};
      const paths = co.paths || {};
      if (!Object.keys(paths).length) return null;
      const baseUrl = (co.baseUrl || ".").replace(/\/$/, "");
      const norm = {};
      for (const [from, toList] of Object.entries(paths)) {
        const list = Array.isArray(toList) ? toList : [toList];
        norm[from] = list.map((to) => {
          const t = String(to).replace(/^\.\//, "");
          return baseUrl === "." ? t : `${baseUrl}/${t}`;
        });
      }
      return { dir: pResolve(dir), paths: norm };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Projedeki TÜM tsconfig/jsconfig `paths` kümelerini toplar — kök + workspace'ler.
 *
 * KRİTİK: bu paket ESM ("type":"module") — `require` TANIMSIZ. Eskiden burada
 * `require("node:fs")` çağrılıyordu → her zaman fırlatıp catch'e düşüyor, paths
 * DAİMA {} dönüyordu → tüm `@/...` alias import'ları çözülemiyordu.
 *
 * İKİNCİ KUSUR (2026-08-12'de ölçüldü): yalnız KÖK tsconfig okunuyordu. Monorepo'da
 * her uygulamanın kendi takma adları var ve AYNI ad farklı yeri gösterebiliyor —
 * serif-platform'da kökte `@shared/* → shared/*`, StudioX'te `@shared/* →
 * apps/serif-studio/src/shared/*`. Kök kazanınca uygulama-içi importlar ya yanlış
 * dosyaya bağlanıyor ya da "harici paket" sayılıyordu; `impact`/blast-radius
 * olduğundan KÜÇÜK çıkıyordu (ör. group-background.ts: gerçek 2 çağıran, graf 0).
 *
 * Dönüş: en DERİN dizin başta olacak şekilde sıralı liste. resolveImport, kaynak
 * dosyayı kapsayan en yakın kümeyi kullanır — tsc'nin davranışı da budur.
 */
export function loadTsconfigPaths(projectRoot) {
  const root = pResolve(projectRoot);
  const kumeler = [];
  const kok = okuTsconfig(root);
  if (kok) kumeler.push(kok);
  // Workspace dizinleri: package.json workspaces yoksa yaygın varsayılanlar.
  for (const [, dir] of Object.entries(loadWorkspacePackages(projectRoot))) {
    const s = okuTsconfig(dir);
    if (s) kumeler.push(s);
  }
  // Derin dizin önce: en yakın (en spesifik) tsconfig kazansın.
  kumeler.sort((a, b) => b.dir.length - a.dir.length);
  return kumeler;
}

/** Verilen dosyayı kapsayan en yakın paths kümesini seçer. */
function yakinKume(kumeler, fromAbsPath) {
  if (!Array.isArray(kumeler)) return null;
  const f = pResolve(fromAbsPath);
  for (const k of kumeler) {
    if (f === k.dir || f.startsWith(k.dir + "/")) return k;
  }
  return null;
}

/**
 * Bir specifier herhangi bir tsconfig kümesinde takma ad olarak tanımlı mı?
 * isAlias() yalnız `@/`, `~/`, `$` önekini biliyor; `@shared/...`, `@modules/...`
 * gibi tsconfig-tanımlı adlar onun gözünde HARİCİ PAKET'ti. Takma adın ne olduğuna
 * karar veren tek yetkili tsconfig'dir; bu yüzden kararı ona soruyoruz.
 */
export function isTsconfigAlias(spec, kumeler, fromAbsPath) {
  const k = yakinKume(kumeler, fromAbsPath);
  if (!k) return false;
  for (const from of Object.keys(k.paths)) {
    const pattern = from.replace(/\*$/, "");
    if (pattern && spec.startsWith(pattern)) return true;
  }
  return false;
}
