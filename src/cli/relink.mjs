// serif-brain relink [--apply] [--json]
//
// Kayitlarin `relations.files` girdileri, dosya TASINDIGINDA/ADI DEGISTIGINDE
// sessizce kopar. Olcum (20 gercek brain, 2026-08-12): 82 kirik dosya
// referansi, 9 kaydin dosyalarinin TAMAMI kopmus.
//
// Kopuk referans yalnizca "olu baglanti" degildir: kapinin o dosyada SUSMASI
// demektir. Yani hafiza duruyor, ama tam da ihtiyac aninda gorunmuyor —
// olcumdeki %78 sessizligin bir parcasi budur.
//
// COZUM git'in kendisinde: yeniden adlandirmalari git zaten kaydediyor.
// Tahmin YOK — yalnizca git'in R (rename) kayitlari kullanilir. Benzer isimli
// dosyayi "herhalde budur" diye baglamak hafizaya YANLIS baglanti sokar ve
// olculen 5,6x sinyal/gurultu oranini bozar.
import { resolve, join, relative, isAbsolute } from "node:path";
import { existsSync, realpathSync } from "node:fs";
import { execSync } from "node:child_process";
import { loadConfig } from "../markdown/schema.mjs";
import { listAllObjects, listProjects, writeObject, readObject } from "../markdown/object.mjs";
import { posixYol } from "../util/yol.mjs";

/**
 * git gecmisindeki yeniden adlandirma zinciri: eskiYol → enSonYol.
 * Zincir takip edilir (a→b→c ise a'nin karsiligi c'dir).
 */
export function renameHaritasi(projectRoot, { days = 3650 } = {}) {
  let ham = "";
  try {
    ham = execSync(
      `git -C "${projectRoot}" log --since="${days} days ago" --diff-filter=R --name-status --pretty=format:`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 },
    );
  } catch { return new Map(); }

  // git log EN YENIDEN eskiye dogru yazar; zinciri dogru kurmak icin ters cevir.
  const ciftler = [];
  for (const satir of ham.split("\n")) {
    const p = satir.split("\t");
    if (p.length >= 3 && p[0].startsWith("R")) ciftler.push([posixYol(p[1]), posixYol(p[2])]);
  }
  ciftler.reverse();

  const harita = new Map();
  for (const [eski, yeni] of ciftler) {
    // Daha once bu 'eski'ye tasinmis olanlar da yeni hedefe kaysin (zincir).
    for (const [k, v] of harita) if (v === eski) harita.set(k, yeni);
    harita.set(eski, yeni);
  }
  return harita;
}

/**
 * ONEK UYUSMAZLIGI: brain bir alt-dizindeyse (monorepo), git repo koküne gore
 * yol dondurdugu icin kayitlara fazladan bir onek yazilmis olabilir
 * ("apps/animatorx/packages/x.ts" — oysa proje koku zaten apps/animatorx).
 * Bu onek atilinca dosya bulunuyorsa, kirik referans aslinda TASINMA degil
 * TABAN HATASIDIR ve guvenle onarilabilir.
 */
/** realpath — Windows 8.3 kisa adini da acar; .native yoksa duz surume duser. */
function gercekYol(p) {
  try { return realpathSync.native(p); } catch { return realpathSync(p); }
}

export function onekDuzeltmesi(projectRoot) {
  try {
    const gitKok = execSync(`git -C "${projectRoot}" rev-parse --show-toplevel`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

    // realpath SART: macOS'ta /tmp ve /var birer SEMBOLIK BAGDIR ve
    // `git rev-parse` GERCEK yolu (/private/var/...) dondurur; projectRoot ise
    // bagli yol olabilir. Dize-degistirmeyle onek cikarmak bu durumda COP
    // uretir ("var/folders/.../") ve yanlis bir kirpma onerebilirdi —
    // hafizayi onarmak yerine bozardi. Test yakaladi.
    // .native SART (Windows): git `--show-toplevel` UZUN adi dondurur
    // ("C:/Users/runneradmin/..."), oysa os.tmpdir() ve cogu ortam degiskeni
    // 8.3 KISA adi tasir ("C:\Users\RUNNER~1\..."). JS realpath 8.3'u
    // acmaz; iki yol ayni klasoru gosterdigi halde farkli dize olur, bu da
    // relative()'i ".." ile baslatir ve fonksiyon "onek yok" (null) der.
    // .native GetFinalPathNameByHandle kullanir: kisa ad, buyuk/kucuk harf ve
    // ayrac farklarini tek bicime indirger.
    const g = gercekYol(gitKok);
    const p = gercekYol(projectRoot);
    const rel = posixYol(relative(g, p));
    // Proje git kokunun ALTINDA degilse (".." ile baslar) ya da ayni ise onek yok.
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
    return rel + "/";   // ornek: "apps/animatorx/"
  } catch { return null; }
}

/** Hicbir sey yazmaz: kirik referanslari ve varsa karsiliklarini cikarir. */
export function planRelink(projectRoot, brainRoot) {
  const harita = renameHaritasi(projectRoot);
  const onek = onekDuzeltmesi(projectRoot);
  const objeler = [];
  for (const p of listProjects(brainRoot)) {
    for (const o of listAllObjects(brainRoot, p)) {
      if (o.error) continue;
      const fm = o.frontmatter || {};
      const dosyalar = fm.relations?.files || [];
      if (!dosyalar.length) continue;

      const degisim = [];
      let kalanKirik = 0;
      for (const f of dosyalar) {
        if (existsSync(join(projectRoot, f))) continue;
        const yeni = harita.get(posixYol(f));
        if (yeni && existsSync(join(projectRoot, yeni))) { degisim.push([f, yeni]); continue; }
        // Taban hatasi mi? (monorepo onegi)
        if (onek && posixYol(f).startsWith(onek)) {
          const kirpilmis = posixYol(f).slice(onek.length);
          if (existsSync(join(projectRoot, kirpilmis))) { degisim.push([f, kirpilmis]); continue; }
        }
        kalanKirik++;
      }
      if (degisim.length || kalanKirik) {
        objeler.push({ id: fm.id, path: o.file_path, degisim, kalanKirik, toplam: dosyalar.length });
      }
    }
  }
  return {
    onek,
    renameSayisi: harita.size,
    onarilabilir: objeler.filter((o) => o.degisim.length).length,
    kalanKirik: objeler.reduce((a, o) => a + o.kalanKirik, 0),
    objeler,
  };
}

export async function relinkCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  loadConfig(brainRoot);

  const plan = planRelink(projectRoot, brainRoot);
  const apply = !!args.flags.apply;

  if (args.flags.json) {
    console.log(JSON.stringify({ ...plan, apply }, null, 2));
    if (!apply) return 0;
  } else {
    console.log(`[serif-brain relink] ${plan.renameSayisi} yeniden adlandirma git gecmisinde bulundu`);
    if (plan.onek) console.log(`  Bu brain repo icinde alt-dizinde: "${plan.onek}" oneki taban hatasi olarak kontrol ediliyor`);
    console.log(`  Onarilabilir kayit : ${plan.onarilabilir}`);
    console.log(`  Onarilamayan referans: ${plan.kalanKirik} (dosya silinmis ya da git rename olarak gormemis)`);
    console.log(``);
    for (const o of plan.objeler.filter((x) => x.degisim.length).slice(0, 20)) {
      console.log(`  ${o.id}`);
      for (const [e, y] of o.degisim) console.log(`    ${e}  →  ${y}`);
    }
    if (!plan.onarilabilir) console.log(`  (onarilacak bir sey yok)`);
  }

  if (!apply) {
    if (plan.onarilabilir) console.log(`\n  DRY-RUN — yazilmadi. Uygulamak icin: serif-brain relink --apply`);
    return 0;
  }

  let yazilan = 0;
  for (const o of plan.objeler) {
    if (!o.degisim.length) continue;
    const { frontmatter: fm, body } = readObject(o.path);
    const esleme = new Map(o.degisim);
    fm.relations.files = (fm.relations.files || []).map((f) => esleme.get(f) || f);
    fm.updated_at = new Date().toISOString();
    writeObject(brainRoot, fm, body);
    yazilan++;
  }
  console.log(`\n  ✓ ${yazilan} kayit onarildi. Sonraki: serif-brain rebuild-indexes`);
  return 0;
}
