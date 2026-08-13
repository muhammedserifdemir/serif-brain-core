---
id: bug-20260813-typescript-esm-x-js-yazimi-cozulmuyordu-graf-dosya
type: bug
project: seriftech-packages
module: scanner
title: "TypeScript ESM './x.js' yazimi cozulmuyordu — graf dosyayi YAPRAK sanip 'guvenle degistir' diyordu"
status: done
priority: critical
severity: critical
owner: ""
created_at: "2026-08-13T07:10:22.013Z"
updated_at: "2026-08-13T07:11:03.900Z"
source:
  kind: manual
  path: ""
relations:
  files: [src/scanner/resolve-import.mjs]
  decisions: []
  bugs: []
  modules: [scanner]
tags: []
summary: "TypeScript ESM './x.js' yazimi cozulmuyordu — graf dosyayi YAPRAK sanip 'guvenle degistir' diyordu"
completed_at: "2026-08-13"
---
# TypeScript ESM './x.js' yazimi cozulmuyordu — graf dosyayi YAPRAK sanip 'guvenle degistir' diyordu

## Etki

## Reproduce
1. 

## Beklenen

## Gozlemlenen

## Hipotez / Analiz

## Next Action

## Tamamlanma (2026-08-13)

TS NodeNext/ESM kurali KAYNAK degil CIKTI uzantisi yazdirir: dosya oda.ts iken import './oda.js' olur. tryWithExts yalniz uzantisiz tabana ek yapiyordu. Sonuc grafin EN TEHLIKELI yalani: kenari kaybolan dosya YAPRAK gorunuyor ve guard 'kimse import etmiyor, nispeten guvenli' diyordu — klavye-savas/src/oyun/oda.ts icin birebir bu cumle uretiliyordu, oysa odalar.ts ve sunucu.ts onu import ediyor. Cozum: .js→.ts/.tsx, .jsx→.tsx, .mjs→.mts, .cjs→.cts takasi SON CARE olarak; gercek .js dosyasi varsa o kazanir. A/B (HEAD worktree, 9 proje): klavye-savas 11→0, serif-platform 43→26. BULUNUS YONTEMI onemli: cokme taramasi (14 proje x 5 komut) TEMIZDI — bu sinif hata cokmez, sessizce yanlis cevap verir; aykiri ORAN aramak buldu (klavye-savas %29.7 vs digerleri %0-4.2).
