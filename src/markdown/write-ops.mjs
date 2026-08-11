// Hafizaya YAZMA islemlerinin tek kaynagi: obje olustur + obje kapat.
//
// NEDEN AYRI DOSYA: bu mantik cli/add.mjs ve cli/close.mjs icinde, console.error
// cagrilariyla ic ice yasiyordu. MCP'nin de yazabilmesi icin ikinci bir kopya
// yazmak gerekirdi — ve iki kopya, "CLI'da calisti ama MCP'de baska sey yazdi"
// sinifinda sessiz ayrisma demektir. Burasi CIKTI URETMEZ: sonucu dondurur,
// metni cagiran (CLI ya da MCP) bicimlendirir.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readObject, writeObject, makeId, objectPath } from "./object.mjs";
import { loadConfig } from "./schema.mjs";
import { locateObject, targetProject } from "./locate.mjs";

// writeObject → validateObject → getConfig() modul-duzeyi durumu okur; config
// yuklenmemisse ATAR. CLI bunu her komutta yapiyordu, MCP yapmiyordu: uzun-omurlu
// sunucuda `brain_close` PROSESIN ILK cagrisi ise yazma cokerdi. Yazma yolu kendi
// on kosulunu kendisi saglar — cagirana guvenmek, cagiranlardan biri unuttugunda
// sessizce degil GURULTULU ama YANLIS ZAMANDA patlamak demektir.
// DIKKAT: cagiran bize bir config NESNESI verse bile loadConfig cagrilmalidir —
// writeObject o nesneyi degil, modul-duzeyi _config'i okur. "Config parametresi
// verdim, yuklenmistir" varsayimi tam da bu yuzden yanlis.
function ensureConfig(brainRoot, config) {
  let loaded = null;
  try { loaded = loadConfig(brainRoot); } catch { /* config.yaml yok — writeObject zaten anlamli hata verir */ }
  return config || loaded;
}

// Baslik "is bitti" diyorsa 'decision' bayat bir aktif karar uretir.
export const DONE_TITLE_RE =
  /\b(KAPANDI|TAMAMLANDI|BITTI|BİTTİ|GECTI|GEÇTİ|UYGULANDI|DOGRULANDI|DOĞRULANDI|COZULDU|ÇÖZÜLDÜ)\b/i;

export const TYPE_DEFAULTS = {
  bug: {
    status: "open",
    priority: "medium",
    severity: "medium",
    body: `\n## Etki\n\n## Reproduce\n1. \n\n## Beklenen\n\n## Gozlemlenen\n\n## Hipotez / Analiz\n\n## Next Action\n`,
  },
  decision: {
    status: "active",
    priority: "medium",
    body: `\n## Baglam\n\n## Karar\n\n## Sonuclari (Consequences)\n- \n\n## Reddedilen Alternatifler\n- \n`,
  },
  // plan = yol haritasi / faz plani. plans/ altina yazilir, 'active' dogar.
  plan: {
    status: "active",
    priority: "high",
    body: `\n## Nerede duruyoruz\n\n## Fazlar\n### FAZ A —\n- Hedef:\n- Cikis olcutu:\n\n### FAZ B —\n- Hedef:\n- Cikis olcutu:\n\n## Elenen yollar (tekrar denenmesin)\n- \n`,
  },
  // record = yapilmis isin kaydi. 'done' DOGAR — kapatilmayi beklemez.
  record: {
    status: "done",
    priority: "low",
    body: `\n## Ne yapildi\n\n## Neden\n\n## Sonuc / Kanit\n- \n`,
  },
};

// --files verilmediyse calisma agacindaki degisen dosyalari doldur. Git yoksa
// sessizce bos dizi — brain git-bagimsiz calismali.
export function gitTouchedFiles(projectRoot, limit = 12) {
  const files = new Set();
  for (const cmd of ["diff --name-only HEAD", "diff --cached --name-only"]) {
    try {
      const out = execSync(`git -C "${projectRoot}" ${cmd}`, {
        encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
      });
      for (const f of out.split("\n").map((s) => s.trim()).filter(Boolean)) {
        if (f.startsWith(".serif-brain/")) continue;
        files.add(f);
      }
    } catch { /* git yok / repo degil / HEAD yok — yoksay */ }
  }
  return [...files].slice(0, limit);
}

/**
 * Obje olustur. HICBIR SEY yazdirmaz; { ok, ... } dondurur.
 * Hata durumlari: { ok:false, error, hint?, suggestId? }
 */
export function createObject({
  brainRoot, projectRoot, config,
  type, title, module, priority, severity, status, tags,
  files = null, projectId = null, id = null, force = false, now = new Date(),
}) {
  if (!type || !TYPE_DEFAULTS[type]) {
    return { ok: false, error: `bilinmeyen tip: ${type} (bug|decision|plan|record)` };
  }
  if (!title || !String(title).trim()) return { ok: false, error: "title zorunlu" };

  const cfg = ensureConfig(brainRoot, config);
  const project = targetProject(brainRoot, cfg, projectId);
  if (!project) return { ok: false, error: "hedef proje bulunamadi (config.projects bos)" };

  const def = TYPE_DEFAULTS[type];
  const mod = module || "unknown";
  const pri = priority || def.priority;
  const sev = severity || pri;
  const st = status || def.status;
  const tagList = Array.isArray(tags) ? tags : (typeof tags === "string" && tags ? tags.split(",").map(s => s.trim()) : []);

  const explicitFiles = Array.isArray(files) ? files : null;
  const autoFiles = explicitFiles ? [] : gitTouchedFiles(projectRoot);
  const fileList = explicitFiles || autoFiles;

  const objId = id || makeId(type, title, now);
  const targetPath = objectPath(brainRoot, project, type, objId);
  if (existsSync(targetPath) && !force) {
    let suffix = 2;
    let altId = `${objId}-${suffix}`;
    while (existsSync(objectPath(brainRoot, project, type, altId)) && suffix < 100) {
      suffix++;
      altId = `${objId}-${suffix}`;
    }
    return { ok: false, error: `ID zaten var: ${targetPath}`, suggestId: altId, existingPath: targetPath };
  }

  const nowIso = now.toISOString();
  const fm = {
    id: objId,
    type,
    project,
    module: mod,
    title,
    status: st,
    priority: pri,
    ...(type === "bug" ? { severity: sev, owner: "" } : {}),
    created_at: nowIso,
    updated_at: nowIso,
    source: { kind: "manual", path: "" },
    relations: { files: fileList, decisions: [], bugs: [], modules: Array.isArray(mod) ? mod : [mod] },
    tags: tagList,
    ...(type === "bug" ? { summary: title } : {}),
  };

  const result = writeObject(brainRoot, fm, `\n# ${title}\n${def.body}`);
  return {
    ok: true,
    id: objId,
    project,
    path: result.path,
    status: st,
    priority: pri,
    module: mod,
    autoFilled: !explicitFiles && autoFiles.length > 0 ? autoFiles.length : 0,
    warnings: result.validation.warnings,
    hint: type === "decision" && DONE_TITLE_RE.test(title)
      ? "baslik tamamlanma bildiriyor — 'record' bunu status:done olarak yazar (bayat 'aktif karar' uretmez)"
      : null,
  };
}

/**
 * Obje kapat (status → done + completed_at). HICBIR SEY yazdirmaz.
 * projectId verilmezse id'yi GERCEKTEN iceren proje bulunur.
 */
export function closeObject({
  brainRoot, id, projectId = null, commit = null, note = null, force = false, now = new Date(),
}) {
  ensureConfig(brainRoot, null);
  const loc = locateObject(brainRoot, id);
  if (!loc.type) return { ok: false, error: `id tanimsiz tipte: ${id} (bug-/decision-/plan- ile baslamali)` };

  let project = projectId;
  if (!project) {
    if (loc.matches.length === 1) project = loc.matches[0];
    else if (loc.matches.length === 0) {
      return { ok: false, error: `obje bulunamadi: ${id}`, projects: loc.projects };
    } else {
      return { ok: false, error: `id birden fazla projede var: ${loc.matches.join(", ")} — --project_id ekle`, matches: loc.matches };
    }
  }

  const targetPath = objectPath(brainRoot, project, loc.type, id);
  if (!existsSync(targetPath)) return { ok: false, error: `bulunamadi: ${targetPath}` };

  const { frontmatter: fm, body } = readObject(targetPath);
  const already = ["done", "rejected", "archived"].includes(fm.status);
  if (already && !force) return { ok: true, noop: true, id, project, status: fm.status };

  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const prevStatus = fm.status;
  fm.status = "done";
  fm.updated_at = nowIso;
  fm.completed_at = today;
  if (commit) fm.commit = commit;

  let newBody = body;
  if (note) {
    const section = [``, ``, `## Tamamlanma (${today})`, ``, note, ``];
    if (commit) section.push(`Commit: \`${commit}\``, ``);
    newBody = newBody.replace(/\s+$/, "") + section.join("\n");
  }

  const result = writeObject(brainRoot, fm, newBody);
  return {
    ok: true, noop: false, id, project, path: result.path,
    prevStatus, status: "done", completed_at: today,
    commit: commit || null, noteAppended: !!note,
    warnings: result.validation.warnings,
  };
}
