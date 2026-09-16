---
id: record-20260916-2026-09-16-close-dosya-adi-id-bug-i-kapandi-dashbo
type: record
project: seriftech-packages
module: core
title: "2026-09-16: close dosya adı≠id bug'ı kapandı + dashboard sabit yol koşullu + v1.2.0 hazırlığı (CHANGELOG, RELEASE.md) — tag/push YOK"
status: done
priority: high
created_at: "2026-09-16T10:41:59.959Z"
updated_at: "2026-09-16T10:41:59.959Z"
source:
  kind: manual
  path: ""
relations:
  files:
    - src/markdown/locate.mjs
    - src/markdown/write-ops.mjs
    - src/markdown/object.mjs
    - src/cli/dashboard.mjs
    - test/close-dosya-adi-id.test.mjs
    - CHANGELOG.md
    - docs/RELEASE.md
  decisions: []
  bugs: []
  modules: [core]
tags: []
---
# 2026-09-16: close dosya adı≠id bug'ı kapandı + dashboard sabit yol koşullu + v1.2.0 hazırlığı (CHANGELOG, RELEASE.md) — tag/push YOK

# 2026-09-16 turu (yönetici oturumu görevi; commitler yerel 918571b, b3a8b99, f0be7c8; push/tag YOK)

- **close bug'ı**: dosya adı ≠ frontmatter id olan kayıt bulunamıyordu (mevzuat-ai'de 2 karar dosyasında yaşandı,
  frontmatter elle düzenlendi). Çözüm: `locate.mjs` `findByFrontmatterId`/`resolveObjectPath` — hızlı yol boşsa tip dizini
  frontmatter id ile taranır; `locateObject` gerçek yolu döner; `closeObject` bulunan dosyayı YERİNDE günceller
  (`writeObject` `{ path }`), id yoluna ikinci kopya yazmaz. 4 test önce kırmızı (1/4) → 4/4.
- **dashboard**: `~/Desktop/seriftech-packages/serif-brain-dashboard` sabit yolu `dashboardKaynagi()` ile koşullu
  (env SERIF_BRAIN_DASHBOARD_SRC > yol varsa); `varsayilanKok()` = SERIF_BRAIN_KOK > ~/Desktop (varsa) > ev.
  Temiz klonda `--help` 0, `dashboard app` boş ev dizininde hatasız (exit 0). `grep Desktop src/` → yalnız iki koşullu blok.
- **v1.2.0 hazırlığı**: CHANGELOG [1.2.0] (git log v1.1.0..HEAD, 30 commit tematik), package.json 1.2.0, docs/RELEASE.md
  (test → version → CHANGELOG → commit → tag → temiz klon doğrulama; private:true kalır). Tag ve push sahibin onayına bırakıldı.
- **Test sayısı**: 392 → 396; `belge-dogrulugu` README/README.tr/GELISTIRME-PLANI/marketing/linkedin-post'taki sayıyı
  denetliyor (4 dosya güncellendi — kapı iki kez kırmızı verdi, ikisi de doğru alarmdı).
- **Gözlem (açık soru)**: temiz klonda `doctor` exit 1 — graph/reports/context/indexes türetilmiş dizinleri gitignore'da,
  klonda yok; `context` + `analyze` sonrası durum aşağıda. Doctor'un türetilmiş dizin yokluğunu HATA saymasının doğru
  olup olmadığı sahibe soru (klon = meşru başlangıç durumu). CHANGELOG'daki eski "[Unreleased]" bloğu 2026-08-11 tarihli,
  1.1.0'dan önce — 1.1.0'a ait görünüyor, dokunulmadı.
