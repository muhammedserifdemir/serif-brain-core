# serif-brain-core → Dünya Klasmanı Yol Haritası

Onaylanan plan (2026-06-17). Kapsam: **tüm fazlar sırayla**. Felsefe: **saf-Node, sıfır bağımlılık** (js-yaml/MCP-SDK yok — YAML elle sağlamlaştırılır, MCP saf-Node yazılır). Branch: `feat/world-class`.

Mevcut başlangıç: ~65/100 (~6800 satır, sıfır bağımlılık ESM). Dört alt-sistem derinlemesine incelendi.

## Faz 0 — Tanı dürüstlüğü & veri bütünlüğü ✅ TAMAM (commit f8b5f25)
- [x] `validate` komutu — parse/şema hatalarını dosya YOLU + neden ile listeler, exit 1 (CI dostu)
- [x] doctor 3b — hatalı dosyaları isim+neden ile listeler (önceden yalnız sayaç)
- [x] severity enum bug fix (`valid_severity`, geriye-uyumlu)
- [x] init config şablonuna `valid_severity`
- Doğrulama: edux brain'inde 5 gizli hatalı dosya anında isimlendirildi.

## Faz 1 — Graf/scanner doğruluğu ✅ TAMAM (commit <faz1>)
- [x] **tsconfig/jsconfig alias resolver DÜZELTİLDİ** — `require`→readFileSync (ESM bug: paths daima boş geliyordu) + string-farkında JSONC sıyırıcı (glob'lı tsconfig'i bozmaz) + baseUrl + jsconfig fallback → **edux: unresolved 866→1, orphan 132→24**
- [x] Orphan entry-point tespiti genişletildi + config-driven (`entrypoint_patterns`): global-error/instrumentation/i18n-request/*.config/*.worker/e2e/template/default/+server
- [x] Otomasyon vs küratörlü ayrımı (`automation_id_patterns`, vars. `-bridge-`) → stale/owner sinyalinden dışlanır + ayrı sayılır
- [x] Config-driven analiz eşikleri (god/stale/too-many/high-risk/many-open)
- [x] YAML inline-object `{ }` desteği → edux parse hatası 1→0
- [x] 5 regresyon testi (tsconfig-glob, alias, jsconfig, inline-object)
- [ ] (ertelendi) monorepo packages/* + module_paths config + INCLUDED_EXTS config — düşük öncelik (alias'lar artık çözülüyor)

## Faz 2 — Arama & AI entegrasyonu ✅ TAMAM (commit <faz2>)
- [x] `search` komutu — yapısal filtre (type/status/priority/module/tag/owner/since) + tam-metin (başlık ağırlıklı skor) + --json
- [x] **MCP sunucusu (saf-Node, JSON-RPC/stdio)** — brain_search/brain_get/brain_context; Claude Code brain'i CANLI okur (docs/MCP.md)
- [x] Arama çekirdeği (src/query/search.mjs) — CLI + MCP ortak kullanır; recency+priority skor
- [x] 10 test (arama filtreleri + MCP protokolü)
- [~] Zengin context: toResult snippet + brain_context aktif-iş özeti var; compile.mjs gövde/backlink zenginleştirme ertelendi (opsiyonel)
- [~] SessionStart auto-context: MCP brain_context bunu on-demand sağlıyor (statik dump'tan iyi); hooks planı zaten `context` SessionStart öneriyor

## Faz 3 — Güvenilirlik & dağıtım ✅ TAMAM (commit <faz3>)
- [x] Hardcoded path'ler kaldırıldı — plan.mjs SBC_BIN (import.meta'dan türetilir) + skill yolları/doctor legacy kaynakları/init archive (homedir) → taşınabilir
- [x] Test kapsamı genişletildi: 12 → **34 test** (yaml round-trip/scanner/analyze/resolver/search/MCP); 3 → 6 test dosyası
- [x] CI: `.github/workflows/ci.yml` (Node 22+24, node --test + doctor + CLI smoke)
- [x] README.md (kurulum, komut tablosu, MCP, mimari) + sürüm 0.1.0 → 0.2.0
- [ ] (ertelendi) artımlı tarama/index cache — build ~200ms, darboğaz değil; ileride

## Faz 4 — Hijyen otomasyonu + Obsidian/Graphify'ı geçme ✅ TAMAM (commit <faz4>)
- [x] **`related` — bağlantı ÇIKARIMI**: objeler arası otomatik keşfedilen ilişkiler
  (paylaşılan modül/etiket + metin benzerliği, gerekçeli). Obsidian'ın elle `[[link]]`'inin
  aksine sistem bağlantıyı kendi bulur (Graphify'ın inferred-edge'i gibi, hafıza objelerinde).
- [x] MCP `brain_related` aracı — AI bilgi ağında elle link olmadan gezinir.
- [x] **`prune` — hijyen otomasyonu**: stale + otomasyon churn'ünü bulur; dry-run default,
  `--apply` ile `.serif-brain/archive/`'a GÜVENLE TAŞIR (silmez) + manifest + index yeniler.
  (Bridge gürültüsünü elle temizlemek yerine tek komutla, geri alınabilir.)
- [x] 5 test (related skorlama/sıralama/limit).

---
## TAMAMLANDI — neden Obsidian + Graphify'ı geçiyor
- **Obsidian'ın ötesi**: kod-farkındalık (obje↔kod grafı), şema doğrulama, otomatik
  bağlantı çıkarımı (related), CLI otomasyonu, MCP ile AI entegrasyonu, sağlık analizi.
- **Graphify'ın ötesi**: kod+hafıza birleşik graf + 11 mimari bulgu + doğru import
  çözümleme + canlı sorgulanabilir (search/MCP), salt rapor değil.
- Saf-Node, sıfır bağımlılık; 39 test; CI; taşınabilir. v0.3.0.

---
Doğrulanan gerçek bug'lar (denetimden): doctor dosya-adı vermiyordu (✅ düzeldi), severity yanlış enum (✅ düzeldi), 3 dosyada hardcoded path (Faz 3), inline-object parse hatası (Faz 1).
