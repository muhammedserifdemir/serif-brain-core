---
id: record-20260811-temiz-oda-denetimi-ilk-60-saniye-hatalari-kapi-don
type: record
project: seriftech-packages
module: infra
title: "Temiz oda denetimi: ilk-60-saniye hatalari + kapi dongusu"
status: done
priority: low
created_at: "2026-08-11T19:25:12.924Z"
updated_at: "2026-08-11T19:25:12.924Z"
source:
  kind: manual
  path: ""
relations:
  files: [marketing/linkedin-post.md]
  decisions: []
  bugs: []
  modules: [infra]
tags: []
---
# Temiz oda denetimi: ilk-60-saniye hatalari + kapi dongusu

## Ne yapildi

Paketin KENDI reposu disinda, sifirdan bir projede denetim. Bes bulgu, hepsi
olcumle; ayrica kullanicinin ekraninda yasanan kapi dongusunun kok nedeni.

## Neden

Kendi reposunda test etmek yaniltir: config'i, gecmisi, kurulumu hazirdir.
"Yabanci makinede ilk 60 saniye" bambaska bir sey olcer.

## Sonuc / Kanit

1. **`guard` varsayilan kurulumda susuyordu** — `module_paths` yorumluydu.
   Kanit: yeni projede `api` moduluine bug + `guard src/api/users.js` →
   "Bilinen kisit/risk yok". init artik klasor yapisindan turetiyor.
2. **`doctor` yabanciya paket yazarinin goc gecmisini gosteriyordu**
   (3 kirmizi ✗ + 2 uyari, hicbiri kullaniciyla ilgili degil). Bolumler artik
   yalnizca config'inde `legacy_sources` olan brain'de cikiyor.
3. **`brief` olcekle sinirsiz buyuyordu** — 5000 kayit → 6.297 token → 180.
4. **Dokumanlar bayatti** — MCP.md 13 arac diyordu (16 var).
5. **Kapi 22 projeden 1'inde kuruluydu**, oysa LinkedIn taslagi "artik hep
   calisiyor" diyordu. Global kuruluma gecildi.

**Kapi dongusu (ayri ve daha ciddi):** `review` exit 2, `guard`/`check` exit 1
verir bulgu VARSA; execFileSync sifir-olmayan cikista firlatir; hook bunu
"basarisiz" sayip null donuyordu. Kapinin DORT MODU DA tam sorun bulundugunda
susuyordu. Ayrica Stop kapisi DURUM bildirdigi icin her durma denemesinde ayni
metni uretip sonsuz donguye giriyordu ("Bekliyorum. Bekliyorum...").
Duzeltme: exit kodu tolere ediliyor + durum bildirimi oturum acilisina tasindi
+ emitOnce (soyledigini bir daha soyleme).

Bkz. [[decision-20260811-kapi-yazmaz-atlanani-gorunur-kilar-otomatik-churn-]]
