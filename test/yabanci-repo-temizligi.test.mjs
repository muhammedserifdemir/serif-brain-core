// YABANCI REPO TEMIZLIGI — bu arac kullanicinin reposuna DOSYA YAZAR.
//
// NEDEN BU DOSYA VAR
// `serif-brain init` yabancinin projesine `.claude/skills/` ve
// `.serif-brain/indexes/` yazar. Bu dosyalar pakette hazir gelir — ve paket
// yazarinin KENDI urununden ornekler tasiyordu:
//
//   templates/object-templates/bug.md → "project: serif-platform"
//                                       "module: testx  # contentx | presentx | ..."
//   skill/serif-brain-core/SKILL.md   → "PresentX seed inconsistency"
//
// Yani araci kuran bir yabancinin kendi deposunda, hic duymadigi bir urunun
// modul mimarisi belirip git gecmisine giriyordu. Bu iki yonlu zarar: kullanici
// anlamsiz ornek okur, paket sahibi ic mimarisini sizdirir.
//
// KAPSAM BILEREK DAR: README/CHANGELOG/docs gercek projelerde yapilan OLCUMLERI
// anlatir (avatarx'te 383 yanlis alarm gibi) — orasi kanittir, sansurlenmez ve
// zaten yabancinin deposuna kopyalanmaz. Bu kapi yalnizca KOPYALANAN dosyalari
// ve calisma-anı VARSAYILANLARINI korur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const KOK = new URL("..", import.meta.url).pathname;

// Paket sahibinin OZEL urun/proje/musteri adlari. Yeni bir urun cikarsa buraya
// eklenir — liste, yabancinin deposunda gormemesi gereken her seyi tarif eder.
const OZEL_ADLAR = [
  "serif-platform", "serifx", "seriftech",
  "presentx", "contentx", "studiox", "testx", "testlms",
  "edux", "gamex", "quizx", "anketx", "avatarx", "stajyerx",
  "iyzico", "bagcilar", "bağcılar", "belediye", "guleryuz", "güleryüz",
  "design-ir", "studiox-adapter",
];
const DESEN = new RegExp(`\\b(${OZEL_ADLAR.join("|")})\\b`, "i");

function dosyalar(dizin) {
  const out = [];
  const gez = (d) => {
    for (const e of readdirSync(join(KOK, d), { withFileTypes: true })) {
      const rel = join(d, e.name);
      if (e.isDirectory()) gez(rel);
      else if (statSync(join(KOK, rel)).size < 512_000) out.push(rel);
    }
  };
  gez(dizin);
  return out;
}

test("yabanci repo: KOPYALANAN dosyalarda paket sahibinin urun adlari olamaz", () => {
  // `skill/` → kullanicinin .claude/skills/ dizinine
  // `templates/` → kullanicinin .serif-brain/indexes/ dizinine
  const kirli = [];
  for (const dizin of ["skill", "templates"]) {
    for (const rel of dosyalar(dizin)) {
      readFileSync(join(KOK, rel), "utf8").split("\n").forEach((satir, i) => {
        const m = satir.match(DESEN);
        if (m) kirli.push(`${rel}:${i + 1}  «${m[1]}»  ${satir.trim().slice(0, 60)}`);
      });
    }
  }
  assert.deepEqual(kirli, [],
    `kullanicinin deposuna yazilan dosyada paket sahibinin urun adi kalmis:\n  ${kirli.join("\n  ")}`);
});

test("yabanci repo: calisma-ani VARSAYILAN bir baska projenin adi olamaz", () => {
  // `resolvePrimaryProject` aktif proje yoksa "serif-platform" donuyordu: hicbir
  // yapilandirma yapmamis bir yabancinin uretilmis baglaminda, hic duymadigi bir
  // projenin adi belirirdi. Varsayilan ya turetilmeli ya durust olmali.
  const kirli = [];
  const gez = (d) => {
    for (const e of readdirSync(join(KOK, d), { withFileTypes: true })) {
      const rel = join(d, e.name);
      if (e.isDirectory()) { gez(rel); continue; }
      if (!e.name.endsWith(".mjs")) continue;
      readFileSync(join(KOK, rel), "utf8").split("\n").forEach((satir, i) => {
        if (satir.trim().startsWith("//") || satir.trim().startsWith("*")) return; // yorum serbest
        const m = satir.match(/["'`]([^"'`\n]*\b(serif-platform|presentx|contentx|studiox|testlms)\b[^"'`\n]*)["'`]/i);
        if (m) kirli.push(`${rel}:${i + 1}  ${satir.trim().slice(0, 70)}`);
      });
    }
  };
  for (const d of ["src", "bin", "hooks"]) gez(d);
  assert.deepEqual(kirli, [],
    `kodda baska bir projenin adi VARSAYILAN/METIN olarak kalmis:\n  ${kirli.join("\n  ")}`);
});
