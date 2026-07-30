/**
 * SIRALAMA KAPISI — 2026-07-30'da bulunan hata icin.
 *
 * Belirti: `active-work.md`'nin "Now" listesi haziran kayitlarini gosteriyordu;
 * ayni veriden uretilen `CLAUDE.generated.md` ise en gunceli basa koyuyordu.
 *
 * Kok neden: "Now" listesi yalniz oncelige bakan bir karsilastirici
 * kullaniyordu. Tum kayitlar `critical` oldugunda karsilastirici hep 0 doner;
 * V8'in sort'u KARARLI oldugu icin esitlikte giris sirasi (dosya adi = en eski
 * once) korunur. Yani hata "yanlis siralama" degil, "esitlikte karar
 * verilmemesi"ydi — bu yuzden gozle bakinca sort dogru gorunuyordu.
 *
 * Bu testler kok nedeni dogrudan hedefler: ESITLIK durumunda ne oluyor?
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { rankObjects, compareObjects, pri } from "../src/util/rank.mjs";

/** Hatayi uretmis olan gercek sekil: hepsi critical, farkli tarihler. */
function hepsiCritical() {
  return [
    { id: "haziran-a", priority: "critical", updated_at: "2026-06-15T00:00:00.000Z" },
    { id: "haziran-b", priority: "critical", updated_at: "2026-06-16T00:00:00.000Z" },
    { id: "temmuz-30", priority: "critical", updated_at: "2026-07-30T00:00:00.000Z" },
    { id: "temmuz-24", priority: "critical", updated_at: "2026-07-24T00:00:00.000Z" },
  ];
}

test("oncelik esitse EN TAZE basa gelir (asil hata buydu)", () => {
  const sirali = rankObjects(hepsiCritical());
  assert.equal(
    sirali[0].id,
    "temmuz-30",
    "Esit oncelikte tazelik karar vermeli; giris sirasi birakilirsa en eski basa gecer",
  );
  assert.deepEqual(
    sirali.map((o) => o.id),
    ["temmuz-30", "temmuz-24", "haziran-b", "haziran-a"],
  );
});

test("YALNIZ oncelige bakan sort bu listede hic karar vermez (regresyonun kaniti)", () => {
  // Eski kodun karsilastiricisi. Kararli sort giris sirasini birakir.
  const eski = [...hepsiCritical()].sort((a, b) => pri(a.priority) - pri(b.priority));
  assert.equal(eski[0].id, "haziran-a", "eski davranis: en eski basta");
  // Yeni karsilastirici ayni girdide FARKLI sonuc uretmeli — yoksa duzeltme yok.
  const yeni = rankObjects(hepsiCritical());
  assert.notEqual(yeni[0].id, eski[0].id);
});

test("oncelik tazelikten once gelir", () => {
  const sirali = rankObjects([
    { id: "taze-ama-dusuk", priority: "low", updated_at: "2026-07-30T00:00:00.000Z" },
    { id: "eski-ama-kritik", priority: "critical", updated_at: "2026-01-01T00:00:00.000Z" },
  ]);
  assert.equal(sirali[0].id, "eski-ama-kritik");
});

test("pinned her seyi gecer", () => {
  const sirali = rankObjects([
    { id: "kritik-taze", priority: "critical", updated_at: "2026-07-30T00:00:00.000Z" },
    { id: "sabit", priority: "low", updated_at: "2020-01-01T00:00:00.000Z", pinned: true },
  ]);
  assert.equal(sirali[0].id, "sabit");
});

test("updated_at yoksa created_at'e duser", () => {
  const sirali = rankObjects([
    { id: "eski", priority: "high", created_at: "2026-01-01T00:00:00.000Z" },
    { id: "yeni", priority: "high", created_at: "2026-07-30T00:00:00.000Z" },
  ]);
  assert.equal(sirali[0].id, "yeni");
});

test("tarihi olmayan kayit basa GECMEZ", () => {
  const sirali = rankObjects([
    { id: "tarihsiz", priority: "high" },
    { id: "tarihli", priority: "high", updated_at: "2026-07-30T00:00:00.000Z" },
  ]);
  assert.equal(sirali[0].id, "tarihli");
});

test("rankObjects cagiranin dizisini DEGISTIRMEZ", () => {
  const girdi = hepsiCritical();
  const kopya = girdi.map((o) => o.id);
  rankObjects(girdi);
  assert.deepEqual(girdi.map((o) => o.id), kopya);
});

test("compareObjects gecisli ve simetrik (sort sozlesmesi)", () => {
  const liste = hepsiCritical();
  for (const a of liste) {
    for (const b of liste) {
      // `+ 0` normalizasyonu: Math.sign(0) === 0 ama -Math.sign(0) === -0
      // ve strictEqual bunlari FARKLI sayar (Object.is(0, -0) === false).
      assert.equal(
        Math.sign(compareObjects(a, b)) + 0,
        -Math.sign(compareObjects(b, a)) + 0,
        `${a.id} <-> ${b.id} simetrik degil`,
      );
    }
  }
});

test("bilinmeyen oncelik en sona", () => {
  const sirali = rankObjects([
    { id: "sacma", priority: "acayip", updated_at: "2026-07-30T00:00:00.000Z" },
    { id: "dusuk", priority: "low", updated_at: "2020-01-01T00:00:00.000Z" },
  ]);
  assert.equal(sirali[0].id, "dusuk");
});
