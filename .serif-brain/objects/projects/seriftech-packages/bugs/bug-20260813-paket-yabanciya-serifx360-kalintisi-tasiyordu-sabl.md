---
id: bug-20260813-paket-yabanciya-serifx360-kalintisi-tasiyordu-sabl
type: bug
project: seriftech-packages
module: scanner
title: "Paket yabanciya SERIFX360 kalintisi tasiyordu: sablon/skill/renk/modul listesi + goc modul SILME"
status: done
priority: critical
severity: critical
owner: ""
created_at: "2026-08-13T10:34:19.395Z"
updated_at: "2026-08-13T10:34:44.830Z"
source:
  kind: manual
  path: ""
relations:
  files:
    - README.md
    - README.tr.md
    - marketing/linkedin-post.md
    - skill/olcum-sozlesmesi/SKILL.md
    - skill/serif-brain-core/SKILL.md
    - src/cli/init.mjs
    - src/cli/migrate.mjs
    - src/context/compile.mjs
    - src/doctor/doctor.mjs
    - src/graph/serialize.mjs
    - src/graph/viewer.mjs
    - src/ingest/legacy-yaml.mjs
  decisions: []
  bugs: []
  modules: [scanner]
tags: []
summary: "Paket yabanciya SERIFX360 kalintisi tasiyordu: sablon/skill/renk/modul listesi + goc modul SILME"
completed_at: "2026-08-13"
---
# Paket yabanciya SERIFX360 kalintisi tasiyordu: sablon/skill/renk/modul listesi + goc modul SILME

## Etki

## Reproduce
1. 

## Beklenen

## Gozlemlenen

## Hipotez / Analiz

## Next Action

## Tamamlanma (2026-08-13)

Yayin oncesi 'yabanci kurulumda kalinti kalmasin' denetimi. Alti sinif bulundu. (1) init YABANCININ deposuna yaziyordu: templates/object-templates/*.md 'project: serif-platform' + 'module: testx # contentx|presentx|animatorx|studiox', skill/serif-brain-core/SKILL.md ornekleri 'PresentX seed inconsistency'. (2) resolvePrimaryProject varsayilani 'serif-platform'du; bir test bunu CIVILEMISTI ('default primary project = serif-platform'). (3) graf renk haritalari contentx/presentx/studiox anahtarliydi → herkesin grafi tek renk; artik ad hash'inden deterministik turetiliyor. (4) init'te 4-projeli flagship onyukleme + module_normalization (testlms→testx) — korumaliydi ama ayni adi tasiyan yabanci klasorde patlardi; kaldirildi. (5) EN AGIRI ISLEVSELDI: migrate/normalize+apply sabit VALID_MODULES tasiyordu; goc eden yabancinin listede olmayan TUM modulleri 'unknown'a iniyordu = veri kaybi. Artik config.valid_modules + module_normalization; config yoksa KISITLAMA YOK. (6) scanner/module-owner varsayilan kurallari tamamen SerifX360 klasor duzeniydi (apps/contentx/, apps/presentation-designer/) → config yazmamis her projede her dosya unknown. Genel konvansiyona cevrildi (kapsayici/ + ilk segment). OLCUM: stajyerx %95.8→%33.3, serif-toon-studio %80.6→%8.3, animatorx-v3 %57.1→%6.0. cizgi-film-otomasyon %100 kaldi (duz yerlesim) — duz-yerlesim kurali DENENDI ve 3 testi kirdi ('ne graf ne config biliyorsa unknown kalir, YALAN URETMEZ'); tahmini gercek gibi sunmamak icin GERI ALINDI, dogru yol config module_paths. Kapi: test/yabanci-repo-temizligi.test.mjs — kopyalanan dosyalarda ve calisma-ani varsayilanlarinda paket sahibinin urun adlari yasak. Kapsam bilerek dar: README/CHANGELOG/docs gercek olcumleri anlatir, orasi kanittir ve yabanciya kopyalanmaz.
