# serif-brain-core

Bağımsız **proje hafızası + bilgi ağı + kod graf analizi** sistemi. Obsidian /
Graphify / eski Brain runtime bağımlılığı yok. **Saf Node.js, sıfır npm bağımlılığı**
(Node ≥ 22.5 — `node:sqlite` + native test runner).

Proje kararları, bug'ları, notları ve oturumları Markdown objeleri olarak tutar;
kod tabanını tarayıp import/dosya/modül grafı çıkarır; ikisini birleştirip mimari
sağlık + hafıza analizi üretir. **MCP sunucusu** sayesinde Claude Code hafızayı
canlı sorgular.

## Kurulum

```bash
# Klonla (veya seriftech-packages monorepo'sunda)
node ./bin/serif-brain.mjs --help
# İsteğe bağlı global alias:
alias serif-brain='node /yol/serif-brain-core/bin/serif-brain.mjs'
```

## Hızlı başlangıç

```bash
serif-brain init                 # bir projede .serif-brain/ oluştur
serif-brain doctor               # sistem + şema sağlığı (hatalı dosyaları listeler)
serif-brain validate             # objeleri şemaya göre doğrula (CI dostu, exit 1)
serif-brain add decision --title "RLS kullan" --module infra
serif-brain graph build && serif-brain graph report   # kod graf + mimari analiz
serif-brain search "auth flow" --type decision        # hafızada arama
serif-brain context              # aktif iş bağlamı (Claude için)
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `init` | `.serif-brain/` yapısını + config.yaml oluşturur |
| `doctor` | Runtime/şema/graf/backlink sağlığı; **hatalı dosyaları yol+neden ile listeler** |
| `validate` | Objeleri şemaya göre doğrula; hata varsa exit 1 (`--warnings`, `--project_id`) |
| `add` | `add bug` / `add decision` |
| `close` | Bug/decision kapat (status + completed_at + opsiyonel commit/note) |
| `stale` | Açık kalemleri son commit aktivitesine göre tara |
| `rebuild-indexes` | Tüm indexleri yeniden üret |
| `search` | Yapısal + tam-metin arama (`--type --status --priority --module --tag --json`) |
| `mcp` | MCP sunucusu (stdio) — Claude Code entegrasyonu (bkz. `docs/MCP.md`) |
| `scan code` | Dosya/import/TODO tarayıcı |
| `graph build\|report\|viewer` | Kod grafı + 11 mimari bulgu + etkileşimli HTML görüntüleyici |
| `analyze` | Tüm raporlar (health/bugs/decisions/architecture/...) |
| `context` | Claude bağlamı üret (`--module`) |
| `migrate` | Legacy YAML/Obsidian/Graphify ingest (dry-run/apply) |
| `hooks` | Hook migration plan/apply |

## MCP (AI entegrasyonu)

`serif-brain mcp` saf-Node JSON-RPC/stdio sunucusu açar; `brain_search`,
`brain_get`, `brain_context` araçlarını sunar. Claude Code `.mcp.json` kurulumu
ve test reçetesi için **[docs/MCP.md](docs/MCP.md)**.

## Mimari

```
src/
  cli/        komut yönlendirici + her komut
  markdown/   obje modeli, YAML parser/serializer, şema, index, backlink
  scanner/    dosya tarama, import parse/çözümleme, modül sahipliği
  graph/      graf inşa, 11-bulgu analiz, serialize, HTML viewer
  query/      arama çekirdeği (search/MCP ortak)
  mcp/        MCP sunucu çekirdeği (JSON-RPC)
  reporter/   analiz raporları
  migrate/ ingest/  legacy göç hattı
  doctor/     sağlık tanısı
  store/      engine tespiti (node:sqlite | jsonl)
```

Veri kaynağı = `.serif-brain/objects/projects/<proje>/<tip>s/<id>.md` (Markdown +
YAML frontmatter). Indexler/graf/raporlar türetilmiştir.

## Geliştirme

```bash
node --test test/*.test.mjs      # testler (sıfır bağımlılık)
```

Yol haritası: [ROADMAP.md](ROADMAP.md). Felsefe: **saf-Node, sıfır bağımlılık**;
YAML elle sağlamlaştırıldı, MCP saf-Node yazıldı.

## Lisans
UNLICENSED — © Muhammed Serif Demir / Seriftech.
