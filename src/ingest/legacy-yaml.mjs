// Legacy `.claude/brain/*.yaml` ingest — sadece arsivden okur.
// Mini YAML parser block scalars (|, >) desteklemedigi icin pragmatic
// regex-based record splitter + field extractor kullaniyoruz.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Bir YAML dosyasindaki "- " ile baslayan record'lari yakala.
export function splitTopLevelRecords(text) {
  const lines = text.split("\n");
  const records = [];
  let current = [];
  let inRecord = false;
  for (const line of lines) {
    // Top-level "- " (sifir indent)
    if (/^- /.test(line)) {
      if (current.length) records.push(current.join("\n"));
      // First-line normalization: "- date: 2026-..." → "  date: 2026-..."
      // Bu sayede field extractor ilk-satir hyphen'i maskelemiyor.
      current = [line.replace(/^- /, "  ")];
      inRecord = true;
    } else if (inRecord) {
      // Records bittiginde (yorum/bos/yeni section bashladiginda)
      if (/^[a-zA-Z_#]/.test(line) && !line.startsWith("# ")) {
        // Yeni top-level section (degil record). Stop.
        records.push(current.join("\n"));
        current = [];
        inRecord = false;
      } else {
        current.push(line);
      }
    }
  }
  if (current.length) records.push(current.join("\n"));
  return records;
}

// Simple field extraction from YAML record block (handles unquoted, quoted, single-line).
export function extractField(block, key) {
  const re = new RegExp(`^\\s*${key}:\\s*(.*?)\\s*$`, "m");
  const m = re.exec(block);
  if (!m) return null;
  let v = m[1].trim();
  if (v === "" || v === "|" || v === ">") return null; // block scalar follow-up
  v = v.replace(/^["']|["']$/g, "");
  return v;
}

export function extractList(block, key) {
  // Inline: key: [a, b, c]
  const inlineRe = new RegExp(`^\\s*${key}:\\s*\\[([^\\]]*)\\]`, "m");
  const im = inlineRe.exec(block);
  if (im) {
    return im[1].split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  // Block:
  // key:
  //   - item1
  //   - item2
  const lines = block.split("\n");
  let i = -1;
  for (let j = 0; j < lines.length; j++) {
    if (new RegExp(`^\\s*${key}:\\s*$`).test(lines[j])) { i = j; break; }
  }
  if (i < 0) return [];
  const out = [];
  for (let j = i + 1; j < lines.length; j++) {
    const line = lines[j];
    const m = /^\s+-\s+(.+)$/.exec(line);
    if (m) out.push(m[1].trim().replace(/^["']|["']$/g, ""));
    else if (/^\s*[a-zA-Z_]+:/.test(line)) break; // next field
    else if (line.trim() === "") continue;
  }
  return out;
}

// Block scalar body extraction (after `key: |` or `key: >`).
export function extractBody(block, key) {
  const lines = block.split("\n");
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^\\s*${key}:\\s*[|>]\\s*$`).test(lines[i])) { startIdx = i + 1; break; }
  }
  if (startIdx < 0) return "";
  // Determine indent of the block body (first non-empty line)
  let bodyIndent = -1;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    bodyIndent = lines[i].length - lines[i].trimStart().length;
    break;
  }
  if (bodyIndent < 0) return "";
  const out = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") { out.push(""); continue; }
    const indent = line.length - line.trimStart().length;
    if (indent < bodyIndent) break;
    out.push(line.slice(bodyIndent));
  }
  return out.join("\n").trim();
}

export function ingestDecisionsYaml(archivePath) {
  const file = join(archivePath, "1-project-brain", "decisions.yaml");
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8");
  const records = splitTopLevelRecords(text);
  const out = [];
  for (const rec of records) {
    const date = extractField(rec, "date");
    const title = extractField(rec, "decision");
    if (!title || !date) continue; // not a decision record
    const status = extractField(rec, "status");
    const priority = extractField(rec, "priority");
    const modules = extractList(rec, "modules");
    const vaultRef = extractField(rec, "vault_ref");
    const body = (extractBody(rec, "yapilan") || "") + "\n\n" + (extractBody(rec, "problemler") || "") + "\n\n" + (extractBody(rec, "cozum_yonu") || "");
    out.push({
      source: { kind: "legacy_yaml", path: "1-project-brain/decisions.yaml" },
      raw: { date, title, status, priority, modules, vault_ref: vaultRef },
      proposed: {
        type: "decision",
        project: "serif-platform",
        title,
        module: modules.length > 0 ? (modules.length === 1 ? modules[0] : modules) : "unknown",
        status,
        priority,
        created_at: date,
        updated_at: date,
        body: body.trim()
      },
      vault_ref: vaultRef
    });
  }
  return out;
}

export function ingestBugsYaml(archivePath) {
  const file = join(archivePath, "1-project-brain", "bugs.yaml");
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8");
  const records = splitTopLevelRecords(text);
  const out = [];
  for (const rec of records) {
    const id = extractField(rec, "id");
    const desc = extractField(rec, "desc");
    if (!id && !desc) continue;
    const module = extractField(rec, "module");
    const status = extractField(rec, "status");
    const priority = extractField(rec, "priority");
    const date = extractField(rec, "date");
    const closed = extractField(rec, "closed");
    const impact = extractField(rec, "impact");
    const fix = extractBody(rec, "fix");
    const next = extractField(rec, "next_action");
    out.push({
      source: { kind: "legacy_yaml", path: "1-project-brain/bugs.yaml" },
      raw: { id, desc, module, status, priority, date, closed },
      proposed: {
        type: "bug",
        project: "serif-platform",
        title: desc || id,
        module: module || "unknown",
        status,
        priority,
        created_at: date,
        updated_at: closed || date,
        body: [
          impact ? `## Etki\n\n${impact}` : null,
          fix ? `## Fix\n\n${fix}` : null,
          next ? `## Next Action\n\n${next}` : null
        ].filter(Boolean).join("\n\n")
      },
      legacy_id: id
    });
  }
  return out;
}

// Top-level YAML files (identity, project, tech, feedback): rule/principles, not records.
// Bunlari normalize edilmis "note" olarak ingest etmiyoruz; audit'te referansi tutuyoruz.
export function listTopLevelYamlFiles(archivePath) {
  const root = join(archivePath, "1-project-brain");
  if (!existsSync(root)) return [];
  const files = ["identity.yaml","project.yaml","tech.yaml","feedback.yaml","deployment.yaml","entities.yaml","cowork-audit.yaml"];
  return files.filter(f => existsSync(join(root, f))).map(f => `1-project-brain/${f}`);
}
