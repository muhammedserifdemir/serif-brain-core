// "Hangi kopyayi calistiriyorum?"
//
// GERCEK OLAY (2026-08-12): sahibi Mac'te `--version` calistirip 1.1.0 gordu ve
// "guncelleme otomatik gidiyor" sonucuna vardi. Oysa Mac'te CLI KAYNAK DIZINDEN
// calisiyordu — o sayi birkac saat once package.json'a yazilan sayiydi. Baska
// makinedeki npm kopyasi iki ay (41 commit) geride duruyordu ve eski surumu
// calistiran kisi HICBIR uyari gormuyordu.
//
// Sozlesme: surum numarasi TEK BASINA yaniltir; hangi kopya oldugunu da soyle.
// AG YOK: "yeni surum var mi" diye kimseye sorulmaz — yalnizca calisan kopyanin
// KIMLIGI ve tazeleme yolu bildirilir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { kurulumBilgisi, kurulumSatirlari, GUNCELLEME_KOMUTU } from "../src/util/kurulum.mjs";

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("KAYNAK dizin: git deposu olarak taninir + commit bilgisi verir", () => {
  const b = kurulumBilgisi(join(KOK, "bin", "serif-brain.mjs"));
  assert.equal(b.tur, "kaynak");
  assert.ok(b.git?.commit, "calisan commit gorunmeli");
  const metin = kurulumSatirlari(b).join("\n");
  assert.match(metin, /DUZENLEDIGIN dosyalar/);
  assert.match(metin, /BASKA makinelerdeki kurulumlari/,
    "kaynakta gorulen surumun baska makineleri etkilemedigi ACIKCA yazmali");
});

test("GLOBAL npm kopyasi: 'kendiliginden GUNCELLENMEZ' + komut basar", () => {
  const kok = mkdtempSync(join(tmpdir(), "sbc-glob-"));
  const paket = join(kok, "node_modules", "serif-brain-core");
  mkdirSync(join(paket, "bin"), { recursive: true });
  writeFileSync(join(paket, "bin", "serif-brain.mjs"), "#!/usr/bin/env node\n");
  writeFileSync(join(paket, "package.json"), '{"name":"serif-brain-core","version":"1.0.0"}');

  const b = kurulumBilgisi(join(paket, "bin", "serif-brain.mjs"));
  assert.equal(b.tur, "global", "node_modules altindaki kopya global sayilmali");
  const metin = kurulumSatirlari(b).join("\n");
  assert.match(metin, /kendiliginden GUNCELLENMEZ/);
  assert.match(metin, /npm i -g git\+https/, "tazeleme komutu KOPYALANABILIR olmali");
});

test("git deposu olmayan, node_modules'da da olmayan yol: yine de komut verir", () => {
  const kok = mkdtempSync(join(tmpdir(), "sbc-bilinmez-"));
  mkdirSync(join(kok, "bin"), { recursive: true });
  writeFileSync(join(kok, "bin", "serif-brain.mjs"), "#!/usr/bin/env node\n");
  const b = kurulumBilgisi(join(kok, "bin", "serif-brain.mjs"));
  assert.equal(b.tur, "bilinmiyor");
  assert.match(kurulumSatirlari(b).join("\n"), /Tazelemek icin/,
    "tur bilinmese bile kullanici ne yapacagini bilmeli");
});

test("AG YOK: hicbir uzak surum sorgusu yapilmaz", () => {
  // Sozlesme: bu modul git'i YEREL olarak okur, HTTP yapmaz. Kaynak taramasi
  // niyeti kilitler — ag cagrisi eklenirse bu test kirmizi yanar.
  const kaynak = execFileSync("cat", [join(KOK, "src", "util", "kurulum.mjs")], { encoding: "utf8" });
  for (const yasak of ["fetch(", "https.get", "http.get", "node:https", "XMLHttpRequest"]) {
    assert.ok(!kaynak.includes(yasak), `${yasak} kullanilmamali — surum kontrolu AG YAPMAZ`);
  }
  assert.ok(!/git\s+fetch|"fetch"/.test(kaynak), "git fetch de yapilmaz (yerel durum okunur)");
});

test("--version CLI ciktisinda kurulum satiri GERCEKTEN basiliyor", () => {
  const out = execFileSync(process.execPath, [join(KOK, "bin", "serif-brain.mjs"), "--version"], { encoding: "utf8" });
  assert.match(out, /^serif-brain \d+\.\d+\.\d+/m);
  assert.match(out, /Kaynak|Kurulum/, "cipla surum numarasi yetmez — hangi kopya oldugu da yazmali");
});

test("GUNCELLEME_KOMUTU tek kaynak (dokumanla ayrisamasin)", () => {
  assert.match(GUNCELLEME_KOMUTU, /^npm i -g git\+https:\/\/github\.com\//);
});
