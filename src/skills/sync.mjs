// Paket skill'lerini (skill/<ad>/) hedef projenin .claude/skills/ dizinine tasiyan
// TEK kaynak. Iki cagiran ayni kodu kullanir, iki ayri kopya YOK:
//   - init            → mode "missing": var olan dosya ASLA ezilmez
//   - skills update   → mode "sync":    icerigi farkli dosya guncellenir
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SKILLS_SRC = resolve(HERE, "../../skill");

export function skillsDirOf(projectRoot) {
  return join(projectRoot, ".claude", "skills");
}

export function listPackageSkills() {
  if (!existsSync(SKILLS_SRC)) return [];
  return readdirSync(SKILLS_SRC, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();
}

// Bir skill klasorunun tum dosyalarini goreli yol olarak dokumler (alt dizinler dahil)
function walkFiles(root, prefix = "", acc = []) {
  const entries = readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walkFiles(join(root, entry.name), rel, acc);
    else acc.push(rel);
  }
  return acc;
}

function sameContent(a, b) {
  try { return readFileSync(a).equals(readFileSync(b)); } catch { return false; }
}

// Hedef projenin skill durumunu cikarir — hicbir sey YAZMAZ.
// Her dosya uc durumdan biri: missing (yok) | same (ayni) | differs (bayat/duzenlenmis)
export function planSkillSync(projectRoot) {
  const dstRoot = skillsDirOf(projectRoot);
  const skills = [];
  for (const name of listPackageSkills()) {
    const srcDir = join(SKILLS_SRC, name);
    const files = walkFiles(srcDir).map(rel => {
      const src = join(srcDir, ...rel.split("/"));
      const dst = join(dstRoot, name, ...rel.split("/"));
      const status = !existsSync(dst) ? "missing" : sameContent(src, dst) ? "same" : "differs";
      return { rel, label: `${name}/${rel}`, src, dst, status };
    });
    skills.push({ name, files });
  }
  return { dstRoot, skills };
}

// Plani uygular. mode "missing" → sadece eksikleri yazar (init sozlesmesi).
// mode "sync" → eksikleri yazar VE farkli olanlari gunceller.
// apply=false ise hicbir sey yazilmaz (dry-run); sayimlar yine dondurulur.
export function applySkillSync(plan, { mode = "missing", apply = true, log = () => {} } = {}) {
  const counts = { created: 0, updated: 0, unchanged: 0, kept: 0 };
  for (const skill of plan.skills) {
    for (const file of skill.files) {
      if (file.status === "missing") {
        if (apply) {
          mkdirSync(dirname(file.dst), { recursive: true });
          writeFileSync(file.dst, readFileSync(file.src));
        }
        counts.created++;
        log(`  + created: ${file.label}`);
      } else if (file.status === "differs" && mode === "sync") {
        if (apply) {
          mkdirSync(dirname(file.dst), { recursive: true });
          writeFileSync(file.dst, readFileSync(file.src));
        }
        counts.updated++;
        log(`  ~ updated: ${file.label}`);
      } else if (file.status === "differs") {
        // sadece mode "missing": var olan farkli dosya korunur (init sozlesmesi)
        counts.kept++;
        log(`  - skipped (exists): ${file.label}`);
      } else {
        counts.unchanged++;
        // "same" durumu: init icin "zaten var", sync icin "zaten guncel"
        log(mode === "sync" ? `  = guncel: ${file.label}` : `  - skipped (exists): ${file.label}`);
      }
    }
  }
  return counts;
}
