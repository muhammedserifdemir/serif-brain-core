---
id: decision-20260620-mcp-obje-cache-stat-imza-ile-invalidation-hizli-am
type: decision
project: seriftech-packages
module: infra
title: "MCP obje cache: stat-imza ile invalidation (hizli ama bayat degil)"
status: active
priority: low
created_at: "2026-06-20T08:56:47.960Z"
updated_at: "2026-06-20T08:56:47.960Z"
source:
  kind: manual
  path: ""
relations:
  files: []
  decisions: []
  bugs: []
  modules: [infra]
tags: [perf, mcp, cache]
---
# MCP obje cache: stat-imza ile invalidation (hizli ama bayat degil)

## Baglam
Ilk incelemede "#2: O(n) disk okuma/cagri" isaretliydi — her brain_* MCP cagrisi loadObjects()
ile TUM markdown'i yeniden parse ediyordu. Uzun-omurlu MCP process'inde bu israf + gecikme.

## Karar
`loadObjectsCached` (query/object-cache.mjs): brainRoot bazli cache + **sadece-stat imza**
(dosya sayisi + mtimeMs + boyut toplami). Imza degisirse (ekle/sil/degistir) yeniden yukle,
yoksa cache'ten don. Stat parse'tan cok ucuz → hizli; imza her degisikligi gordugu icin
asla bayat degil. MCP server `loadObjects`'i `loadObjectsCached` olarak ALIAS'lar → tum
cagri yerleri otomatik, minimal diff. CLI kullanmaz (kisa-omurlu, fayda yok).

## Sonuclari (Consequences)
- Degismemis brain'de tekrar cagrilar parse'siz → MCP "canli okuma" iddiasi gerceken hizli.
- Test (faz19): hit/miss + ekle/degistir/sil invalidation senaryolari (5 test).
- Risk: cache bayat kalirsa ajan eski hafiza gorur → imza bunu engeller (stat-only, her degisikligi yakalar).

## Reddedilen Alternatifler
- Suresiz cache (TTL/invalidation yok): bayat veri riski — ajan icin kabul edilemez.
- FS watch (chokidar vb.): bagimlilik + karmasiklik; sifir-bagimlilik felsefesine aykiri. Stat-imza yeterli.
