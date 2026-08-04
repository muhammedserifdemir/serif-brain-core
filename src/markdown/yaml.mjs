// Mini YAML parser/serializer — frontmatter ve config.yaml scope.
// Desteklenenler:
//   - key: value (string, number, boolean, null)
//   - key: "quoted string" (' veya ")
//   - key: [a, b, c] inline array
//   - key:\n  - item1\n  - item2 block array
//   - key:\n  subkey: val nested object (parseBlock ozyinelemeli — cok-seviye calisir)
//   - key: | / key: > block scalar (literal/folded, chomp -/+; collapseBlockScalars on-gecisi)
//   - cok-satirli string serialize → tirnakli (escaped) round-trip
//   - # comment (line-tail veya tam satir)
//   - --- delimiter (frontmatter sinirlari)
// Desteklenmeyen: anchors, tags, liste-ogesi-ICINDE nested object serialize'i
//   (serializeInline THROW eder — SESSIZ degil), tab girinti (parse THROW eder).
//   GARANTI: desteklenmeyen girdi sessizce KAYBETMEZ, sesli hata verir.
//   (Bkz. test/faz17-yaml-roundtrip + faz20-block-scalar — fail-loud + block scalar sozlesmesi.)

const NULL_TOKENS = new Set(["~", "null", "Null", "NULL", ""]);
const TRUE_TOKENS = new Set(["true", "True", "TRUE", "yes", "Yes", "YES"]);
const FALSE_TOKENS = new Set(["false", "False", "FALSE", "no", "No", "NO"]);

function stripComment(line) {
  // Yorum sadece # ile baslayan veya bosluktan sonra # gelen pozisyonda kesilir.
  // Ama tirnak icindeki # yorum degil.
  let inSingle = false, inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble) {
      if (i === 0 || line[i - 1] === " " || line[i - 1] === "\t") return line.slice(0, i).replace(/\s+$/, "");
    }
  }
  return line;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (NULL_TOKENS.has(s)) return null;
  if (TRUE_TOKENS.has(s)) return true;
  if (FALSE_TOKENS.has(s)) return false;
  // Quoted string
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
      .replace(/\\"/g, '"').replace(/\\'/g, "'")
      .replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
  }
  // Inline array
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (inner === "") return [];
    return splitInlineArray(inner).map(parseScalar);
  }
  // Inline object — { key: val, key2: "v2" }. Eskiden fırlatıyordu; frontmatter'da
  // `source: { kind: manual, path: "" }` gibi satırlar parse hatası veriyordu.
  if (s.startsWith("{") && s.endsWith("}")) {
    const inner = s.slice(1, -1).trim();
    if (inner === "") return {};
    const obj = {};
    for (const part of splitInlineArray(inner)) {
      const seg = part.trim();
      if (!seg) continue;
      const ci = findInlineColon(seg);
      if (ci === -1) continue;
      const k = parseScalar(seg.slice(0, ci).trim());
      obj[String(k)] = parseScalar(seg.slice(ci + 1).trim());
    }
    return obj;
  }
  // Number
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  // ISO date / unquoted string — string olarak birak
  return s;
}

// İlk tırnak-dışı ":" indeksi (inline object anahtar/değer ayrımı için).
function findInlineColon(s) {
  let inS = false, inD = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === ":" && !inS && !inD) return i;
  }
  return -1;
}

function splitInlineArray(s) {
  const out = [];
  let depth = 0, inSingle = false, inDouble = false;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") depth--;
      else if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    }
    cur += c;
  }
  if (cur.trim() !== "") out.push(cur);
  return out;
}

function getIndent(line) {
  let n = 0;
  while (n < line.length && line[n] === " ") n++;
  return n;
}

// Block scalar (| literal, > folded) ON-GECISI: `key: |` / `key: >` bloklarini
// TEK satirlik quoted scalar'a cevirir. Boylece cekirdek parser'a (parseDict/List)
// hic dokunmadan multi-line deger desteklenir; herhangi bir indent seviyesinde calisir.
// Chomp: default/'-' clip (sondaki newline'lar kirpilir), '+' korunur.
function collapseBlockScalars(text) {
  const lines = text.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)([^:#\n]+):[ \t]*([|>])([-+]?)[ \t]*(#.*)?$/);
    if (!m) { out.push(lines[i]); continue; }

    const indent = m[1].length, key = m[2], style = m[3], chomp = m[4];
    const block = [];
    let j = i + 1;
    while (j < lines.length) {
      const l = lines[j];
      if (l.trim() === "") { block.push(""); j++; continue; }
      if (getIndent(l) > indent) { block.push(l); j++; continue; }
      break;
    }
    if (!block.length) { out.push(lines[i]); continue; } // bos blok → dokunma

    const nonBlank = block.filter((b) => b.trim() !== "");
    const minIndent = nonBlank.length ? Math.min(...nonBlank.map(getIndent)) : indent + 1;
    const content = block.map((b) => (b.trim() === "" ? "" : b.slice(minIndent)));

    let value;
    if (style === "|") {
      value = content.join("\n");
    } else {
      // folded: bos satirla ayrilmis paragraflar; paragraf-ici satirlar bosluk ile birlesir.
      const paras = []; let cur = [];
      for (const c of content) { if (c === "") { paras.push(cur.join(" ")); cur = []; } else cur.push(c); }
      paras.push(cur.join(" "));
      value = paras.join("\n");
    }
    value = value.replace(/\n*$/, ""); // clip (sondaki bos satirlari kirp)
    if (chomp === "+") value += "\n";  // keep: tek trailing newline

    out.push(`${m[1]}${key}: ${JSON.stringify(value)}`);
    i = j - 1;
  }
  return out.join("\n");
}

export function parseYaml(text) {
  // Block scalar'lari once tek-satir quoted scalar'a indir (cekirdek parser degismez).
  const rawLines = collapseBlockScalars(text).split("\n");
  // Yorum + bos satir + delimiter temizle
  const lines = rawLines
    .map((l, i) => ({ raw: l, line: stripComment(l), n: i + 1 }))
    .filter(({ line }) => line.trim() !== "" && line.trim() !== "---");

  return parseBlock(lines, 0, 0).value;
}

function parseBlock(lines, startIdx, indent) {
  // Bu seviyedeki tum entry'leri oku, ayni veya daha az indent goren satirda dur.
  // "Dictionary" ya da "list" — ilk satira gore karar.
  if (startIdx >= lines.length) return { value: {}, nextIdx: startIdx };

  const first = lines[startIdx];
  const firstIndent = getIndent(first.line);
  if (firstIndent < indent) return { value: {}, nextIdx: startIdx };

  const isList = first.line.trimStart().startsWith("- ");
  if (isList) return parseList(lines, startIdx, firstIndent);
  return parseDict(lines, startIdx, firstIndent);
}

function parseDict(lines, startIdx, indent) {
  const obj = {};
  let i = startIdx;
  while (i < lines.length) {
    const { line, n } = lines[i];
    const cur = getIndent(line);
    if (cur < indent) break;
    if (cur > indent) {
      throw new Error(`Line ${n}: unexpected indent ${cur}, expected ${indent}: '${line}'`);
    }
    const trimmed = line.slice(cur);
    if (trimmed.startsWith("- ")) break; // bu seviye liste basladi, dict sonu

    const colon = findKeyColon(trimmed);
    if (colon < 0) throw new Error(`Line ${n}: expected key:value but got '${trimmed}'`);
    const key = unquoteKey(trimmed.slice(0, colon).trim());
    const after = trimmed.slice(colon + 1).trim();

    if (after === "") {
      // Sonraki satirlar nested
      const childIdx = i + 1;
      if (childIdx >= lines.length || getIndent(lines[childIdx].line) <= indent) {
        obj[key] = null;
        i++;
        continue;
      }
      const childIndent = getIndent(lines[childIdx].line);
      const sub = parseBlock(lines, childIdx, childIndent);
      obj[key] = sub.value;
      i = sub.nextIdx;
    } else {
      obj[key] = parseScalar(after);
      i++;
    }
  }
  return { value: obj, nextIdx: i };
}

// Tirnakli anahtarin tirnagini soy: `'lib/auth/': auth` -> anahtar `lib/auth/`.
// Eskiden tirnaklar anahtarda kaliyordu; module_paths gibi anahtari VERI olan
// haritalarda kural sessizce hic eslesmiyordu (yazan hata gormez, sonuc yanlis).
function unquoteKey(k) {
  if (k.length >= 2 && ((k[0] === "'" && k.at(-1) === "'") || (k[0] === '"' && k.at(-1) === '"'))) {
    return k.slice(1, -1);
  }
  return k;
}

function findKeyColon(s) {
  // Ilk siralama disi kolonu bul (tirnak icinde olmayan).
  let inSingle = false, inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === ":" && !inSingle && !inDouble) {
      // colon'dan sonra space veya satir sonu olmali (URL'leri bozmamak icin)
      if (i + 1 === s.length || s[i + 1] === " " || s[i + 1] === "\t") return i;
    }
  }
  return -1;
}

function parseList(lines, startIdx, indent) {
  const arr = [];
  let i = startIdx;
  while (i < lines.length) {
    const { line, n } = lines[i];
    const cur = getIndent(line);
    if (cur < indent) break;
    if (cur > indent) throw new Error(`Line ${n}: unexpected indent in list: '${line}'`);
    const trimmed = line.slice(cur);
    if (!trimmed.startsWith("- ")) break;
    const after = trimmed.slice(2).trim();

    if (after === "") {
      // - \n      key: value (nested obj item)
      const childIdx = i + 1;
      if (childIdx < lines.length && getIndent(lines[childIdx].line) > indent) {
        const sub = parseBlock(lines, childIdx, getIndent(lines[childIdx].line));
        arr.push(sub.value);
        i = sub.nextIdx;
        continue;
      }
      arr.push(null);
      i++;
      continue;
    }

    // - key: value (inline first-key of mapping)
    const colon = findKeyColon(after);
    if (colon > 0) {
      const key = after.slice(0, colon).trim();
      const val = after.slice(colon + 1).trim();
      const item = {};
      if (val === "") {
        const childIdx = i + 1;
        if (childIdx < lines.length && getIndent(lines[childIdx].line) > indent) {
          const sub = parseBlock(lines, childIdx, getIndent(lines[childIdx].line));
          item[key] = sub.value;
          i = sub.nextIdx;
          arr.push(item);
          continue;
        }
        item[key] = null;
      } else {
        item[key] = parseScalar(val);
      }
      // Ek key'ler (- foo: bar\n  baz: qux)
      let j = i + 1;
      const expectedChildIndent = indent + 2;
      while (j < lines.length && getIndent(lines[j].line) === expectedChildIndent && !lines[j].line.slice(expectedChildIndent).startsWith("- ")) {
        const childLine = lines[j].line.slice(expectedChildIndent);
        const childColon = findKeyColon(childLine);
        if (childColon < 0) break;
        const ck = childLine.slice(0, childColon).trim();
        const cv = childLine.slice(childColon + 1).trim();
        if (cv === "") {
          // Daha derin nested
          const grandIdx = j + 1;
          if (grandIdx < lines.length && getIndent(lines[grandIdx].line) > expectedChildIndent) {
            const sub = parseBlock(lines, grandIdx, getIndent(lines[grandIdx].line));
            item[ck] = sub.value;
            j = sub.nextIdx;
            continue;
          }
          item[ck] = null;
        } else {
          item[ck] = parseScalar(cv);
        }
        j++;
      }
      i = j;
      arr.push(item);
      continue;
    }

    arr.push(parseScalar(after));
    i++;
  }
  return { value: arr, nextIdx: i };
}

// ─── Serializer ───

function serializeScalar(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (v === "") return '""';
    // Quote if contains special chars, leading/trailing space, or YAML keywords
    // Kontrol karakteri (\n \r \t) iceren string'i de tirnakla → cok-satirli string
    // tek satira (escaped) serialize edilir, parseScalar geri cozer (round-trip korunur).
    if (/^(true|false|null|yes|no|~)$/i.test(v) || /^-?\d/.test(v) || /[:#\[\]\{\},&*!|>'"%@`]/.test(v) || /^\s|\s$/.test(v) || /[\n\r\t]/.test(v)) {
      return JSON.stringify(v);
    }
    return v;
  }
  throw new Error(`Cannot serialize scalar: ${typeof v}`);
}

export function serializeYaml(obj, indent = 0) {
  if (obj === null || obj === undefined) return "null\n";
  if (typeof obj !== "object") return serializeScalar(obj) + "\n";

  const pad = " ".repeat(indent);
  const lines = [];

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]\n";
    for (const item of obj) {
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        const keys = Object.keys(item);
        if (keys.length === 0) {
          lines.push(`${pad}- {}`);
        } else {
          const [first, ...rest] = keys;
          lines.push(`${pad}- ${first}: ${serializeInline(item[first])}`);
          for (const k of rest) {
            lines.push(`${pad}  ${k}: ${serializeInline(item[k])}`);
          }
        }
      } else if (Array.isArray(item)) {
        lines.push(`${pad}- ${JSON.stringify(item)}`);
      } else {
        lines.push(`${pad}- ${serializeScalar(item)}`);
      }
    }
    return lines.join("\n") + "\n";
  }

  const keys = Object.keys(obj);
  for (const k of keys) {
    const v = obj[k];
    if (v === null || v === undefined) {
      lines.push(`${pad}${k}: null`);
    } else if (Array.isArray(v)) {
      if (v.length === 0) lines.push(`${pad}${k}: []`);
      else if (v.every(x => x === null || typeof x !== "object")) {
        // inline kisa array
        const inline = "[" + v.map(serializeScalar).join(", ") + "]";
        if (inline.length < 80) lines.push(`${pad}${k}: ${inline}`);
        else {
          lines.push(`${pad}${k}:`);
          for (const x of v) lines.push(`${pad}  - ${serializeScalar(x)}`);
        }
      } else {
        lines.push(`${pad}${k}:`);
        for (const item of v) {
          if (item !== null && typeof item === "object" && !Array.isArray(item)) {
            const ikeys = Object.keys(item);
            if (ikeys.length === 0) lines.push(`${pad}  - {}`);
            else {
              const [first, ...rest] = ikeys;
              lines.push(`${pad}  - ${first}: ${serializeInline(item[first])}`);
              for (const ck of rest) lines.push(`${pad}    ${ck}: ${serializeInline(item[ck])}`);
            }
          } else {
            lines.push(`${pad}  - ${serializeScalar(item)}`);
          }
        }
      }
    } else if (typeof v === "object") {
      lines.push(`${pad}${k}:`);
      lines.push(serializeYaml(v, indent + 2).replace(/\n$/, ""));
    } else {
      lines.push(`${pad}${k}: ${serializeScalar(v)}`);
    }
  }
  return lines.join("\n") + "\n";
}

function serializeInline(v) {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "[" + v.map(serializeScalar).join(", ") + "]";
  if (typeof v === "object") throw new Error("Cannot serialize nested object inline");
  return serializeScalar(v);
}
