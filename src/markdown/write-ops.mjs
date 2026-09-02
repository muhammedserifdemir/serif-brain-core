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
//
// `--relative` SART: git varsayilan olarak REPO KOKUNE gore yol dondurur.
// Brain bir alt-dizinde ise (monorepo: serif-platform/apps/animatorx/.serif-brain)
// kayitlara "apps/animatorx/packages/x.ts" yazilir, oysa o brain'in proje koku
// zaten apps/animatorx'tir → dosya HIC bulunamaz.
// Olcum (2026-08-12): animatorx brain'inde 237 kirik dosya referansi; hicbiri
// silinmis dosya degildi, hepsi bu onek yuzunden. 177 kaydin buyuk kismi
// hafizada duruyordu ama kapida GORUNMUYORDU.
/**
 * Calisma agaci TEMIZSE son commit'lerdeki dosyalari aday olarak dondurur.
 *
 * NEDEN: `add` dosya listesini yalniz COMMIT EDILMEMIS degisikliklerden
 * dolduruyordu. Is bitip commit edildikten SONRA kayit acan kisi (yaygin
 * durum) bos liste aliyordu. Olcum: 1.179 kaydin %33'u yalniz modul,
 * %12'si hicbiri; hafiza kapsami %5,8 ve kapi dosyalarin %78'inde susuyor.
 * Kapsamin dusuk olmasinin tek sebebi bu degil ama en kolay duzeltilebilir olani.
 *
 * Aday OTOMATIK BAGLANMAZ — kullaniciya gosterilir. Yanlis dosya baglamak
 * hafizaya gurultu sokar ve olculen 5,6x sinyal/gurultu oranini dusurur.
 */
/**
 * Bir govde "bos sablon" mu? Baslik, ## basliklari, bos madde imleri ("- "),
 * bos numarali madde ("1. ") ve bos satirlar disinda tek bir icerik satiri
 * yoksa bostur. `close --note` ile eklenen "## Tamamlanma" notu icerik sayilir.
 * Olcum araci burada TEK yerde: doctor, add ve raporlar ayni tanimi kullanir
 * (2026-09-02: EduX'te 24 kayit basliktan ibaretti, hicbir arac saymiyordu).
 */
export function govdesizMi(body) {
  if (!body) return true;
  for (const raw of String(body).split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith("#")) continue;
    if (/^[-*]\s*$/.test(l)) continue;
    if (/^[-*]\s+[^:]{1,40}:\s*$/.test(l)) continue; // "- Hedef:" — etiket var, deger yok
    if (/^\d+\.\s*$/.test(l)) continue;
    return false;
  }
  return true;
}

export function gitRecentFiles(projectRoot, { days = 3, limit = 10 } = {}) {
  try {
    const out = execSync(
      `git -C "${projectRoot}" log --since="${days} days ago" --relative --name-only --pretty=format: --diff-filter=d`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 8 * 1024 * 1024 },
    );
    const sayac = new Map();
    for (const f of out.split("\n").map((s) => s.trim()).filter(Boolean)) {
      if (f.startsWith(".serif-brain/")) continue;
      sayac.set(f, (sayac.get(f) || 0) + 1);
    }
    return [...sayac.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([f]) => f);
  } catch { return []; }
}

export function gitTouchedFiles(projectRoot, limit = 12) {
  const files = new Set();
  for (const cmd of ["diff --relative --name-only HEAD", "diff --cached --relative --name-only"]) {
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
  body = null,
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

  // GOVDE: `body` verilmezse tipin BOS sablonu yazilir — eski davranis birebir
  // korunur. Verilirse sablon yerine gecer.
  //
  // NEDEN BU PARAMETRE EKLENDI: createObject gövde parametresi KABUL ETMIYORDU;
  // her kayit statik bos sablonla doguyordu ve icerik ancak dosya elle acilarak
  // yazilabiliyordu. Kayit acan (CLI ya da ajan) o anda BILGIYE SAHIPTI ama
  // yazacak yeri yoktu. Olcum (2026-08-15, serif-platform): decisions/ altindaki
  // 285 kaydin 80'i (%28) gövdesiz sablon. Kirilim mekanizmayi dogruluyor —
  // bkz. closeObject'teki `already` notu.
  const govdeVar = !!(body && String(body).trim());
  const govde = govdeVar
    ? `\n# ${title}\n\n${String(body).trim()}\n`
    : `\n# ${title}\n${def.body}`;

  const result = writeObject(brainRoot, fm, govde);
  return {
    ok: true,
    id: objId,
    project,
    path: result.path,
    status: st,
    priority: pri,
    module: mod,
    autoFilled: !explicitFiles && autoFiles.length > 0 ? autoFiles.length : 0,
    // Dosyasiz kayit UYARILIR ama ENGELLENMEZ: hizli not almayi zorlastirmak,
    // insanlarin kaydetmeyi tamamen birakmasina yol acar. Uyari eyleme
    // donusen bir komutla birlikte verilir.
    dosyasiz: fileList.length === 0,
    // Gövdesiz kayit da UYARILIR ama ENGELLENMEZ — dosyasiz kayitla ayni gerekce
    // (yukaridaki nota bak). Uyari, `record` icin daha agirdir: record 'done'
    // dogar, yani hicbir is akisinda tekrar onunue gelmez.
    govdesiz: !govdeVar,
    adaylar: fileList.length === 0 ? gitRecentFiles(projectRoot) : [],
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
  // `record` TYPE_DEFAULTS geregi status:done DOGAR. Bu dal onu ebediyen noop'a
  // dusuruyordu ve createObject de gövde yazamadigi icin (bkz. oradaki not)
  // record'un icerik alabilecegi TEK kod yolu burasiydi — kapaliydi.
  // Olcum (2026-08-15, serif-platform): record'larin %61'i (61/100) bos sablon,
  // decision'larin %10'u (19/183). 6 katlik fark tesadufi degil: decision 'active'
  // dogup `close --note` ile dolabiliyor, record dolamiyordu.
  // NOT VERILMISSE noop yapmayiz: durumu degistirmeden notu ekleriz.
  if (already && !force && !note) return { ok: true, noop: true, id, project, status: fm.status };

  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const prevStatus = fm.status;
  fm.status = "done";
  fm.updated_at = nowIso;
  // Zaten kapali bir kayda not eklerken ORIJINAL kapanma tarihi korunur —
  // yoksa her not ekleme, isin bugun bittigini soyleyen yanlis bir tarih yazar.
  if (!fm.completed_at) fm.completed_at = today;
  if (commit) fm.commit = commit;

  let newBody = body;
  if (note) {
    // Kapali kayda eklenen not bir "tamamlanma" degil, sonradan gelen icerik.
    const baslik = already ? `## Ek Not (${today})` : `## Tamamlanma (${today})`;
    const section = [``, ``, baslik, ``, note, ``];
    if (commit) section.push(`Commit: \`${commit}\``, ``);
    newBody = newBody.replace(/\s+$/, "") + section.join("\n");
  }

  const result = writeObject(brainRoot, fm, newBody);
  return {
    ok: true, noop: false, id, project, path: result.path,
    prevStatus, status: "done", completed_at: fm.completed_at,
    commit: commit || null, noteAppended: !!note,
    // Cagirana "bu bir kapatma degil, kapali kayda icerik ekleme" der.
    appendedToClosed: already && !!note,
    warnings: result.validation.warnings,
  };
}
