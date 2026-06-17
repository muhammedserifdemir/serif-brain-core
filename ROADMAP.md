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

## Faz 2 — Arama & AI entegrasyonu (en büyük yetenek boşluğu)
- [ ] `search` komutu (yapısal sorgu + tam-metin)
- [ ] MCP sunucusu (saf-Node, JSON-RPC/stdio) — search/context/query Claude Code'a
- [ ] Zengin context (gövde/özet + backlink + recency skorlama)
- [ ] SessionStart hook → otomatik context

## Faz 3 — Güvenilirlik & dağıtım
- [ ] Hardcoded path'leri kaldır (plan.mjs:8, doctor.mjs, init.mjs)
- [ ] Test kapsamı %5 → %70+ (yaml/migrate/ingest/graph/scanner)
- [ ] CI (GitHub Actions test+lint) + semver + README
- [ ] Performans: artımlı tarama/index cache (mtime hash)

## Faz 4 — Hijyen otomasyonu
- [ ] `prune`/`gc` — stale + otomasyon objelerini güvenli arşivle

---
Doğrulanan gerçek bug'lar (denetimden): doctor dosya-adı vermiyordu (✅ düzeldi), severity yanlış enum (✅ düzeldi), 3 dosyada hardcoded path (Faz 3), inline-object parse hatası (Faz 1).
