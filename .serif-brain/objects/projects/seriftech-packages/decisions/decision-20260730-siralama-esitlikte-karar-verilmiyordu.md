---
id: decision-20260730-siralama-esitlikte-karar-verilmiyordu
type: decision
project: seriftech-packages
module: infra
title: "SIRALAMA HATASI — esitlikte karar verilmiyordu; Now listesi EN ESKI kaydi gosteriyordu (src/util/rank.mjs tek kaynak)"
status: active
priority: high
created_at: "2026-07-30T12:15:00.000Z"
updated_at: "2026-07-30T12:15:00.000Z"
source:
  kind: manual
  path: ""
relations:
  files:
    - src/util/rank.mjs
    - src/context/compile.mjs
    - src/reporter/decisions.mjs
    - src/reporter/bugs.mjs
    - test/rank-siralama.test.mjs
  decisions: []
  bugs: []
  modules: [infra]
tags: [siralama, sort, context, reporter, kapi, ders]
---

# Siralama hatasi — "yanlis siralama" degil, esitlikte karar verilmemesi

Commit `fc887cc`. edux brain'inde kullanirken bulundu.

## Belirti

`active-work.md`'nin **"Now (top 5 by priority)"** listesi HAZIRAN kayitlarini
gosteriyordu. Ayni calistirmada, **ayni veriden** uretilen
`CLAUDE.generated.md` ise en gunceli basa koyuyordu.

Etki sessiz ama buyuk: yeni bir oturum baglami `active-work.md`'yi okuyup
**yanlis ise** bakiyordu. Guncel dongu kaydi listede hic gorunmuyordu.

## Kok neden

```js
.sort((a, b) => pri(a.priority) - pri(b.priority))   // tek anahtar
```

Tum kayitlar `critical` oldugunda bu karsilastirici **hep 0 doner**. V8'in
`Array.prototype.sort`'u **kararlidir (stable)**: esitlikte giris sirasi
korunur. Giris sirasi da dosya adi siralamasidir → `decision-20260615-...`
basa gecer.

Yani hata "sort yanlis yaziImis" degil, **"esitlikte ne olacagina karar
verilmemis"**. Bu yuzden koda gozle bakinca dogru gorunuyordu; sadece
gercek veride ortaya cikiyordu.

**En net kanit:** tek kaynak, iki farkli cikti. Fark `CLAUDE.generated.md`'nin
`rankObjects()` cagirmasiydi.

## Ayni kalip yine

Dogru anahtar (`pinned` > oncelik > tazelik) `compile.mjs` icinde **ZATEN
vardi** (`rankObjects`), ama 7 cagri yerinden yalniz 2'si onu kullaniyordu.
`PRIORITY_ORDER` ve `pri()` de uc ayri dosyada kopyalanmisti.

## Cozum

- **YENI `src/util/rank.mjs`** — siralamanin TEK KAYNAGI: `compareObjects`,
  `rankObjects`, `pri`, `daysSince`. Dosyanin basinda neden var oldugu yazili.
- 5 cagri yeri baglandi: `context/compile.mjs` (Now listesi + 2 preview
  listesi), `reporter/decisions.mjs`, `reporter/bugs.mjs` (2 yer).
- Reporter'lardaki **in-place** `list.sort(...)` cagrilari siralanmis kopyaya
  cevrildi — `rankObjects` yeni dizi doner, atama yapilmazsa liste sirasiz
  kalirdi.
- `summarize()` artik `pinned`'i `compact.json`'a tasiyor. Yan bulgu:
  `applyBudget` butceyi bu alana gore genisletiyor; dusurulunce sabitlenmis
  kayit kirpilabiliyordu.
- `reporter/decisions.mjs:63` DOKUNULMADI — orada zaten `created_at` esitlik
  kiricisi vardi.

## KURAL

**Kayit listesi siralayan her yer `src/util/rank.mjs` kullanir.**
Yerel `.sort((a,b) => pri(...) - pri(...))` yazilmaz.

Genel hali: **kararli bir sort'ta esitlik = karar verilmemis demektir.**
Ucuncu bir anahtar (tazelik, id, ne uygunsa) hep konur.

## Kapi

`test/rank-siralama.test.mjs` — 9 test. En onemlisi:

> eski karsilastiricinin ayni girdide **FARKLI** sonuc urettigini dogrular

Yani duzeltmenin gercekten bir sey degistirdiginin kaniti. Yalniz "yeni kod
dogru siraliyor" demek yetmez; eski kodun ayni veride yanlis siraladigi da
gosterilmeli, yoksa test bos yere yesil olabilir.

Kapsanan digerleri: sort sozlesmesi (simetri), `pinned` onceligi,
`updated_at` → `created_at` dususu, tarihsiz kaydin basa GECMEMESI,
girdinin degistirilmemesi, bilinmeyen onceligin sona atilmasi.

**Testi yazarken kendi hatam:** `Math.sign(0) === 0` ama `-Math.sign(0) === -0`
ve `assert.strictEqual` bunlari FARKLI sayar (`Object.is(0, -0) === false`).
Simetri testi bu yuzden patladi; `+ 0` normalizasyonu ile duzeltildi.

## Dogrulama

- `npm test` → **177/177** (9'u yeni).
- Gercek veri: edux brain'inde `serif-brain context` sonrasi Now listesi
  guncel dongu kaydini gosteriyor; `reports/decisions.md` de en yeniden
  eskiye siraliyor.

## Not — `pinned` kullanimi

Tazelik anahtari, **eski bir kaydi bugun duzenlemenin** onu listenin basina
tasidigi anlamina gelir (dogru davranis, ama surpriz olabilir). Guncel dongu
kaydinin hep basta kalmasi isteniyorsa frontmatter'a `pinned: true` konur;
dongu kapaninca kaldirilir.
