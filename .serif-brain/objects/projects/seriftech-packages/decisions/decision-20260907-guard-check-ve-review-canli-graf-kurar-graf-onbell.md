---
id: decision-20260907-guard-check-ve-review-canli-graf-kurar-graf-onbell
type: decision
project: seriftech-packages
module: query
title: "Guard, check ve review CANLI graf kurar; graf onbellegi iki kademeli (mtime+boyut, sonra icerik ozeti)"
status: active
priority: medium
created_at: "2026-09-07T09:42:08.890Z"
updated_at: "2026-09-07T09:42:08.890Z"
source:
  kind: manual
  path: ""
relations:
  files:
    - src/query/guard.mjs
    - src/cli/check.mjs
    - src/cli/review.mjs
    - src/graph/build.mjs
    - src/mcp/server.mjs
  decisions: []
  bugs: []
  modules: [core]
tags: [graf, hook, performans]
---
# Guard, check ve review CANLI graf kurar; graf onbellegi iki kademeli (mtime+boyut, sonra icerik ozeti)

## Karar

`check`, `review`, `guard` (CLI + MCP + hook) kayitli `graph.json` yerine guncel kaynaktan graf kurar. `--snapshot` bayragi kayitli grafi okumak icin kalir. `impact`/`layers` rapor komutlari snapshot'ta.

## Neden

- Temiz kayitli graf + sonradan eklenen yasak import → eski `check`/`review`/`brain_check` HIC yakalamiyordu (hardening testi bunu kanitlar).
- PreToolUse `guard` kayitli grafi (animatorx'te 25 gunluk), PostToolUse `check` canli grafi konusuyordu — ayni oturumda iki gercek.

## Bedel ve onbellek karari

Her kurulumda tum dosyalari okuyup SHA-256 ozetlemek (ilk surum) serif-platform'da (2.295 dosya, 18 MB) okuma 48–260 ms + ozet 21 ms ek gecikme olctu; HEAD ikisini de atliyordu. Hook her duzenlemede kostugu icin iki kademe secildi: (1) mtime+boyut ayni → dosya okunmaz; (2) mtime degisti, icerik ayni → ozet eslesir, parse tekrarlanmaz. Bilincli sinir: mtime ve boyutu korunarak degistirilen dosya (cp -p / utimes) gorulmez.

## Kaynak

Bu turun geri kalani (panel Host/Origin/JSON kontrolu, git argv, atomik yazma, surec grubu, alt-klasor brain icin `--relative`, kapali kayda not eklerken durum korunur) GPT Astra tarafindan 2026-09-05'te yazildi; 2026-09-07'de bagimsiz incelendi, olculdu ve tamamlandi. Ayrinti: docs/GELISTIRME-PLANI.md.
