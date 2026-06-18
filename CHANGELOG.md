# Changelog

Tüm önemli değişiklikler bu dosyada. [SemVer](https://semver.org/lang/tr/).

## [1.0.0] — 2026-06-18 — "Dünya klasmanı"

Bağımsız proje hafızası + bilgi ağı + kod graf analizi. Saf-Node, sıfır bağımlılık.
Obsidian + Graphify'ın ötesine geçen ilk kararlı sürüm.

### Eklendi
- **`search`** — yapısal (type/status/priority/module/tag/owner/since) + tam-metin arama (`--json`).
- **`mcp`** — saf-Node JSON-RPC/stdio MCP sunucusu. Araçlar: `brain_search`, `brain_get`,
  `brain_context`, `brain_related`. Claude Code hafızayı canlı sorgular (`docs/MCP.md`).
- **`related`** — objeler arası OTOMATİK bağlantı çıkarımı (modül/etiket/metin benzerliği).
  Obsidian'ın elle `[[link]]`'inin aksine sistem ilişkiyi kendi bulur.
- **`validate`** — şema doğrulama; hatalı dosyaları yol+neden ile listeler, exit 1 (CI dostu).
- **`prune`** — stale + otomasyon churn objelerini güvenle arşivler (dry-run; `--apply`).
- Artımlı tarama cache'i (mtime+size) — sıcak build ~6.5x hızlı (`cache_hits`).
- Monorepo workspace paket çözümleme (`packages/*` → kaynak).
- Config-driven graf analizi: `entrypoint_patterns`, `automation_id_patterns`, eşikler.
- CI (GitHub Actions, Node 22+24), README, docs/MCP.md, ROADMAP.

### Düzeltildi
- **Kritik:** `loadTsconfigPaths` ESM'de `require` çağırıyordu → tüm `@/` alias import'ları
  çözülemiyordu. readFileSync + string-farkında JSONC sıyırıcı (glob'lı tsconfig'i bozmaz) +
  baseUrl + jsconfig. Etki (edux): unresolved import 866→1, orphan 132→24.
- `doctor` artık parse/şema hatalarını **dosya yolu + neden** ile listeler (önceden yalnız sayaç).
- Bug `severity` ayrı enum (`valid_severity`); önceden daima `valid_priority` kullanılıyordu.
- YAML parser inline-object `{ }` desteği (parse hataları giderildi).
- Orphan tespiti framework giriş-noktalarını tanır (global-error/instrumentation/worker/...).
- Tüm hardcoded makine yolları kaldırıldı (import.meta + homedir) → taşınabilir.

### Test
- 12 → **64 test** (yaml/scanner/analyze/resolver/search/mcp/related/migrate/ingest/backlinks/
  monorepo/cache).

## [0.1.x] — başlangıç
- Faz 2-8 iskelet: init/doctor/add/close/stale/graph/migrate/analyze/context/hooks.
