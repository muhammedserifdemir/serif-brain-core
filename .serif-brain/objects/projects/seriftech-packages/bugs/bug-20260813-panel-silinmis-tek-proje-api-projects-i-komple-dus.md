---
id: bug-20260813-panel-silinmis-tek-proje-api-projects-i-komple-dus
type: bug
project: seriftech-packages
module: dashboard
title: "Panel: silinmis TEK proje /api/projects'i komple dusuruyordu"
status: done
priority: high
severity: high
owner: ""
created_at: "2026-08-13T06:51:27.669Z"
updated_at: "2026-08-13T06:51:51.439Z"
source:
  kind: manual
  path: ""
relations:
  files: [src/dashboard/collect.mjs]
  decisions: []
  bugs: []
  modules: [dashboard]
tags: []
summary: "Panel: silinmis TEK proje /api/projects'i komple dusuruyordu"
completed_at: "2026-08-13"
---
# Panel: silinmis TEK proje /api/projects'i komple dusuruyordu

## Etki

## Reproduce
1. 

## Beklenen

## Gozlemlenen

## Hipotez / Analiz

## Next Action

## Tamamlanma (2026-08-13)

collectBrain kayip brain'de yarim kayit donuyordu (critItems yok); collectAll toplamlari critItems.some() cagirinca TUM /api/projects patliyordu — 19 brain'in 18'i saglikliyken panel hicbirini gostermiyordu. Sozlesme: kayit HER ZAMAN sema-tam doner, eksik olan veridir ve 'error' alani onu soyler. Olcum: gercek registry ile once {error:...} → sonra aktif 17 + arsiv 2, iki KAYIP proje isaretli. Regresyon testi fikstur registry kullaniyor (eskiden gelistiricinin ~/.serif-brain-registry.json dosyasini okuyordu: baska makinede yesil gecerdi) ve icine bilerek silinmis proje koyuyor.
