---
id: decision-20260620-faz-active-memory-hook-driven-just-in-time-hafiza
type: decision
project: seriftech-packages
module: infra
title: "Faz: Active Memory (hook-driven just-in-time hafiza)"
status: done
priority: high
created_at: "2026-06-20T07:23:49.921Z"
updated_at: "2026-06-20T11:00:00.000Z"
completed_at: "2026-06-20T11:00:00.000Z"
source:
  kind: manual
  path: ""
relations:
  files: []
  decisions: []
  bugs: []
  modules: [infra]
tags: [roadmap, active-memory, hooks]
---
# Faz: Active Memory (hook-driven just-in-time hafiza)

## Baglam
Bugun brain pasif bir depo: AI ajan (Claude) editlemeden once gecmis bir bug/karari
HATIRLAMAK zorunda, ama her session sifirdan basliyor → hatirlamiyor → hafizanin %80'i
bosa gidiyor. Memory ancak ajan SORARSA ise yariyor.

## Karar
Hafizayi hook'larla "tam zamaninda" ajana GETIR (ajan gitmesin):
- **SessionStart hook** → `brain brief` ciktisini otomatik context'e enjekte et
  (gecen sefer ne yapiyordun + acik kritik/yuksek bug'lar + son commit'ten beri degisen moduller).
- **PreToolUse(Edit) hook** → dosya acilinca o dosya/modulun gecmis bug'larini + bagli kararlari fisilda.
- **PostToolUse(Edit) hook** → edit sonrasi graf mini-delta (yeni cycle? god-file siserdi mi? acik kritik bug'li modul?).
- **Auto-capture (write-back)** → commit mesaji/session'dan aday bug/decision objesi oner (manuel `add` unutuluyor).

## Sonuclari (Consequences)
- Regresyon daha kod yazilmadan durur; "cozulmus problemi tekrar acma" riski biter.
- Hafiza kendiliginden dolar → bos-hafiza/olu-arac sorunu cozulur.
- Bu fazin onceligi en yuksek: davranis kazanimi performanstan once gelir.

## Reddedilen Alternatifler
- "Ajan sorsun" modeli (bugunku): unutmaya bagimli, calismiyor.
- SQLite tam FTS'e once yatirim: bu olcekte (yuzlerce obje) getiri dusuk → ERTELE.

## Ilerleme (2026-06-20)
- [x] **`brain brief`** komutu + saf `compileBrief()`/`formatBrief()` (query/brief.mjs) — aktif bug/karar + son dokunulan + park kuyrugu + git sinyali.
- [x] **MCP `brain_brief`** araci (mcp/server.mjs) — Claude oturum basinda tek cagri.
- [x] Git helper'lari `query/git-activity.mjs`'e cikarildi (stale + brief paylasir, DRY).
- [x] 16 yeni test (toplam 80 gecer); docs/USAGE.md'de opt-in SessionStart + PreToolUse hook receteleri.
- [x] **`brain touch <dosya>`** + MCP `brain_touch` (query/touch.mjs) — Edit oncesi dosya/modul karar+bug (yara izi dahil).
- [x] **`ownerOfConfigured()`** — config `module_paths`'i nihayet okur (vaat edilmisti); en uzun prefix kazanir.
- [x] **Auto-capture** — `brain capture` (query/capture.mjs): git commit → aday bug/karar, yuksek-precision, hash-dedup, dry-run/apply. fix→done bug = Bug Signatures tohumu.
- [→] PostToolUse(Edit) → graf mini-delta: **Faz: Symbol Graph'a devredildi** (canli-impact altyapisina bagimli).

## Sonuc (2026-06-20)
Cekirdek TESLIM: brief (SessionStart) + touch (PreEdit) + capture (write-back) calisiyor,
89 test gecer, MCP brain_brief/brain_touch acik, opt-in hook receteleri docs/USAGE.md'de.
PostEdit graf-delta tek acik kalem ve bilincli olarak Symbol Graph fazina baglandi.
