---
id: decision-20260620-yaml-parser-fail-loud-guvencesi-sessiz-veri-kaybi-
type: decision
project: seriftech-packages
module: infra
title: YAML parser fail-loud guvencesi (sessiz veri kaybi yok)
status: active
priority: medium
created_at: "2026-06-20T08:45:10.779Z"
updated_at: "2026-06-20T08:45:10.779Z"
source:
  kind: manual
  path: ""
relations:
  files: []
  decisions: []
  bugs: []
  modules: [infra]
tags: [audit, yaml, robustness]
---
# YAML parser fail-loud guvencesi (sessiz veri kaybi yok)

## Baglam
Ilk incelemede el-yazimi mini YAML parser'i (markdown/yaml.mjs) "#1 risk: sessiz veri kaybi"
olarak isaretlenmisti (ozellikle 4-bosluk girinti + liste-ogesi coklu anahtar suphesi). Tum
veri katmani bu parser'a bagli (en merkezi dosya — hotspot/risk de bunu zirvede gosterdi).

## Karar
2026-06-20 fuzz/round-trip audit'i (test/faz17, 14 test) yapildi. SONUC: sessiz veri kaybi
BULUNAMADI. Parser kapsami icin saglam:
- Round-trip OK: skaler, ozel-karakter, sayi/bool-gibi string, inline/blok array, 3-seviye
  nesting, inline object, URL (colon), uzun-array→blok, Turkce/unicode, 4-bosluk blok liste, coklu-anahtar liste.
- Desteklenmeyen 2 girdi SESLI (throw) hata verir, sessiz degil:
  (1) liste-ogesi ICINDE nested object serialize → serializeInline THROW (writeObject validation yakalar);
  (2) tab girinti → parse THROW (zaten gecersiz YAML).
**Guvence: desteklenmeyen girdi sessizce kaybedilmez; fail-loud.** Bu sozlesme teste sabitlendi.
yaml.mjs basligi gerçege gore duzeltildi (yorum "max 2 level" diyordu, aslinda cok-seviye calisir).

## Sonuclari (Consequences)
- Ilk incelemenin "sessiz veri kaybi" endisesi DUZELTILDI — parser dusunulenden saglam.
- Gelecekte biri fail-loud'u sessiz-kayba cevirirse faz17 testleri kirilir (regresyon koruması).
- GUNCELLEME (ayni gun): block scalar (| literal, > folded, chomp -/+) + cok-satirli string
  artik DESTEKLENIYOR (collapseBlockScalars on-gecisi + serializer tirnak fix; test/faz20).
  Cekirdek parser degismeden, on-gecis ile eklendi → dusuk risk, 156 test yesil.

## Reddedilen Alternatifler
- Harici YAML kutuphanesi (js-yaml): "sifir bagimlilik" felsefesini bozar; kapsam yeterli.
- Liste-ici nested object serialize destegi: spekulatif (mevcut sema uretmiyor) → YAGNI, eklenmedi.
