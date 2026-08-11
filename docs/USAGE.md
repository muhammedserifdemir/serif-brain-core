# serif-brain — Kullanım Kılavuzu (Claude + insan için)

Bu kılavuz **brain'in nasıl çalıştığını** ve **bir projede nasıl kullanılması
gerektiğini** anlatır: yeni proje başlangıcı, devam eden projede her oturum, ve
aynı brain'i birden çok Claude'un eşzamanlı kullanması.

> Felsefe: brain **pasif bir depo değil, projenin kurumsal hafızasıdır.** Kararlar,
> bug'lar, notlar TEK gerçek kaynak olarak `.serif-brain/objects/.../*.md` içinde
> tutulur. Graf / raporlar / indexler bundan TÜRETİLİR (silinebilir, yeniden üretilir).

---

## 0. Zihinsel model (30 saniye)

```
.serif-brain/
  config.yaml          ← sema: geçerli module/status/priority listeleri
  objects/projects/<proje>/{bugs,decisions,notes,sessions}/<id>.md   ← GERÇEK KAYNAK
  graph/  reports/  indexes/  context/   ← TÜRETİLMİŞ (analyze yeniden üretir)
```

- **Object** = bir bug / decision / note / session. Markdown + YAML frontmatter.
- **status akışı:** `queued → open/active → in_progress → blocked → done/rejected/archived`
- `done/rejected/archived` olanlar Claude'un aktif context'ine GİRMEZ (gürültü olmasın).
- `queued` = "gelecek faz backlog'u" — park edilmiş, kaybolmamış fikir.

---

## 1. YENİ proje başlangıcı (bootstrap)

Sırayla, bir kez:

```bash
# 1) Brain iskeletini kur (.serif-brain/ + config.yaml)
serif-brain init --project_id <proje>      # cwd'de çalıştır

# 2) config.yaml'ı projeye uyarla
#    valid_modules → projenin gerçek modülleri (auth, billing, infra, ...)
#    projects → aktif proje id'si doğru mu?

# 3) Kodu tara + grafı kur (mimari resmi çıkar)
serif-brain scan code
serif-brain graph build
serif-brain graph report      # 11 mimari bulgu: orphan, cycle, god-file, high-risk modül...

# 4) Sağlık kontrolü
serif-brain doctor            # runtime + şema + graf + backlink sağlığı
```

Sonra **ilk hafızayı tohumla** — projenin zaten verilmiş kararlarını kaydet ki
sıfırdan başlamayalım:

```bash
serif-brain add decision --title "RLS ile multi-tenant izolasyon" --module infra --priority high
serif-brain add decision --title "Auth: Seriftech-ID merkezi" --module auth
# Mevcut bilinen bug'lar:
serif-brain add bug --title "Webhook imza doğrulaması yok" --module billing --priority critical
```

> İpucu: `add` bir şablon gövde yaratır; objeyi açıp `## Baglam / ## Karar /
> ## Sonuclari` bölümlerini doldur. Boş kararın hafıza değeri düşüktür.

---

## 2. DEVAM EDEN projede her oturum (asıl döngü)

Bu, günlük ritim. Her Claude oturumu şöyle açılıp kapanmalı:

### Oturum AÇILIŞI — "neredeyiz?"
```bash
serif-brain context                 # aktif kritik/yüksek bug + aktif kararlar (önceliğe göre)
serif-brain context --module <X>    # sadece o modüle odaklanıyorsan
serif-brain stale --days 14         # son commit aktivitesine göre bayatlamış açık kalemler
```
MCP kuruluysa Claude bunu CLI'sız yapar: `brain_context`, `brain_search`, `brain_get`.

### Çalışırken — "hatırla, çakışma"
```bash
serif-brain search "auth flow" --type decision     # geçmişte ne karar verdik?
serif-brain related <id>                            # bu objeye otomatik bağlı objeler
```
Bir şeyi değiştirmeden önce `search` + `related` ile **çözülmüş bir kararı geri
açmadığından** emin ol. Bu, regresyonun bir numaralı önleyicisi.

### İş bitince — "yaz, kapat"
```bash
serif-brain add bug --title "..." --module <X> --priority high   # yeni bulunan sorun
serif-brain add decision --title "..." --module <X>              # verilen yeni karar
serif-brain close <id> --note "şu commit'le çözüldü"             # status flip + completed_at
serif-brain rebuild-indexes                                      # indexleri tazele
```

### Faz SINIRINDA — park kuyruğunu boşalt
```bash
serif-brain search --status queued        # mevcut iş bitti; sıradaki faz ne?
```
Yeni dal/fikir geldikçe işi bölmeden `--status queued` olarak park edilir; ancak
faz bitince birlikte gözden geçirilip sıradaki seçilir. (DEHB-dostu iş hattı.)

### Periyodik bakım
```bash
serif-brain analyze         # tüm raporları yeniden üret (health/bugs/architecture/...)
serif-brain validate        # şema ihlallerini yol+neden ile listele (CI dostu, exit 1)
serif-brain prune --apply   # bayat + otomasyon-churn objeleri güvenle arşivle
```

---

## 3. MCP ile Claude entegrasyonu (önerilen kullanım)

CLI yerine Claude'un brain'i **canlı** okuması için projeye `.mcp.json` ekle
(bkz. [MCP.md](MCP.md)). Araçlar: `brain_search`, `brain_get`, `brain_context`,
`brain_related`. Böylece Claude her oturumda `context`'i kendisi çeker.

### Oturum-açılışı otomatiği (opt-in hook)

`brain brief` komutu **Faz: Active Memory**'nin ilk parçasıdır: tek çağrıda aktif
bug/karar + son dokunulan + park kuyruğu + git sinyali verir. Bunu Claude'a her
oturum başında otomatik enjekte etmek için ilgili projenin `.claude/settings.json`
dosyasına SessionStart hook'u ekle (proje-bazlı, opt-in — global'e koyma):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/muhammedserifdemir/Desktop/seriftech-packages/serif-brain-core/bin/serif-brain.mjs brief --project ."
          }
        ]
      }
    ]
  }
}
```

`brief` brain yoksa sessizce çıkar (oturumu bozmaz). Böylece her oturum "neredeydik +
sırada ne var" ile açılır; sen sormak zorunda kalmazsın.

### Edit-öncesi fısıltı (opt-in hook)

`brain touch <dosya>` Edit'ten önce o dosya/modüle dair hafızayı verir: doğrudan
bağlı kayıtlar + modül kararları (ihlal etme) + bug'lar (çözülmüş "yara izi" dahil).
PreToolUse(Edit) hook'una bağlandığında, sen bir dosyayı açar açmaz uyarı gelir:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/muhammedserifdemir/Desktop/seriftech-packages/serif-brain-core/bin/serif-brain.mjs touch \"$CLAUDE_TOOL_FILE_PATH\" --project ."
          }
        ]
      }
    ]
  }
}
```

İlgili kayıt yoksa "temiz" der (gürültü yok). Modül eşlemesi için projenin
`.serif-brain/config.yaml`'ına `module_paths` ekleyebilirsin:

```yaml
module_paths:
  "src/auth/": auth
  "packages/billing/": billing
```

### Auto-capture — hafıza kendiliğinden dolsun

`add`'i unutmak hafızanın bir numaralı düşmanı. `brain capture` git commit'lerinden
aday bug/karar **önerir** (yazmaz):

```bash
serif-brain capture --days 7            # son 7 günün commit'lerinden aday öner (dry-run)
serif-brain capture --days 7 --apply    # adayları gerçekten obje olarak yaz
```

Yüksek-precision: `fix:` → çözülmüş bug ("yara izi"), `refactor/perf:` → karar;
`feat/chore/merge/release` atlanır. Yakalanan commit hash'i objeye yazılır → aynı
commit iki kez yakalanmaz. İstersen iş sonu / SessionEnd hook'una `capture --apply`
bağlanabilir; ama insan onayı istiyorsan dry-run bırak, gözden geçirip elle uygula.

> Sıradaki (Faz: Symbol Graph üstüne kurulacak): PostToolUse(Edit) → graf mini-delta
> (edit yeni cycle/god-file yarattı mı?). Canlı-impact altyapısına bağımlı.

---

## 4. Aynı brain'i birden çok Claude kullanıyorsa — sorun çıkar mı?

**Kısa cevap: hayır, mevcut kullanım güvenli — çünkü tasarım buna uygun.** Nedenleri
ve dikkat edilecek tek-iki nokta:

**Neden güvenli:**
- **Okuma her zaman güvenli.** MCP/`search`/`context` objeleri her çağrıda diskten
  taze okur; paylaşılan değişken durum yok. Kaç Claude okursa okusun çakışmaz.
- **Yazma çakışmaz.** Her `add` **id-bazlı ayrı bir dosya** yazar (`writeFileSync`),
  hepsi aynı dosyaya değil. Üstüne, id çakışırsa `add` otomatik `-2` suffix önerir
  (overwrite koruması). İki Claude aynı anda farklı obje eklerse sorun yok.
- **SQLite kilidi YOK.** Önemli: `brain.db` aslında obje deposu DEĞİL — store engine
  sadece `:memory:` smoke-test yapıyor; gerçek kaynak markdown dosyaları. Yani
  "iki process aynı DB'yi kitledi" sınıfı bir sorun bu mimaride yok.

**Tek gerçek dikkat noktaları:**
1. **Türetilmiş veri yarışı (düşük etki, kendiliğinden iyileşir).** İki Claude aynı
   anda `rebuild-indexes`/`graph build` çalıştırırsa index/graf anlık tutarsız
   olabilir; bir sonraki çalıştırma düzeltir. Türetilmiş veri zaten silinip yeniden
   üretilebilir — kalıcı bozulma değil. Çözüm: index üretimini tek Claude'a bırak
   ya da iş sonunda bir kez çalıştır.
2. **Kodu GELİŞTİRİRKEN (src/ değişikliği) çalışan MCP'ler eski kodu kullanır.**
   MCP sunucusu uzun-ömürlü bir Node process'i; `src/` editlemen onu hot-reload
   ETMEZ. Yani değişiklik çalışan Claude'ları **bozmaz**, ama onlar **eski sürümü**
   çalıştırmaya devam eder. Yeni davranış için MCP sunucusunu yeniden başlat.
3. **MCP araç sözleşmesini bozma.** Araç adlarını (`brain_search`...) veya çıktı
   şeklini değiştirirsen, restart sonrası mevcut Claude'ların beklentisi şaşar.
   Kural: **ekleme yap (additive), bozma.** Yeni araç ekle, mevcudu kırma. Şema
   değişirse `schema_version`'ı yükselt.

**Sonuç:** brain'i geliştirmek şu an çalışan Claude'lar için risksiz; veri ekleme
(bizim 3 faz kararı gibi) sıfır risk. Yalnızca (a) kod değiştirince MCP'leri
restart et, (b) MCP araç sözleşmesini geriye-uyumlu tut, (c) ağır index üretimini
tek yazıcıda topla.

---

## 4.5 Bug yakalama & graf analizi (Faz 2-3)

Bunlar `graph build` çıktısını + git'i + hafızayı birleştirir. Çekirdek refleksler:

```bash
serif-brain brief                       # oturum açılışı: neredeyiz + park kuyruğu
serif-brain guard src/auth/login.ts     # edit ÖNCESİ TEK ÇAĞRI: touch+impact+risk+lint birleşik
serif-brain touch src/auth/login.ts     # (guard bileşeni) bu dosya/modülün kararları + bug'ları
serif-brain impact src/query/search.mjs # "değiştirirsem ne kırılır?" blast-radius
serif-brain hotspot --days 30           # tehlike bölgesi: churn × merkezilik + bug
serif-brain risk src/billing/iyzico.ts  # tek dosya edit-anı risk skoru
serif-brain layers                      # mimari katman ihlalleri (config gerekir)
serif-brain check src/x.ts              # edit SONRASI: döngü/god/katman bozdun mu?
serif-brain lint                        # projeye-özel bug imza taraması (config gerekir)
serif-brain cluster                     # bug'ları aynı-kök-neden gruplarına ayır
serif-brain review                      # commit ÖNCESİ: değişen dosyalarda check+lint
serif-brain capture --days 7            # commit'lerden aday bug/karar (write-back)
```

### Config (`.serif-brain/config.yaml`)

`layers` ve `lint` kural ister. `module_paths` modül eşlemesini iyileştirir:

```yaml
module_paths:                # dosya yolu → modül (en uzun prefix kazanır)
  "src/ui/": ui
  "src/db/": db

layer_rules:                 # mimari kısıtlar; ihlal = review/layers exit 2
  - { from: ui, to: db, reason: "UI veriye doğrudan dokunmasın, servis katmanı kullan" }

bug_signatures:              # geçmiş hataların 'şekli' → projeye-özel linter
  - name: rls-eksik
    pattern: "create table"
    message: "Yeni tabloda RLS politikası tanımlandı mı?"
    severity: high
  - name: supabase-await
    pattern: "(?<!await )supabase\\.(from|rpc)\\("
    message: "supabase çağrısında await eksik olabilir"
    severity: high
    glob: "src/**/*.ts"
```

> Akış: `brief` (açılış) → `touch`/`impact`/`risk` (edit öncesi) → `check` (edit sonrası)
> → `review` (commit öncesi) → `capture` (iş sonu). `hotspot`/`cluster`/`layers` periyodik.

## 5. Komut refleksleri (özet tablo)

| Ne zaman | Komut |
|---|---|
| Yeni proje | `init` → `scan code` → `graph build` → `graph report` → `doctor` |
| Oturum açılışı | `brief` (veya `context`) + `stale` |
| **Edit öncesi (tek çağrı)** | **`guard <dosya>`** = touch+impact+risk+lint birleşik |
| Edit öncesi (ayrıntı) | `touch` · `impact` · `risk` (guard'ın bileşenleri) |
| Edit sonrası | `check <dosya>` |
| Karar/bug ararken | `search "<metin>" --type ...`, `related <id>` |
| Yeni kayıt | `add bug\|decision`, kapatırken `close <id>` |
| Commit öncesi | `review` |
| İş sonu | `capture`, `rebuild-indexes`, gerektikçe `analyze` |
| Risk taraması | `hotspot`, `lint`, `cluster`, `layers` |
| Faz sınırı | `search --status queued` → sıradakini seç |
| Bakım/temizlik | `validate`, `prune --apply`, `doctor` |

---

## 6. Altın kurallar

1. **Önce oku, sonra yaz.** Değiştirmeden önce `context` + `search` — çözülmüş kararı geri açma.
2. **İş bitince hemen kaydet.** Hafıza ancak doldurulursa yaşar; sonraya bırakma.
3. **Türetilmiş veriyi kutsal sayma** — `graph/ reports/ indexes/` her an `analyze` ile yeniden üretilir.
4. **`done/rejected/archived` gürültüyü context dışına atar** — kapatmayı ihmal etme.
5. **Fikri park et, dal açma** — yeni özellik fikri `--status queued`, mevcut faz kilitli.
6. **Kod değişince MCP'yi restart et, araç sözleşmesini bozma.**

## Kapı (otomatik çalışan kısım)

Aşağıdaki komutları elle çalıştırmak zorunda değilsiniz — `serif-brain init`
Claude Code kapısını kurar ve şunlar kendiliğinden çalışır:

| Ne zaman | Ne çalışır | Ne görürsünüz |
|---|---|---|
| Oturum açılışı | `brief` | aktif plan/bug/karar + son bakıştan beri olanlar + hafızaya geçmemiş commit'ler |
| Edit/Write **öncesi** | `guard <dosya>` | o dosyanın kararları, yara izleri, imza eşleşmeleri, blast-radius |
| Edit/Write **sonrası** | `check <dosya>` | katman ihlali, döngü, god-file |
| "Bitti" demeden önce | `review` | değişen dosyalarda bulgular + kapsam etiketi |

Kapı **söyleyecek şey yoksa susar**, ve **söylediğini bir daha söylemez** (aynı
metin ikinci kez üretilmez — aksi hâlde durma denemesi döngüye girer).

Durum: `serif-brain hooks status` · Kurulum: `serif-brain hooks install --apply`

Global (`~/.claude/settings.json`) kurulum tüm projeleri kapsar; proje-düzeyi
kurulum yalnız o projeyi. İkisi birden kurulursa kapı iki kez konuşur —
`hooks status` bunu "(global ayardan)" diye işaretler ve `install` ikinci kaydı
açmaz.

## Diğer komutlar

| Komut | Ne zaman |
|---|---|
| `serif-brain skills status\|update --apply` | paketle gelen disiplin skill'lerini projeye taşı/güncelle |
| `serif-brain dashboard serve` | tüm brain'li projeleri tek panelde gör (durum, port, çalıştırma) |
| `serif-brain add plan --title "..."` | faz planı / yol haritası (`brief` çıktısında en üstte durur) |
| `serif-brain capture --days 14 --apply` | commit'lerden hafızaya geçmemiş bug/kararları yaz |
