---
id: decision-20260811-kapi-yazmaz-atlanani-gorunur-kilar-otomatik-churn-
type: decision
project: seriftech-packages
module: hooks
title: "Kapi YAZMAZ, atlanani GORUNUR kilar — otomatik churn yasagi surüyor"
status: active
priority: high
created_at: "2026-08-11T18:57:37.620Z"
updated_at: "2026-08-11T18:57:37.620Z"
source:
  kind: manual
  path: ""
relations:
  files: [hooks/claude-gate.mjs, src/query/capture-scan.mjs]
  decisions: []
  bugs: []
  modules: [hooks]
tags: []
---
# Kapi YAZMAZ, atlanani GORUNUR kilar — otomatik churn yasagi surüyor

## Baglam

`capture` (commit -> aday bug/karar) yazilmisti ama onu HICBIR SEY tetiklemiyordu.
Olcum (2026-08-11): 1 Mayis'tan beri 35 commit, 8 obje — 6'si tek gunden;
`capture --days 30` o an 9 aday buluyordu. Bilgi commit mesajlarinda duruyor,
hafizaya hic gecmiyordu.

Bariz cozum "post-commit hook'unda otomatik yaz" gibi gorunuyor. Ama bu brain'in
gecmisinde bunun BEDELI odendi: eski bridge otomatik kayit uretiyordu, gurultu
hafizayi okunmaz hale getirdi, bridge emekli edildi ve `automation_id_patterns`
+ `prune` savunmasi tam bu yuzden eklendi.

## Karar

Kapi HAFIZAYA YAZMAZ. Yalnizca ATLANANI GORUNUR KILAR:
 · `brief` — oturum acilisinda "📝 Hafizaya gecmemis commit (N)"
 · `claude-gate stop` — "bitti" demeden once ayni satir
Yazma karari insanda kalir: `serif-brain capture --days N --apply`.

Gurultu sozlesmesi: oneri yoksa SUSAR; mesaj TEK KOMUTLA eyleme donusur;
`config.yaml: capture_reminder: false` ile tamamen kapatilabilir.

## Sonuclari (Consequences)

- Hafiza yalniz insan/ajan onayiyla buyur — otomatik churn geri gelmez.
- Uyari, is yapilana kadar TEKRARLANIR. Kabul edildi: eyleme donusen ve
  kapatilabilen bir uyari, gurultu degildir. (`review` kapsam uyarisinda
  yasanan hata buydu: "graph build kos" eyleme DONUSMUYORDU.)
- Precision kapisi sart oldu: yalnizca `.serif-brain/` degistiren commit
  elenir — kayit tutan commit olayin kendisi degildir; onu bug diye onermek
  kaydi tutani cezalandirir. (9 -> 7 aday.)

## Reddedilen Alternatifler

- **git post-commit hook'unda otomatik yazmak** — gecmiste denendi, gurultu
  uretti, geri alindi. Bu karar o kararin devamidir.
- **Sessizce hicbir sey yapmamak** — mevcut durum buydu: makine vardi,
  tetikleyicisi yoktu; hafiza 3 ayda 8 kayitta kaldi.
