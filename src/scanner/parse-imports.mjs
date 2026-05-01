// Zero-dep import parser. Regex-based — basit ama dogru sayidaki vakalar icin guvenli.
// Kapsam: ES import/export, dynamic import, CommonJS require.

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
