---
id: decision-20260620-faz-bug-signatures-gecmis-buglardan-projeye-ozel-l
type: decision
project: seriftech-packages
module: infra
title: "Faz: Bug Signatures (gecmis buglardan projeye-ozel linter)"
status: done
priority: medium
created_at: "2026-06-20T07:23:50.026Z"
updated_at: "2026-06-20T13:00:00.000Z"
completed_at: "2026-06-20T13:00:00.000Z"
source:
  kind: manual
  path: ""
relations:
  files: []
  decisions: []
  bugs: []
  modules: [infra]
tags: [roadmap, bug-signatures, linter]
---
# Faz: Bug Signatures (gecmis buglardan projeye-ozel linter)

## Baglam
Arac bugun bug'lari SAKLIYOR ama BULMUYOR. Generic ESLint senin projene ozel hata siniflarini
(Iyzico webhook imza dogrulamasi yok, yeni tabloda RLS kapali, supabase call'da eksik await) yakalayamaz.

## Karar
Gecmis bug'lari hafif, projeye-ozel bir linter'a cevir:
- **Bug signature memory** → her bug'in "seklini" kaydet; yeni kodu bu imzalara karsi eslestir.
- **Edit aninda risk skoru** → "risk 8/10: 12 kez degisti, 3 bug gordu, 2 god-file'a bagli" → dikkat kalibrasyonu.
- **Bug clustering** → graf uzerinden "bu 4 bug ayni kok neden" → kokten coz.
- **Bulasma analizi** → yuksek-bug'li modulu import eden moduller riski miras alir.
- **`brain review-diff`** → commit oncesi yapisal pre-commit: yeni cycle? orphan yarattin mi? acik kritik bug'li modul?

## Sonuclari (Consequences)
- Projeye-ozel, kendi gecmisinle beslenen bir guvenlik agi → generic arac yerine kurumsal hafiza.
- Faz sirasi: Active Memory + Symbol Graph oturduktan SONRA (ikisinin verisine dayanir).

## Reddedilen Alternatifler
- Sadece generic linter (ESLint vb.): senin domain bug'larini gormez.

## Ilerleme / Sonuc (2026-06-20)
- [x] **Bug signature linter** — `brain lint` + MCP `brain_lint` (query/signatures.mjs): config bug_signatures
      (regex + glob + severity), satir-bazli eslesme, gecersiz regex'e dayanikli. fix-commit'ler (capture) tohum.
- [x] **Edit-ani risk skoru** — `brain risk` + MCP `brain_risk` (query/risk.mjs): 2×churn + bagimli + 3×modul_bug
      + 4×dosya_bug + 5×imza → low/med/high/critical. Seffaf agirlik. Canli: schema.mjs HIGH (21 bagimli).
- [x] **Bug clustering** — `brain cluster` + MCP `brain_cluster` (query/cluster.mjs): union-find, related skoru ile
      ayni-kok-neden gruplari.
- [x] **review-diff** — `brain review` (cli/review.mjs): degisen dosyalarda check (katman/dongu/god) + lint (imza),
      exit 2. getChangedFiles() git helper.
- [~] Bulasma analizi (yuksek-bug modulu import edenler) — risk skoru modul-bug sinyali ile kismen karsilandi; tam graf-yayilimi ileride.
- Sonuc: projeye-ozel, kendi gecmisinle beslenen guvenlik agi CALISIYOR. Generic linter degil, kurumsal hafiza.
