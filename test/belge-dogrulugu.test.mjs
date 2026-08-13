// BELGE DOGRULUGU — README'nin YALAN SOYLEMESINI test kirmizi yapar.
//
// NEDEN BU DOSYA VAR
// Bu projenin tezi "tavsiye atlanabilir, kapi atlanamaz". Ama kendi
// belgelerimiz tam tersini yapiyordu: README "337 test" diyordu, gercek 355'ti;
// LinkedIn taslagi "291 test" diyordu. Ucu de bir zamanlar DOGRUYDU ve sessizce
// bayatladi — cunku sayiyi guncellemeyi hatirlatan hicbir mekanizma yoktu.
//
// Bir aracin en pahali hatasi kendi hakkinda yanlis sey soylemesidir: kullanici
// o sayinin ustune karar verir. Bu yuzden belgedeki her SAYISAL IDDIA ve her
// KOPYALA-YAPISTIR ornegi buradan gecer. Sayi degisirse test kirmizi olur;
// metni koruyup sayiyi zorlamak imkansizlasir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const KOK = new URL("..", import.meta.url).pathname;
const oku = (p) => readFileSync(join(KOK, p), "utf8");

/**
 * Testleri CALISTIRMADAN say (burasi zaten test icinde; kendini cagiramaz).
 * `node --test` her `test("...")` cagrisini bir test sayar — asagidaki sayim
 * `npm test` ciktisiyla birebir tutmali. Tutmuyorsa once BU fonksiyonu duzelt:
 * yanlis sayan bir denetci, denetlemedigi belgeden daha kotudur.
 */
function gercekTestSayisi() {
  let n = 0;
  for (const dosya of readdirSync(join(KOK, "test"))) {
    if (!dosya.endsWith(".test.mjs")) continue;
    n += (oku(join("test", dosya)).match(/^test\(/gm) || []).length;
  }
  return n;
}

test("belge: 'N test' iddiasi GERCEK test sayisiyla ayni", () => {
  const gercek = gercekTestSayisi();
  // Once sayacin kendisini dogrula: `npm test` ciktisiyla ayni olmali.
  assert.ok(gercek > 300, `sayac bozuk gorunuyor: ${gercek}`);

  const hedefler = [
    ["README.md", /(\d[\d.,]*)\s*tests\b/i],
    ["README.tr.md", /(\d[\d.,]*)\s*test\b/i],
    ["marketing/linkedin-post.md", /(\d[\d.,]*)\s*test\b/i],
  ];
  for (const [dosya, desen] of hedefler) {
    // Bir belge kasten YANLIS bir sayiyi alintilayabilir ("onceki taslak 229
    // diyordu ve iddia gercegi anlatmiyordu") — bu bir hata degil, dersin ta
    // kendisidir. Ayirt etmenin tek durust yolu isaretlemektir; sessizce ilk
    // eslesmeyi almak, gercek bir bayat sayiyi kacirmak demekti.
    const satirlar = oku(dosya).split("\n").filter((s) => !s.includes("belge-dogrulugu:yoksay"));
    const m = satirlar.join("\n").match(desen);
    assert.ok(m, `${dosya}: test sayisi iddiasi bulunamadi (desen degistiyse burayi guncelle)`);
    const iddia = Number(m[1].replace(/[.,]/g, ""));
    assert.equal(iddia, gercek,
      `${dosya} "${m[0]}" diyor ama gercek ${gercek}. Sayiyi duzelt — metni koruyup sayiyi zorlama.`);
  }
});

test("belge: kopyala-yapistir orneginde YAZARIN MAKINESI olamaz", () => {
  // `docs/MCP.md` bir zamanlar `/Users/<yazar>/Desktop/...` mutlak yolunu
  // ornek olarak veriyordu: kopyalayan herkeste bozuk config olusuyordu.
  // Ornekler ya goreli olmali ya da acikca yer tutucu (<...>) tasimali.
  const desen = /(\/Users\/[a-z0-9._-]+\/|C:\\Users\\[A-Za-z0-9._-]+\\)/g;
  const beyazListe = new Set(["docs/WINDOWS.md"]); // Windows yol BICIMINI anlatiyor
  const kirli = [];
  for (const dosya of ["README.md", "README.tr.md", "CONTRIBUTING.md", ...readdirSync(join(KOK, "docs")).map((d) => join("docs", d))]) {
    if (!dosya.endsWith(".md") || beyazListe.has(dosya)) continue;
    for (const m of oku(dosya).matchAll(desen)) {
      // `<kullanici>` gibi acik yer tutucular serbest.
      if (/[<>]/.test(m[0])) continue;
      kirli.push(`${dosya}: ${m[0]}`);
    }
  }
  assert.deepEqual(kirli, [], `belgede yazarin mutlak yolu kalmis:\n  ${kirli.join("\n  ")}`);
});

test("belge: kullaniciya GORUNEN ciktida ic gelistirme jargonu olamaz", () => {
  // "Faz 5 apply onayi bekliyor" cumlesi bu depoyu bilmeyen icin anlamsizdir.
  // Ic plan numarasi bizim not defterimizde kalir, kullanicinin terminalinde
  // degil. (Yorum satirlarinda serbest — orasi kullaniciya gorunmez.)
  const desen = /["'`][^"'`\n]*\bFaz\s*\d+[^"'`\n]*["'`]/g;
  const kirli = [];
  const gez = (dizin) => {
    for (const e of readdirSync(join(KOK, dizin), { withFileTypes: true })) {
      const rel = join(dizin, e.name);
      if (e.isDirectory()) { gez(rel); continue; }
      if (!e.name.endsWith(".mjs")) continue;
      for (const m of oku(rel).matchAll(desen)) kirli.push(`${rel}: ${m[0].slice(0, 70)}`);
    }
  };
  for (const d of ["src", "bin", "hooks"]) gez(d);
  assert.deepEqual(kirli, [], `kullaniciya gorunen metinde ic faz numarasi kalmis:\n  ${kirli.join("\n  ")}`);
});
