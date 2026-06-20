---
id: decision-20260620-guard-edit-oncesi-4-araci-tek-cagriya-birlestir-to
type: decision
project: seriftech-packages
module: infra
title: "guard: edit-oncesi 4 araci tek cagriya birlestir (token verimi)"
status: active
priority: medium
created_at: "2026-06-20T08:52:39.919Z"
updated_at: "2026-06-20T08:52:39.919Z"
source:
  kind: manual
  path: ""
relations:
  files: []
  decisions: []
  bugs: []
  modules: [infra]
tags: [agent-ux, guard, consolidation]
---
# guard: edit-oncesi 4 araci tek cagriya birlestir (token verimi)

## Baglam
Bir dosyayi editlemeden once ajanin (Claude) ihtiyaci: ihlal etmemesi gereken kararlar +
gecmis bug'lar + blast-radius + bilinen kotu desenler. Bunlar ayri araclarda: touch, impact,
risk, lint. Dort ayri MCP cagrisi = dort tur + dort kez context tuketimi.

## Karar
**`guard <dosya>`** + MCP `brain_guard`: dort sinyali TEK cagrida toplayip birlesik bir
verdict (DIKKAT/TEMIZ) + ozet uretir. Mimari: `composeGuard` SAF besteci (alt-sonuclari
alir), `gatherGuard` sinyalleri toplar — ikisi de query/guard.mjs'te (mcp→cli bagimliligindan
kacinildi; aksi halde kendi `layers`/`check` aracim bunu flag'lerdi).

## Sonuclari (Consequences)
- Ajan icin edit-oncesi an: 4 cagri → 1 cagri (token + tur verimi). En cok kullanacagim arac.
- touch/impact/risk/lint hala ayri ayri var (ayrinti gerektiginde); guard onlari besteler, cogaltmaz.
- Canli: schema.mjs → DIKKAT, 45 dosya etkilenir, risk HIGH.

## Reddedilen Alternatifler
- Dort araci ayri birakmak: ajan-UX'i icin pahali (4× round-trip).
- guard'i cli katmaninda birlestirmek: mcp→cli bagimliligi yaratir → query'de tutuldu.
