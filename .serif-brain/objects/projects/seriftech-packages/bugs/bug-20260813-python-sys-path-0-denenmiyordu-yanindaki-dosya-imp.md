---
id: bug-20260813-python-sys-path-0-denenmiyordu-yanindaki-dosya-imp
type: bug
project: seriftech-packages
module: scanner
title: "Python sys.path[0] denenmiyordu: yanindaki dosya import'u gercek kenar yerine SAHTE bagimlilik uretiyordu"
status: done
priority: medium
severity: medium
owner: ""
created_at: "2026-08-13T06:51:35.757Z"
updated_at: "2026-08-13T06:52:21.799Z"
source:
  kind: manual
  path: ""
relations:
  files: [src/scanner/resolve-import.mjs, src/graph/build.mjs]
  decisions: []
  bugs: []
  modules: [scanner]
tags: []
summary: "Python sys.path[0] denenmiyordu: yanindaki dosya import'u gercek kenar yerine SAHTE bagimlilik uretiyordu"
completed_at: "2026-08-13"
---
# Python sys.path[0] denenmiyordu: yanindaki dosya import'u gercek kenar yerine SAHTE bagimlilik uretiyordu

## Etki

## Reproduce
1. 

## Beklenen

## Gozlemlenen

## Hipotez / Analiz

## Next Action

## Tamamlanma (2026-08-13)

Ilk iki fix'ten SONRA olcum ucuncu kusuru acti: 'server' ve 'test_hair_measure' proje dosyasiyken sahte bagimlilik dugumu oldu. Iki ayri neden: (1) resolvePythonImport dosyanin KENDI dizinini denemiyordu — Python'da script calistirildiginda sys.path[0] scriptin dizinidir, yani tests/rapor.py icindeki 'from yardimci import x' yanindaki tests/yardimci.py'yi bulur; bu deneme olmadan 5 GERCEK kenar sessizce kayiptı. (2) Ad projede bir .py dosyasi olarak var ama import ona cozulmediyse (sys.path hilesi, tasinmis dosya, eksik __init__.py) bunu '3. parti bagimlilik' saymak UYDURMAK olur → artik unresolved sayiliyor, sinyal korunuyor. avatarx'te kalan tek unresolved bu: cli.py:438 'from server import main' ama dosya ui/server.py. DERS: bir yanlis-alarmi susturan fix, susturdugu seyi SAHTE POZITIFE cevirebiliyor — duzeltmeyi gercek repoda olcmeden kapatma.
