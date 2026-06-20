---
id: decision-20260620-faz-symbol-graph-sembol-seviyesi-graf-canli-impact
type: decision
project: seriftech-packages
module: infra
title: "Faz: Symbol Graph (sembol-seviyesi graf + canli impact)"
status: done
priority: high
created_at: "2026-06-20T07:23:49.962Z"
updated_at: "2026-06-20T12:30:00.000Z"
completed_at: "2026-06-20T12:30:00.000Z"
source:
  kind: manual
  path: ""
relations:
  files: []
  decisions: []
  bugs: []
  modules: [infra]
tags: [roadmap, symbol-graph, impact]
---
# Faz: Symbol Graph (sembol-seviyesi graf + canli impact)

## Baglam
Graf bugun DOSYA granularitesinde + batch rapor. Ajan calisirken asil ihtiyac duydugu sey
canli "ne kirilir / nerede risk var" sorularina cevap. En cok kor olunan nokta etki analizi.

## Karar
Grafi sembol seviyesine cikar + canli MCP sorgulari olarak ac:
- **Call graph (import degil)** → "bu FONKSIYONU kim cagiriyor"; etki analizi belirsizden cerrahiye.
- **`brain impact <dosya|sembol>`** → canli blast-radius: kim import/cagiriyor + hangi karar/bug bu modulu baglar.
- **Katman ihlali kurallari** → config'e mimari kural (`ui → db dogrudan import edemez`); ihlal edge'i flag'le.
- **Hotspot fuzyonu** → git churn × karmasiklik × gecmis bug yogunlugu = "tehlike bolgesi" haritasi.
- **Veri-akisi lite** → "bu env/API key nerelerden geciyor" (sizinti/config bug'lari).
- **Guvenli olu kod** → orphan + export'u kimse kullanmiyor + testi yok.
- DFS'i iteratif yap (buyuk grafta stack overflow riski) + olu `if (dfs(...))` dalini temizle.

## Sonuclari (Consequences)
- Mimari bug'lar daha dogmadan yakalanir; refactor guvenli hale gelir.
- Graf "rapor" olmaktan cikip "canli sorgu motoru" olur → MCP tarafi gercekten degerli.

## Reddedilen Alternatifler
- Dosya-seviyesinde kalmak: etki analizi cok kaba ("tum dosya tum dosyayi import ediyor").
- Web UI/dashboard: ajan onu tuketmiyor → yatirim MCP tool'larina gitmeli.

## Ilerleme (2026-06-20)
- [x] **`brain impact <dosya>`** + MCP `brain_impact` (query/impact.mjs) — mevcut import grafi uzerinden
      gecisli blast-radius + etkilenen modul + yaprak sinyali + touch hafiza capraz-referans. Dongu-guvenli BFS.
      Canli kanit: search.mjs → 17 dosya / 11 dogrudan bagimli. (Dosya-seviyesi; sembol sonraki adim.)
- [→] Sembol-seviyesi call-graph (fonksiyon "kim cagiriyor") — ERTELENDI: kirilgan cok-dilli
      sembol parser'i kalite riski; kendi odakli turunu hak ediyor. Dosya-seviyesi impact/hotspot yeterli deger veriyor.
- [x] **Katman-ihlali kurallari** — `brain layers` + MCP `brain_layers` (query/layers.mjs): config layer_rules, `*` joker, exit 2.
- [x] **`brain check`** + MCP `brain_check` (query/check.mjs) — PostEdit: katman ihlali + dongu (yol) + god-file. PostToolUse devralindi.
- [x] **Hotspot fuzyonu** — `brain hotspot` + MCP `brain_hotspot` (query/hotspot.mjs): churn × merkezilik + modul bug.
      Seffaf formul (score = churn×(1+bagimli) + 2×acik_bug). Canli kanit: schema.mjs skor 44 (21 bagimli) zirvede.
- [x] PostToolUse(Edit) graf mini-delta = **`brain check`** ile karsilandi (tek dosya katman/dongu/god).

## Sonuc (2026-06-20)
Cekirdek TESLIM: impact + hotspot + layers + check calisiyor, MCP'de acik. Tek erteleme
sembol-seviyesi call-graph (bilincli: kalite riski). Dosya-seviyesi etki analizi gercek deger veriyor.
