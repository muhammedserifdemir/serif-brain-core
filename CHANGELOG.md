# Changelog

Tüm önemli değişiklikler bu dosyada. [SemVer](https://semver.org/lang/tr/).

## [Unreleased]

### Eklendi — `plan` tipi (birinci sınıf)
- Yol haritası / faz planları için. `plans/` altına yazılır, `active` doğar, faz
  bitince `done` yapılır. `brief` çıktısında en üstte ayrı "🗺 Aktif plan"
  bölümünde gösterilir.
  Gerekçe: `init` `plans/` dizinini oluşturuyordu ama hiçbir yerde okunmuyordu;
  yol haritasını `decision` veya `record` olarak tutmak semantik olarak yanlıştı
  (plan bir iş kalemi değil, sırayı ve çıkış ölçütlerini taşıyan belge).
  Dokunulan: object.mjs (TYPE_DIR), schema.mjs (ID_RE + REQUIRED_BY_TYPE),
  object-cache.mjs (TYPE_DIRS), add.mjs (TYPE_DEFAULTS + şablon), brief.mjs.

### Eklendi — dağıtım ve kapılar
- **6 skill paketle dağıtılıyor** (`skill/`) + `serif-brain skills status|list|update`.
  Kurulum manifesti sayesinde "bayat kopya" ile "kullanıcının yerel düzenlemesi"
  ayırt ediliyor; `init` var olan dosyayı ezmiyor.
- **Claude Code hook kapısı** (`hooks/claude-gate.mjs`) — disiplin tavsiyeden
  düzenleme anında devreye giren mekanik kapıya çevrildi.
- **CANLI dashboard** — statik HTML'e ek olarak `dashboard serve|open|app`:
  süreç kontrolü, brain sorgusu, otomatik keşif. `init` bitince panel açılıyor.

### Düzeltildi — `module_paths` konfigürasyonu sessizce yok sayılıyordu
- `scan code` / `graph build` / `moduleStats` hardcoded `ownerOf()` çağırıyordu;
  `ownerOfConfigured()` yazılmıştı ama üretim yolları onu hiç kullanmıyordu.
  Sonuç: SerifX360 dışındaki her projede config'e kural yazmak **hiçbir şeyi
  değiştirmiyordu** ve yazan kişi hata görmüyordu.
- İkinci yarısı (bu tur): `impact` ve MCP `brain_impact`, grafın ham cevabını
  `node.module || ownerOfConfigured(...)` diye okuyordu. Graf eşleşmeyen dosyaya
  `"unknown"` yazar ve **`"unknown"` truthy** olduğu için fallback hiç
  çalışmazdı — kural graf kurulduktan sonra eklendiyse çıktı daima
  "modul:unknown" derdi. Yeni `resolveModule(nodeModule, relPath, config)`
  (`src/scanner/module-owner.mjs`) tek karar noktası: graf yalnızca **bilinen**
  bir modül söylüyorsa kazanır, aksi halde config. Aynı satır iki yerde
  (CLI + MCP) yaşıyordu, tek kaynağa indi.
- Ekranda görünen `modul:` satırı `computeImpact`'in ham değerinden geliyordu;
  config birleştirmesi artık CLI/MCP katmanında yapılıyor (`query/impact.mjs`
  saf kaldı — grafın cevabını verir, config bilmez).
- **Yeni kapı** `test/module-paths-kapi.test.mjs` (10 test): `buildGraph`'ın
  config'teki `module_paths`'i graf düğümlerine yansıttığını, uzun prefix'in
  kazandığını, configsiz projede eski davranışın korunduğunu ve bayat grafta
  `impact --json`'ın config'teki modülü döndürdüğünü doğrular. Hardcoded harita
  bugüne kadar hiçbir testte doğrulanmıyordu.

### Düzeltildi — kapı gürültüsü ve YAML
- `review`: "grafta yok" iki ayrı şeydi — **denetlenemedi** (graf bayat, gerçek
  sinyal) ve **kapsam dışı** (tarayıcı zaten indekslemiyor: test dosyaları,
  `.d.ts`, `scan_exclude_paths`). İkincisi için "graph build koş" demek eyleme
  dönüşmüyordu; ölçüm: serif-platform grafı 2537 düğüm, içinde 0 test dosyası →
  test yazılan her oturumda ~40 özdeş uyarı. Artık yalnız sayılıyor, öneri
  verilmiyor. Kapsam oranının paydası da düzeldi.
- `review`: kapsam etiketi — "sorun aramadım" artık "sorun yok" gibi görünmüyor.
- YAML: liste öğesindeki satır-içi nesne (`- { from: ui, to: db }`) sessizce
  bozuk kurala dönüşüyordu; tırnaklı anahtarın tırnağı soyulmuyordu (anahtarı
  VERİ olan `module_paths` gibi haritalarda sessiz hata).

### Düzeltildi — sıralama: eşitlikte karar verilmiyordu (kritik, sessiz)

`active-work.md`'nin **"Now" listesi en ESKİ kayıtları gösteriyordu.** Aynı
veriden üretilen `CLAUDE.generated.md` doğru sıralıyordu — iki farklı çıktı,
tek kaynak: en net kanıt.

**Kök neden** "yanlış sıralama" değil, **eşitlikte karar verilmemesi**:

```js
.sort((a, b) => pri(a.priority) - pri(b.priority))   // ← tek anahtar
```

Tüm kayıtlar `critical` olduğunda bu karşılaştırıcı hep `0` döner. V8'in
`sort`'u **kararlı** olduğu için eşitlikte giriş sırası korunur — o da dosya
adı sırasıdır, yani en eski kayıt başa geçer. Gözle bakınca sort doğru
görünüyordu; hata yalnızca gerçek veride ortaya çıkıyordu.

Doğru anahtar (`pinned` > öncelik > tazelik) `compile.mjs` içinde **zaten
vardı**, ama yalnız iki çağrı yeri onu kullanıyordu.

- **Yeni** `src/util/rank.mjs` — sıralamanın tek kaynağı (`compareObjects`,
  `rankObjects`, `pri`, `daysSince`). `PRIORITY_ORDER`/`pri` üç dosyada
  kopyalanmıştı, tek yere indi.
- Düzeltilen 5 çağrı yeri: `context/compile.mjs` (Now listesi + 2 preview
  listesi), `reporter/decisions.mjs`, `reporter/bugs.mjs` (2 yer).
- `summarize()` artık `pinned`'i `compact.json`'a taşıyor — `applyBudget`
  bütçeyi bu alana göre genişletiyor, düşürülürse sabitlenmiş kayıt
  kırpılabilirdi.
- **Yeni kapı** `test/rank-siralama.test.mjs` (9 test). Kritik olanı:
  eski karşılaştırıcının aynı girdide **farklı** sonuç ürettiğini doğrular —
  düzeltmenin gerçekten bir şey değiştirdiğinin kanıtı.

**Kural:** kayıt listesi sıralayan her yer `src/util/rank.mjs` kullanır;
yerel `.sort((a,b) => pri(...) - pri(...))` yazılmaz.

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
