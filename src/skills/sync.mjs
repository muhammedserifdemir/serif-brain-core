// Paket skill'lerini (skill/<ad>/) hedef projenin .claude/skills/ dizinine tasiyan
// TEK kaynak. Iki cagiran ayni kodu kullanir, iki ayri kopya YOK:
//   - init            → mode "missing": var olan dosya ASLA ezilmez
//   - skills update   → mode "sync":    icerigi farkli dosya guncellenir
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

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

// ── Kurulum manifesti ───────────────────────────────────────────────────────
// Manifest olmadan "paket yenilendi, projedeki eski" (BAYAT) ile "kullanici
// dosyayi elle degistirdi" (DUZENLENMIS) ayirt edilemez; ikisi de sadece
// "farkli" gorunur. O zaman --apply ya emegi siler ya da guncellemeyi hic
// yapamaz. Manifest, kurulum anindaki icerigin ozetini saklar; boylece uclu
// karsilastirma mumkun olur:
//     dosya == paket                      → same
//     dosya != paket, dosya == manifest   → stale  (dokunulmamis, GUVENLE guncellenir)
//     dosya != paket, dosya != manifest   → edited (YEREL EMEK, --force ister)
// Manifest yoksa/kayit yoksa DUZENLENMIS sayilir — bilinmeyen kokende
// varsayilan, kullanicinin emegini korumaktir.
export const MANIFEST_NAME = ".serif-brain-skills.json";

function hashFile(p) {
  try { return createHash("sha256").update(readFileSync(p)).digest("hex"); } catch { return null; }
}

export function readManifest(dstRoot) {
  try {
    const raw = JSON.parse(readFileSync(join(dstRoot, MANIFEST_NAME), "utf8"));
    return raw && typeof raw.installed === "object" ? raw.installed : {};
  } catch { return {}; }
}

function writeManifest(dstRoot, installed) {
  try {
    mkdirSync(dstRoot, { recursive: true });
    writeFileSync(join(dstRoot, MANIFEST_NAME),
      JSON.stringify({ schema: 1, tool: "serif-brain", installed }, null, 2) + "\n");
  } catch { /* manifest yazilamazsa akis bozulmaz — sadece koken izi kaybolur */ }
}

// Hedef projenin skill durumunu cikarir — hicbir sey YAZMAZ.
// Durumlar: missing | same | stale | edited
export function planSkillSync(projectRoot) {
  const dstRoot = skillsDirOf(projectRoot);
  const manifest = readManifest(dstRoot);
  const skills = [];
  for (const name of listPackageSkills()) {
    const srcDir = join(SKILLS_SRC, name);
    const files = walkFiles(srcDir).map(rel => {
      const key = `${name}/${rel}`;
      const src = join(srcDir, ...rel.split("/"));
      const dst = join(dstRoot, name, ...rel.split("/"));
      let status;
      if (!existsSync(dst)) status = "missing";
      else if (sameContent(src, dst)) status = "same";
      else status = manifest[key] && manifest[key] === hashFile(dst) ? "stale" : "edited";
      return { rel, label: key, src, dst, status };
    });
    skills.push({ name, files });
  }
  return { dstRoot, skills, has_manifest: Object.keys(manifest).length > 0 };
}

// Plani uygular.
//   mode "missing" (init)          → sadece eksikleri yazar; var olana ASLA dokunmaz.
//   mode "sync"    (skills update) → eksikleri + BAYAT olanlari yazar.
//                                    DUZENLENMIS dosya yalniz force ile ezilir.
// apply=false ise hicbir sey yazilmaz (dry-run); sayimlar yine dondurulur.
export function applySkillSync(plan, { mode = "missing", apply = true, force = false, log = () => {} } = {}) {
  const counts = { created: 0, updated: 0, overwritten: 0, kept: 0, unchanged: 0 };
  const installed = apply ? readManifest(plan.dstRoot) : null;

  const write = (file) => {
    if (!apply) return;
    mkdirSync(dirname(file.dst), { recursive: true });
    writeFileSync(file.dst, readFileSync(file.src));
    installed[file.label] = hashFile(file.src);
  };

  for (const skill of plan.skills) {
    for (const file of skill.files) {
      if (file.status === "missing") {
        write(file);
        counts.created++;
        log(`  + created: ${file.label}`);
      } else if (file.status === "stale" && mode === "sync") {
        write(file);
        counts.updated++;
        log(`  ~ updated: ${file.label}`);
      } else if (file.status === "edited" && mode === "sync" && force) {
        write(file);
        counts.overwritten++;
        log(`  ! EZILDI (yerel duzenleme): ${file.label}`);
      } else if (file.status === "edited" && mode === "sync") {
        counts.kept++;
        log(`  ⊘ korundu (yerel duzenleme, --force ister): ${file.label}`);
      } else if (file.status === "same") {
        counts.unchanged++;
        // Koken izi kendini onarir: icerik pakete BIREBIR esitse koken kesindir,
        // manifest'i olmayan eski kurulumlar da boylece bir kez calisinca
        // "bayat mi duzenlenmis mi" ayrimini kazanir.
        if (apply) installed[file.label] = hashFile(file.src);
        log(mode === "sync" ? `  = guncel: ${file.label}` : `  - skipped (exists): ${file.label}`);
      } else {
        // mode "missing": var olan dosya (stale/edited) korunur — init sozlesmesi
        counts.kept++;
        log(`  - skipped (exists): ${file.label}`);
      }
    }
  }

  if (apply) writeManifest(plan.dstRoot, installed);
  return counts;
}
