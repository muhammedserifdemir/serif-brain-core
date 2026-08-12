---
id: record-20260812-derin-olcum-kapi-14-9-konusuyor-sinyal-sansin-5-6-
type: record
project: seriftech-packages
module: infra
title: "Derin olcum: kapi %14.9 konusuyor, sinyal sansin 5.6 kati ustunde"
status: done
priority: low
created_at: "2026-08-12T11:30:01.899Z"
updated_at: "2026-08-12T11:30:01.899Z"
source:
  kind: manual
  path: ""
relations:
  files: []
  decisions: []
  bugs: []
  modules: [infra]
tags: []
---
# Derin olcum: kapi %14.9 konusuyor, sinyal sansin 5.6 kati ustunde

## Ne yapildi

"Calisiyor mu" degil "ISE YARIYOR MU" olcumu. Veri: 20 gercek brain, 1.179
kayit, gercek git gecmisi (sentetik degil). Yol: uretimdeki cagri noktasi
gatherGuard()/loadObjects — taklit degil.

## Neden

Cokme yoklugu (60 calistirma, 0 cokme) yalnizca CALISTIGINI gosterir. Degerin
kaniti farklidir: kapi konustugunda soyledigi sey KARAR DEGISTIRIR mi?

## Sonuc / Kanit

**(1) Kapi sinyal kalitesi** — son 90 gunde degisen 1.677 dosya:
  · %14.9 DOSYAYA OZEL sinyal (250)
  · %7.1 modul-geneli (119)
  · %78.0 sessiz (1.308)
Varyans buyuk: GameX %51, klavye-savas %39 vs stajyerx %0, animatorx-v3 %0.
Fark, kayitlarin relations.files ile dosyaya baglanip baglanmadigindan geliyor.

**(2) Hafiza kapsami** — 1.179 kaydin %54,6'si dosyaya bagli, %33,3'u yalniz
modul, %12'si ikisi de yok. Hafizanin dokundugu benzersiz dosya 1.066 /
18.336 izlenen dosya = **%5,8 kapsam**. %78 sessizligin sebebi bu.

**(3) GERIYE-DONUK ONLEME (en belirleyici)** — dosyaya bagli 133 bug kaydi:
  · GERCEK  : bug'in dosyasinda ONCEDEN kayit vardi → %80,5 (107/133)
  · KONTROL : ayni depo, ayni an, RASTGELE dosya   → %14,3 (19/133)
  · **Sinyal/gurultu = 5,6×**
Kontrol grubu olmadan %80,5 anlamsizdi (hafiza yogun dosyalarda birikir).
Kontrolle birlikte: hafiza GERCEKTEN bug cikan dosyalarda birikmis.

**(4) Bayatlama** — 595 aktif kayit, ortalama yas 39 gun, 82 kirik dosya
referansi, dosyalarinin TAMAMI silinmis yalniz 9 kayit. Curume dusuk.

**(5) Graf dogrulugu** — 3 projeden 25'er kenar ornegi kaynakta dogrulandi:
75/75 dogru (serif-platform 6.599 kenar, avatarx 145, GameX 329).

**(6) Maliyet** — kapi HER Edit'te calisir: pre ~0,26-0,33 sn, post ~0,11 sn,
Stop 0,16-0,45 sn, SessionStart 0,7-1,3 sn (~250-380 token).
Edit basina ~0,4 sn ek gecikme.

## Kapsam etiketi / bakilmayan

· (3)'teki %80,5 YALNIZCA kaydedilmis ve dosyaya baglanmis bug'lar icin
  gecerlidir. Hic kaydedilmemis bug bu olcumun disinda — yani "kapi bug'larin
  %80'ini onler" DENEMEZ; denebilecek sey: "kayit tutulan yerde hafiza,
  ihtiyac aninda ilgili bilgiyi %80 oraninda icermis".
· Kapinin gercekten davranis degistirdigi olculmedi (bunun icin A/B gerekir).
· Windows'ta hicbir olcum yapilmadi.
