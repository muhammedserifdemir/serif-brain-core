// Zero-dep import parser. Regex-based — basit ama dogru sayidaki vakalar icin guvenli.
// Diller: JS/TS (ES import/export, dynamic import, require), Python, PHP, Ruby.
// Modul-tabanli diller (Swift/C#/Java/...) icin ayristirici YOKTUR: oralarda
// import bir dosyaya degil bir module isaret eder, kenar uydurulmaz.
// Dil tanimlarinin tek kaynagi: scanner/languages.mjs
import { parserOf } from "./languages.mjs";

const IMPORT_STATIC_RE  = /^[ \t]*import\s+(?:type\s+)?(?:[\s\S]+?\s+from\s+)?["']([^"']+)["']/gm;
const IMPORT_BARE_RE    = /^[ \t]*import\s+["']([^"']+)["']/gm;
const IMPORT_DYNAMIC_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const REQUIRE_RE        = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
const EXPORT_FROM_RE    = /^[ \t]*export\s+(?:type\s+)?(?:[\s\S]+?\s+from\s+)?["']([^"']+)["']/gm;

const TODO_RE = /\b(TODO|FIXME|HACK|XXX|BUG)(?:\(([^)]*)\))?:\s*([^\n]+)/g;

// Crude comment stripper — block + line. String-aware enough for code.
export function stripComments(code) {
  let out = "";
  let i = 0;
  let inSingle = false, inDouble = false, inTemplate = false, inBacktick = false;
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (!inSingle && !inDouble && !inBacktick) {
      if (c === "/" && next === "/") {
        while (i < code.length && code[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && next === "*") {
        i += 2;
        while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i++;
        i += 2;
        continue;
      }
    }
    if (c === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
    else if (c === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
    else if (c === "`" && !inSingle && !inDouble) inBacktick = !inBacktick;
    out += c;
    i++;
  }
  return out;
}

// ── Python ──────────────────────────────────────────────────────────────────
// import a.b.c  ·  import a as x  ·  from .rel import y  ·  from ..pkg import z
// Goreli import'lar nokta sayisiyla kodlanir: "." = ayni paket, ".." = ust.
const PY_FROM_RE = /^[ \t]*from[ \t]+(\.*[\w.]*)[ \t]+import[ \t]/gm;
const PY_IMPORT_RE = /^[ \t]*import[ \t]+([\w.]+(?:[ \t]*,[ \t]*[\w.]+)*)/gm;

function parsePython(code) {
  const specs = new Set();
  const stripped = stripHashComments(code);
  let m;
  PY_FROM_RE.lastIndex = 0;
  while ((m = PY_FROM_RE.exec(stripped)) !== null) if (m[1]) specs.add(m[1]);
  PY_IMPORT_RE.lastIndex = 0;
  while ((m = PY_IMPORT_RE.exec(stripped)) !== null) {
    for (const parca of m[1].split(",")) {
      const ad = parca.trim().split(/\s+as\s+/)[0].trim();
      if (ad) specs.add(ad);
    }
  }
  return [...specs];
}

// ── PHP ─────────────────────────────────────────────────────────────────────
// YALNIZ require/include '<yol>' — bunlar bir DOSYAYA isaret eder.
// `use App\Models\User;` BILEREK alinmiyor: namespace'i dosyaya cevirmek
// composer autoload (PSR-4) haritasini okumayi gerektirir. Cozemeyecegimiz
// seyi spec olarak uretirsek "cozulemeyen import" sayaci sisirilir ve
// gercek eksikler o gurultunun icinde kaybolur.
const PHP_REQUIRE_RE = /\b(?:require|include)(?:_once)?\s*\(?\s*['"]([^'"]+)['"]/g;

function parsePhp(code) {
  const specs = new Set();
  const stripped = stripComments(code);
  let m;
  PHP_REQUIRE_RE.lastIndex = 0;
  while ((m = PHP_REQUIRE_RE.exec(stripped)) !== null) specs.add(m[1]);
  return [...specs];
}

// ── Ruby ────────────────────────────────────────────────────────────────────
const RB_RE = /\b(?:require_relative|require)\s*\(?\s*['"]([^'"]+)['"]/g;

function parseRuby(code) {
  const specs = new Set();
  const stripped = stripHashComments(code);
  let m;
  RB_RE.lastIndex = 0;
  while ((m = RB_RE.exec(stripped)) !== null) specs.add(m[1]);
  return [...specs];
}

// `#` yorum temizleyici (Python/Ruby/Shell). Tirnak icindeki # korunur.
export function stripHashComments(code) {
  let out = "";
  let tek = false, cift = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "'" && !cift) tek = !tek;
    else if (c === '"' && !tek) cift = !cift;
    else if (c === "#" && !tek && !cift) {
      while (i < code.length && code[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Dosya yoluna gore DOGRU ayristiriciyi secer.
 *
 * relPath verilmezse JS varsayilir — eski cagri yerleri (ve testler) bozulmasin
 * diye. Modul-tabanli diller (parser "module") BOS DIZI doner: o dosyalar
 * indekslenir ama import kenari uretilmez.
 */
export function parseImportsFor(relPath, code) {
  switch (parserOf(relPath)) {
    case "python": return parsePython(code);
    case "php": return parsePhp(code);
    case "ruby": return parseRuby(code);
    case "module": return [];       // kenar UYDURULMAZ
    case "js": return parseImports(code);
    default: return [];
  }
}

export function parseImports(code) {
  const stripped = stripComments(code);
  const specs = new Set();
  const collect = (re) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(stripped)) !== null) specs.add(m[1]);
  };
  collect(IMPORT_STATIC_RE);
  collect(IMPORT_BARE_RE);
  collect(IMPORT_DYNAMIC_RE);
  collect(REQUIRE_RE);
  collect(EXPORT_FROM_RE);
  return [...specs];
}

export function parseTodos(code) {
  const lines = code.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    TODO_RE.lastIndex = 0;
    let m;
    while ((m = TODO_RE.exec(lines[i])) !== null) {
      out.push({ line: i + 1, kind: m[1], owner: m[2] || "", text: m[3].trim() });
    }
  }
  return out;
}

// Bug/decision id mention detection in source code (e.g. // see [[bug-...]])
const ID_MENTION_RE = /\[\[((?:bug|decision|note|session)-[a-z0-9-]+)\]\]/g;
export function parseIdMentions(code) {
  ID_MENTION_RE.lastIndex = 0;
  const ids = new Set();
  let m;
  while ((m = ID_MENTION_RE.exec(code)) !== null) ids.add(m[1]);
  return [...ids];
}
