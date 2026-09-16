// Obje id'sinden PROJEYI bul.
//
// NEDEN VAR: `close <id>` coklu-proje kurulumunda `--project_id` istiyordu —
// hatta objeyi ICERMEYEN, tamamen BOS bir proje dizini yuzunden bile. Oysa id
// benzersizdir ve disk zaten cevabi biliyor. Cagiran, arac'in elindeki bilgiyi
// disaridan tekrar vermeye zorlaniyordu; bir ajan icin bu, cikmaz sokaktir
// (once hata alir, sonra proje adini kesfetmeye calisir).
//
// Bu, `rank.mjs`'teki hatanin ayni sinifi: aday kumesi iki gorunuyor ama
// yalnizca biri gercek — karar verilebilir durumda karar verilmiyor.
import { existsSync } from "node:fs";
import { listProjects, objectPath, listObjects, readObject } from "./object.mjs";

/**
 * Dosya adi ≠ frontmatter id olan kaydi bul. Id'nin KAYNAGI frontmatter'dir;
 * dosya adi yalniz hizli yoldur. 2026-09-16 (mevzuat-ai): elle adlandirilmis
 * 2 karar dosyasi `close` ile bulunamadi, kayit diskte dururken "obje
 * bulunamadi" dendi. Tip dizini kucuktur (yuzler), tarama ucuzdur ve yalniz
 * hizli yol bos dondugunde calisir.
 */
export function findByFrontmatterId(brainRoot, project, type, id) {
  for (const file of listObjects(brainRoot, project, type)) {
    try {
      if (readObject(file).frontmatter?.id === id) return file;
    } catch { /* bozuk dosya: atla */ }
  }
  return null;
}

/** Once dosya adi, yoksa frontmatter id: kaydin gercek yolu ya da null. */
export function resolveObjectPath(brainRoot, project, type, id) {
  const hizli = objectPath(brainRoot, project, type, id);
  if (existsSync(hizli)) return hizli;
  return findByFrontmatterId(brainRoot, project, type, id);
}

const TYPE_OF_ID = [
  ["bug-", "bug"],
  ["decision-", "decision"],
  ["plan-", "plan"],
  // record = bitmis is kaydi; kendi dizini yok, decisions/ altinda yasar ama
  // id'si "record-" ile baslar. Burada olmazsa `close record-...` "id tanimsiz
  // tipte" der — objenin kendisi diskte dururken.
  ["record-", "record"],
  ["note-", "note"],
  ["session-", "session"],
];

/** Id onekinden obje tipini cikar (bilinmiyorsa null). */
export function typeOfId(id) {
  const s = String(id || "");
  for (const [prefix, type] of TYPE_OF_ID) if (s.startsWith(prefix)) return type;
  return null;
}

/**
 * Id'yi GERCEKTEN iceren projeleri bulur — proje dizininin varligina degil,
 * OBJE DOSYASININ varligina bakar.
 *
 * @returns {{ type, matches: string[], project: string|null, path: string|null, projects: string[] }}
 *   matches.length === 1 → project/path dolu (cagiran soru sormadan devam eder)
 *   matches.length > 1   → gercek belirsizlik; cagiran --project_id sormali
 *   matches.length === 0 → obje yok
 */
export function locateObject(brainRoot, id, { type = null } = {}) {
  const t = type || typeOfId(id);
  const projects = listProjects(brainRoot);
  if (!t) return { type: null, matches: [], project: null, path: null, projects };

  const matches = [];
  const paths = {};
  for (const p of projects) {
    const yol = resolveObjectPath(brainRoot, p, t, id);
    if (yol) { matches.push(p); paths[p] = yol; }
  }
  return {
    type: t,
    matches,
    project: matches.length === 1 ? matches[0] : null,
    path: matches.length === 1 ? paths[matches[0]] : null,
    projects,
  };
}

/**
 * Yazma islemleri icin hedef proje: acik flag > tek AKTIF proje > tek proje.
 * `add` icin — obje henuz yok, dolayisiyla locateObject kullanilamaz.
 */
export function targetProject(brainRoot, config, explicit = null) {
  if (explicit) return explicit;
  const configProjects = config?.projects || [];
  const active = configProjects.filter((p) => p.active);
  if (active.length === 1) return active[0].id;
  const disk = listProjects(brainRoot);
  if (disk.length === 1) return disk[0];
  return active[0]?.id || configProjects[0]?.id || disk[0] || null;
}
