// "Hangi kopyayi calistiriyorum ve nasil guncellerim?"
//
// NEDEN VAR (gercek olay, 2026-08-12):
// Sahibi Mac'te `--version` calistirip 1.1.0 gordu ve "guncelleme otomatik
// gidiyor" sonucuna vardi. Oysa Mac'te CLI KAYNAK DIZINDEN calisiyor — o sayi
// birkac saat once package.json'a yazilan sayinin ta kendisiydi. Windows'taki
// stajyerin makinesinde ise `npm i -g git+...` ile alinmis AYRI bir kopya var
// ve o kopya kuruldugu gunden beri hic degismedi (iki ay, 41 commit geride).
//
// Kritik nokta: eski surumu calistiran kisi HICBIR uyari gormuyordu. Arac
// kendi eskiligini bilmiyordu; ekraninda her sey normal gorunuyordu. Windows'ta
// modul eslemesi tamamen bozuk bir surum sessizce calisiyor olabilirdi.
//
// AG YOK, BAGIMLILIK YOK: uzak sunucuya sorup "yeni surum var mi" DEMIYORUZ.
// Yalnizca "hangi kopyayi calistiriyorsun ve bu kopya nasil tazelenir" diyoruz.
// Bunu bilmek, kullanicinin yanlis kopyaya bakmasini engellemeye yeter.
import { existsSync, realpathSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

export const GUNCELLEME_KOMUTU =
  "npm i -g git+https://github.com/muhammedserifdemir/serif-brain-core.git";

function gitBilgisi(kok) {
  const calistir = (...a) => {
    try {
      return execFileSync("git", ["-C", kok, ...a], {
        encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000,
      }).trim();
    } catch { return null; }
  };
  const commit = calistir("rev-parse", "--short", "HEAD");
  if (!commit) return null;
  const dal = calistir("rev-parse", "--abbrev-ref", "HEAD");
  const tarih = calistir("log", "-1", "--format=%ad", "--date=short");
  const kirli = calistir("status", "--porcelain");
  // Uzakla fark: FETCH YAPMAZ (ag yok). Yalniz YEREL olarak bilinen durumu okur;
  // bu yuzden "son fetch'e gore" diye etiketlenir — yanlis guven uretmesin.
  let onde = null, geride = null;
  const sayim = calistir("rev-list", "--left-right", "--count", "HEAD...@{upstream}");
  if (sayim) {
    const [a, b] = sayim.split(/\s+/).map(Number);
    if (Number.isFinite(a) && Number.isFinite(b)) { onde = a; geride = b; }
  }
  return { commit, dal, tarih, kirli: !!kirli, onde, geride };
}

/**
 * Calisan kopyanin turunu ve tazeleme yolunu cikarir.
 * @param {string} binYolu bin/serif-brain.mjs'in yolu (import.meta.url'den)
 */
export function kurulumBilgisi(binYolu) {
  let gercek = binYolu;
  try { gercek = realpathSync(binYolu); } catch { /* baglanti cozulemedi */ }
  const paketKok = resolve(dirname(gercek), "..");

  // npm global kurulumu mu? (yol icinde node_modules gecer)
  const globalMi = gercek.split(sep).includes("node_modules");

  // Kaynak deposu mu? (paket kokunde .git var)
  const gitVar = existsSync(join(paketKok, ".git"));
  const git = gitVar ? gitBilgisi(paketKok) : null;

  return {
    yol: paketKok,
    tur: globalMi ? "global" : gitVar ? "kaynak" : "bilinmiyor",
    git,
    guncellemeKomutu: GUNCELLEME_KOMUTU,
  };
}

/** Insan okunur satirlar. */
export function kurulumSatirlari(bilgi, { detayli = false } = {}) {
  const L = [];
  if (bilgi.tur === "kaynak") {
    L.push(`  Kaynak     : ${bilgi.yol}  (git deposu — DUZENLEDIGIN dosyalar)`);
    if (bilgi.git) {
      const d = [`${bilgi.git.dal}@${bilgi.git.commit}`, bilgi.git.tarih].filter(Boolean).join(" · ");
      L.push(`  Surum kaynagi: ${d}${bilgi.git.kirli ? " · calisma agaci KIRLI" : ""}`);
      if (bilgi.git.geride) L.push(`  ⚠ Uzaktan ${bilgi.git.geride} commit GERIDE (son fetch'e gore) — git pull`);
      if (bilgi.git.onde) L.push(`  · Uzaktan ${bilgi.git.onde} commit ONDE — git push`);
    }
    L.push(`  NOT: burada gordugun surum, BASKA makinelerdeki kurulumlari`);
    L.push(`       ETKILEMEZ. Onlar ayri kopyalardir ve kendiliginden guncellenmez.`);
  } else if (bilgi.tur === "global") {
    L.push(`  Kurulum    : ${bilgi.yol}  (npm global — git'ten alinmis KOPYA)`);
    L.push(`  Bu kopya kendiliginden GUNCELLENMEZ. Tazelemek icin:`);
    L.push(`    ${bilgi.guncellemeKomutu}`);
  } else {
    L.push(`  Kurulum    : ${bilgi.yol}`);
    L.push(`  Tazelemek icin: ${bilgi.guncellemeKomutu}`);
  }
  if (detayli && bilgi.tur !== "global") {
    L.push(`  Baskalarina dagitim: ${bilgi.guncellemeKomutu}`);
  }
  return L;
}
