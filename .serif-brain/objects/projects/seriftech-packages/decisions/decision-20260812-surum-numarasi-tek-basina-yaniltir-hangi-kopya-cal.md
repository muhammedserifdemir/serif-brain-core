---
id: decision-20260812-surum-numarasi-tek-basina-yaniltir-hangi-kopya-cal
type: decision
project: seriftech-packages
module: cli
title: Surum numarasi tek basina yaniltir — hangi KOPYA calistigi da soylenir
status: active
priority: medium
created_at: "2026-08-12T13:20:37.616Z"
updated_at: "2026-08-12T13:20:37.616Z"
source:
  kind: manual
  path: ""
relations:
  files: [src/util/kurulum.mjs, src/cli/index.mjs]
  decisions: []
  bugs: []
  modules: [cli]
tags: []
---
# Surum numarasi tek basina yaniltir — hangi KOPYA calistigi da soylenir

## Baglam

2026-08-12: sahibi Mac'te `serif-brain --version` calistirdi, 1.1.0 gordu ve
"guncelleme otomatik gidiyor" sonucuna vardi. Oysa Mac'te CLI KAYNAK DIZINDEN
calisiyor — o sayi birkac saat once package.json'a yazilan sayinin ta kendisi.

Windows'taki stajyerin makinesinde `npm i -g git+...` ile alinmis AYRI bir kopya
var; kuruldugu gunden beri hic degismedi (v1.0.0, 41 commit geride). O surumde
Windows'ta modul eslemesi TAMAMEN bozuktu (her dosya `unknown`'a dusuyordu) ve
kullanici hicbir hata gormuyordu.

Iki taraf da kendi ekraninda "her sey yolunda" goruyordu.

## Karar

Surum numarasi TEK BASINA basilmaz. `--version` ve `doctor` ayrica sunu soyler:
 · hangi KOPYA calisiyor (kaynak dizin mi, npm global kopyasi mi)
 · kaynak dizinse: dal@commit, tarih, calisma agaci kirli mi, uzaktan geride mi
 · global kopyaysa: "kendiliginden GUNCELLENMEZ" + kopyalanabilir komut
 · kaynak dizinse ayrica: "burada gordugun surum BASKA makineleri ETKILEMEZ"

## Sonuclari (Consequences)

- Eski surumu calistiran kisi artik ekraninda uyariyi gorur.
- Bir daha "bende 1.1.0 gorunuyor" ile "onda 1.0.0 calisiyor" karistirilamaz.
- doctor'a "0. Calisan Kopya" bolumu eklendi (en uste, cunku diger tum
  teshisler HANGI kopyanin teshisi oldugu bilinmeden anlamsizdir).

## Reddedilen Alternatifler

- **Uzaktan surum sorgusu (ag cagrisi)**: "yeni surum var mi" diye sormak.
  REDDEDILDI — sifir bagimlilik/ag politikasini bozar, gizlilik sorusu acar ve
  cevrimdisi calismayi bozar. Kullanicinin HANGI kopyayi calistirdigini bilmesi,
  yanlis kopyaya bakmasini engellemeye zaten yeter.
  Kapi: test/kurulum-bilgisi.test.mjs kaynak taramasi yapar — fetch/https
  eklenirse test kirmizi yanar.
- **Otomatik guncelleme**: kullanicinin makinesine haber vermeden yazmak.
  REDDEDILDI — arac zaten "kapi kurar"; ustune bir de kendini gizlice
  degistirirse guven kalmaz.
