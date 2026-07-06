# Changelog

Tüm önemli değişiklikler bu dosyada. [SemVer](https://semver.org/lang/tr/).

## [Unreleased]

### Dashboard — çok-brain yönetici paneli (`serif-brain dashboard`)
- **Yeni komut** `dashboard build|add|scan|list|archive|rm` (`src/dashboard/` + `cli/dashboard.mjs`).
  Tüm `.serif-brain` kurulu projeleri tek **statik HTML** yönetici panelinde toplar: % done halkası,
  son git aktivitesi, port, kopyalanır çalıştırma komutu, açık/biten/kritik sayıları, biten işler
  listesi, arşiv/iptal bölümü. Açık tema, sıfır bağımlılık.
- **Merkezi registry** `~/.serif-brain-registry.json` (env `SERIF_BRAIN_REGISTRY`) — izlenen brain'ler
  + kullanıcı override'ları (port/run/live/progressTarget/note/archived). Brain objelerine DOKUNMAZ.
- **Otomatik tespit** (`detect.mjs`) — port (dev script > .env, db portları ayıklanır), çalıştırma
  komutu, prereq (pg/redis), son git aktivitesi paket.json/.env/git'ten tohumlanır.
- **Status normalizasyonu** (`normalize.mjs`) — tutarsız status'lar (active/done/in-progress/...) 4
  kovaya iner (done/open/blocked/dropped); % = done/(done+open+blocked), sadece bug+decision. Tutarsız
  brain'ler için "status bakımı gerek" uyarısı + `--progress` manuel hedef override.
- 8 yeni test (`test/dashboard.test.mjs`); toplam 164 geçer.

### YAML — block scalar okuma + çok-satırlı string
- **Block scalar desteği** (`|` literal, `>` folded, chomp `-`/`+`) — `collapseBlockScalars`
  ön-geçişi block'u tek-satır quoted scalar'a indirir; çekirdek parser değişmez, her indent
  seviyesinde + nested çalışır. Block içindeki `#` yorum sayılmaz. (`test/faz20`, 9 test).
- **Çok-satırlı string serialize** — `\n`/`\r`/`\t` içeren string artık tırnaklanır (escaped),
  round-trip korunur (önceki latent açık: çok-satır tırnaksız serialize → bozuk YAML).

### Init — config şablonları (keşfedilebilirlik)
- `serif-brain init` artık config.yaml'a **yorumlu** `module_paths` / `layer_rules` /
  `bug_signatures` örnekleri yazar (parser görmez; yorumu kaldırıp doldur). Faz 2-3
  özellikleri kutudan keşfedilebilir.

### Performans — MCP obje cache'i (inceleme #2 kapatıldı)
- **`loadObjectsCached`** (`query/object-cache.mjs`) — uzun-ömürlü MCP process'inde her
  çağrıda tüm markdown'ı yeniden parse etmek yerine cache'ten döner. **Sadece-stat imza**
  (dosya sayısı + mtime + boyut) ile invalidation: ekle/sil/değiştir → otomatik tazelenir.
  **Hızlı ama asla bayat değil.** MCP server `loadObjects`'i bu sürümle alias'lar (minimal diff);
  CLI kısa-ömürlü olduğu için kullanmaz. 5 test (hit/miss + 3 invalidation senaryosu).

### Agent-UX — birleşik edit-öncesi brifing
- **`guard <dosya>`** — `touch`+`impact`+`risk`+`lint`'i TEK çıktıda toplar: verdict
  (DİKKAT/TEMİZ) + ihlal-etme kararları + açık bug + çözülmüş "yara izi" + blast-radius +
  imza eşleşmeleri. Ajan dört ayrı çağrı yerine bir çağrı (token-ucuz). **MCP `brain_guard`**.
- `query/guard.mjs` — saf `composeGuard()` + `formatGuard()` + `gatherGuard()` (query
  katmanında; mcp→cli bağımlılığından kaçınıldı). Canlı: schema.mjs → DİKKAT, 45 dosya etkilenir.

### Sağlamlaştırma — YAML parser audit
- **14 fuzz/round-trip testi** (`test/faz17`) — serialize→parse kararlılığı + adversarial probe.
  Sonuç: **sessiz veri kaybı bulunamadı**; ilk incelemenin "#1 risk" endişesi düzeltildi.
- **Fail-loud sözleşmesi teste sabitlendi:** desteklenmeyen girdi (liste-içi nested object serialize,
  tab girinti) sessizce kaybedilmez — throw eder. Regresyon koruması.
- `yaml.mjs` başlık yorumu gerçeğe göre düzeltildi ("max 2 level" → çok-seviye nesting çalışıyor).

### Faz: Bug Signatures (tamamlandı — çekirdek)
- **`lint [dosya...]`** — projeye-özel bug imza linter: config `bug_signatures` (regex +
  glob + severity) ile geçmiş hataların "şekli" yeni koda karşı taranır. Generic ESLint'in
  görmediği domain bug'ları. **MCP `brain_lint`**. `query/signatures.mjs`.
- **`risk <dosya>`** — edit-anı risk skoru: `2×churn + bağımlı + 3×modül_bug + 4×dosya_bug +
  5×imza` → low/medium/high/critical. Şeffaf ağırlıklar. **MCP `brain_risk`**. `query/risk.mjs`.
- **`cluster`** — bug'ları benzerliğe (modül/etiket/metin, union-find) göre gruplar →
  olası aynı-kök-neden kümeleri. **MCP `brain_cluster`**. `query/cluster.mjs`.
- **`review [--ref]`** — pre-commit kapı: değişen dosyalarda `check` (katman/döngü/god) +
  `lint` (imza); sorunda exit 2. `getChangedFiles()` git helper'ı.

### Faz: Symbol Graph (çekirdek tamamlandı; sembol-seviyesi call-graph ertelendi)
- **`layers`** — mimari katman ihlalleri: config `layer_rules` (`{from,to,reason}`, `*` joker)
  ile yasak import'lar (ör. `ui→db`). İhlalde exit 2. **MCP `brain_layers`**. `query/layers.mjs`.
- **`check <dosya>`** — PostEdit graf sağlığı (Active Memory'den devralındı): tek dosyada
  katman ihlali + döngü (yol ile) + god-file. **MCP `brain_check`**. `query/check.mjs`.
- _Ertelendi:_ sembol-seviyesi call-graph — kırılgan çok-dilli sembol parser'ı kalite riski;
  kendi odaklı turunu hak ediyor. impact/hotspot/layers/check dosya-seviyesinde değer veriyor.

### Faz: Symbol Graph (ilk dilim)
- **`impact <dosya>`** — canlı blast-radius: bir dosyayı değiştirirsem ne kırılır?
  Mevcut import grafı (graph.json) üzerinden geçişli bağımlı kapanışı + etkilenen
  modüller + yaprak-dosya sinyali; `touch` ile modül hafızasını çapraz-referanslar.
  Döngü-güvenli BFS. `--json`. **MCP `brain_impact`**.
- `query/impact.mjs` (saf `computeImpact`/`resolveFileNode`/`formatImpact`).
- **`hotspot`** — tehlike bölgesi füzyonu: `score = churn × (1 + bağımlı) + 2 × açık_modül_bug`.
  Git churn + import-grafı merkeziliği + modül bug yoğunluğu birleşir; şeffaf/ayarlanabilir
  ağırlıklar. churn=0 & bug=0 dosyalar elenir. **MCP `brain_hotspot`**. `query/hotspot.mjs`.
- _Sonraki:_ sembol-seviyesi call-graph, katman-ihlali kuralları, PostEdit graf-delta.

### Faz: Active Memory (tamamlandı)

### Eklendi
- **`brief`** — oturum-açılışı "neredeyiz" özeti: aktif kritik/yüksek bug + aktif
  kararlar + son dokunulan kalemler + **park (queued) faz kuyruğu** + git sinyali
  (son N günde değişen dosya/modül). `--module --days N --json --no-git`.
  SessionStart hook'unun çağıracağı temel komut.
- **MCP `brain_brief`** aracı — Claude oturum başında tek çağrıyla brief çeker (saf-hafıza).
- `query/brief.mjs` — saf `compileBrief()` + `formatBrief()` (I/O'suz, test edilebilir).
- **`touch <dosya>`** — Edit ÖNCESİ ilgili hafıza: dosyaya doğrudan bağlı + modülünün
  kararları (ihlal etme) ve bug'ları (çözülmüş "yara izi" dahil, açık olanlar önce).
  PreToolUse(Edit) hook'unun çağıracağı komut. `--module --json --limit`.
- **MCP `brain_touch`** aracı + `query/touch.mjs` (saf `compileTouch()`/`formatTouch()`).
- **`ownerOfConfigured()`** — config'teki `module_paths`'i nihayet okur (vaat edilmişti);
  en uzun prefix kazanır, yoksa hardcoded kurallara düşer (mevcut `ownerOf` korunur).
- **`capture`** — git commit'lerinden aday bug/karar **önerir** (write-back). Yüksek-precision
  sınıflama: `fix:` → çözülmüş bug, `refactor/perf:` → karar, `feat/chore/merge/release` →
  atla. Dry-run varsayılan; `--apply` yazar. Hash ile dedup (commit iki kez yakalanmaz).
  `fix` commit'leri Faz: Bug Signatures için tohum (geçmiş hata şekilleri).
- `query/capture.mjs` (saf `classifyCommit`/`proposeFromCommits`/`dominantModule`) +
  `getRecentCommits()` git helper'ı.

### Değişti
- Git aktivite helper'ları `query/git-activity.mjs`'e çıkarıldı; `stale` + `brief` + `capture` paylaşır (DRY).

### Test
- 64 → **89 test** (brief + touch + capture çekirdeği, TR-eklemeli sınıflama, prefix
  önceliği, hash dedup, modül çözümü, git sinyali, MCP brain_brief/brain_touch).

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
