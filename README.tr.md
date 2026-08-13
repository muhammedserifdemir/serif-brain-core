# serif-brain

🇬🇧 [English README](README.md) · 📖 [İlk 15 dakika](docs/BASLANGIC.md) · 📊 [Ölçümler](docs/OLCUM.md)

**AI ajanı her oturumda sıfırdan başlar.** Dün neden o kararı verdiğini, hangi
bug'ın hangi dosyada yara izi bıraktığını, neyin bilerek böyle yapıldığını
bilmez. serif-brain projenin hafızasını dosya sistemine yazar, bunu kod grafına
bağlar ve **düzenleme anında devreye giren mekanik kapılara** çevirir.

> Tavsiye atlanabilir, kapı atlanamaz.

Saf Node.js, **sıfır npm bağımlılığı** (Node ≥ 22.5 — `node:sqlite` + native test
runner). 359 test.

Aracın gerçekten işe yarayıp yaramadığı 20 gerçek projede ölçüldü: kayıt tutulan
yerde hafıza, ihtiyaç anında ilgili bilgiyi **%80,5** oranında içeriyordu —
rastgele bir dosyada bu oran %14,3. **Sinyal/gürültü 5,6×.** Yöntem ve kapsam
etiketleri: [docs/OLCUM.md](docs/OLCUM.md). Veri kaynağı düz Markdown: `git diff` ile okunur, elle
düzenlenir, hiçbir servise bağlı değildir.

---

## Neden

Bir kural yazılıp üretim yolu onu çağırmıyorsa, **yazan kişi hiçbir hata
görmez.** Bu projenin kendi geçmişinden iki örnek:

- `.sort((a,b) => pri(a) - pri(b))` — hepsi `critical` olan listede hep `0`
  döner; kararlı sıralama giriş sırasını korur, yani **en eski kayıt başa
  geçer.** Gözle bakınca doğru görünüyordu; hata yalnız gerçek veride çıktı.
- `node.module || ownerOfConfigured(path, config)` — graf eşleşmeyen dosyaya
  `"unknown"` yazar ve **`"unknown"` truthy'dir**, yani fallback hiç çalışmadı.
  Config'e doğru kuralı yazan kişi hiçbir uyarı görmedi.

Her ikisi de "kanıt vardı ama yanlış şey ölçülmüştü" sınıfı. serif-brain tam
olarak bu sınıfı yakalamak için var: kararı kaydeder, koda bağlar, ve o dosyaya
bir daha dokunulduğunda **sen sormadan** önüne koyar.

---

## Kurulum

```bash
git clone https://github.com/muhammedserifdemir/serif-brain-core.git
node serif-brain-core/bin/serif-brain.mjs --help

# ya da global:
npm i -g git+https://github.com/muhammedserifdemir/serif-brain-core.git
```

Projende:

```bash
serif-brain init     # .serif-brain/ + Claude skill'leri + KAPI + CLAUDE.md işareti
serif-brain doctor   # sağlık: şema, graf, kapı kurulu mu
```

**→ [docs/BASLANGIC.md](docs/BASLANGIC.md) — ilk 15 dakika**, her komutun gerçek
çıktısıyla. Kurulumdan "Claude bunu sen sormadan görüyor" anına kadar.

`init` üç şeyi birden kurar: hafıza yapısını, çalışma disiplini skill'lerini ve
Claude Code kapısını. Kurulmayan kapı kapı değildir.

---

## Günlük döngü

```bash
serif-brain brief                    # neredeyiz: aktif plan/bug/karar + son bakıştan beri
serif-brain guard src/auth/login.ts  # DOKUNMADAN ÖNCE: kararlar, yara izleri, blast, risk
# ... kod ...
serif-brain review                   # commit'ten önce: katman ihlali + döngü + bug imzası
serif-brain add bug --title "..." --module auth
serif-brain close bug-2026... --note "nasıl çözüldü"
serif-brain capture --days 14        # commit'lerden hafızaya geçmemişleri öner
```

Kapı kuruluysa `brief`/`guard`/`review` **kendiliğinden** çalışır — Claude Code
oturum açılışında, her Edit'ten önce/sonra ve "bitti" demeden önce.

---

## Kapı (Claude Code entegrasyonu)

| Olay | Ne yapar | Susma sözleşmesi |
|---|---|---|
| `SessionStart` | Aktif plan/bug/karar + son bakıştan beri olanlar | Hafıza boşsa susar |
| `PreToolUse` (Edit/Write) | O dosyanın kararları, yara izleri, imza eşleşmeleri, blast-radius | Dosya temizse susar |
| `PostToolUse` | Katman ihlali / döngü / god-file | Sorun yoksa susar |
| `Stop` | Değişen dosyalarda kapı + **kapsam etiketi** + hafızaya geçmemiş commit'ler | Temiz + tam kapsamsa susar |

```bash
serif-brain hooks status          # kurulu mu, bayat mı
serif-brain hooks test [<dosya>]  # kapıyı GERÇEKTEN ateşle: ne diyor + hata günlüğü
serif-brain hooks install --apply # .claude/settings.json'a bağla
```

`status` "kurulu mu" der, `test` **"çalışıyor mu"** der — ikisi ayrı sorudur.
Kapı bir dönem aylarca *sorun bulunduğunda* susuyordu ve kimse göremedi, çünkü
ne yaptığını görmenin yolu yoktu. Kapı artık hatalarını yutmuyor:
`.serif-brain/.cache/gate.log`'a yazıyor, `doctor` son 7 günü raporluyor.
Sözleşme değişmedi — oturum asla bozulmaz (her zaman `exit 0`).

**Söyleyecek şey yoksa susar.** Her düzenlemede çıkan sabit metin bir süre sonra
okunmaz hale gelir ve kapının değerini sıfırlar. Yabancı hook kayıtlarına
dokunulmaz; bozuk JSON görülürse yazılmaz.

**Kapsam etiketi:** "sorun bulamadım" ile "sorun aramadım" ayrı şeylerdir.
Denetlenemeyen dosya, denetlenip temiz çıkan dosya değildir — kapı bunu ayırt
eder, yoksa yeşil ışık yanlış güven üretir.

---

## Komutlar

**Hafıza**
| | |
|---|---|
| `init` / `doctor` / `validate` | kur · sağlık · şemaya göre doğrula |
| `add bug\|decision\|plan\|record` | kayıt yaz (`record` → `done` doğar) |
| `close <id> --note` | kapat (id benzersizse proje sorulmaz) |
| `search` / `related` / `brief` | ara · otomatik ilişki keşfi · oturum özeti |
| `capture --days N [--apply]` | commit'lerden aday bug/karar |
| `stale` / `prune` / `sync-commits` | bayat tara · güvenle arşivle · `Brain-Closes:` trailer'ı |

**Kod ↔ hafıza**
| | |
|---|---|
| `guard <dosya>` | **edit-öncesi birleşik brifing** (touch+impact+risk+lint tek çağrı) |
| `touch` / `impact` / `risk` | dosyanın hafızası · blast-radius · risk skoru |
| `hotspot` / `cluster` | churn×merkezilik tehlike bölgesi · aynı-kök-neden kümeleri |
| `layers` / `check` / `lint` / `review` | katman ihlali · graf sağlığı · bug imzası · pre-commit kapı |
| `scan code` / `graph build\|report\|viewer` | tarayıcı · kod grafı + 11 mimari bulgu + HTML görüntüleyici |
| `analyze` / `context` | tüm raporlar · Claude bağlamı |

**Entegrasyon**
| | |
|---|---|
| `mcp` | MCP sunucusu — 16 araç (14 okuma + `brain_add`/`brain_close`) |
| `hooks status\|install` | Claude Code kapısı |
| `skills status\|update` | paketle gelen disiplin skill'leri |
| `dashboard` | çok-brain yönetici paneli (canlı + statik HTML) |

---

## Dil desteği

Tarayıcı **her dili indeksler**; ama "import grafı" her dilde aynı şey değildir.

| Dil | Durum |
|---|---|
| JS/TS, JSX/TSX, Vue, Svelte, Astro | **import grafı var** — dosya→dosya kenarları |
| Python (`.py`, `.pyi`) | **import grafı var** — göreli (`from .x`) + paket yolu (`a.b.c`) |
| PHP, Ruby | **import grafı var** — `require`/`include` yolları |
| Swift, C#, Java, Kotlin, Go, Rust, Dart, Obj-C | **indekslenir, import grafı yok** |

Son satır bilinçli: Swift/C#/Java'da aynı modül içindeki dosyalar birbirini
**import etmez** — hepsi otomatik görünür. Oraya dosya-dosya kenarı üretmek
uydurmak olur ve *"kimse import etmiyor, güvenle değiştir"* gibi tehlikeli bir
cümle üretir. O dosyalarda modül atfı, risk skoru, hafıza bağlantısı, imza
taraması ve churn **çalışır**; yalnız blast-radius yoktur — `scan code` bunu
açıkça yazar.

Her dilin kendi bağımlılık dizini dışlanır (`venv`, `Pods`, `vendor`,
`target`, `node_modules`…). `bin`/`obj`/`packages`/`Library` gibi **belirsiz**
adlar yalnızca ekosistem işareti varken atlanır — `packages/` bir JS
monorepo'sunda kaynaktır, .NET'te değildir.

## Yapılandırma

`.serif-brain/config.yaml` — hepsi opsiyonel, `init` yorumlu örnek yazar:

```yaml
module_paths:            # dosya yolu → modül (en uzun prefix kazanır)
  "src/auth/": auth
layer_rules:             # mimari kural; ihlalde exit 2
  - { from: ui, to: db, reason: "servis katmanı kullan" }
bug_signatures:          # geçmiş hataların 'şekli' (regex)
  - { name: supabase-await, pattern: "(?<!await )supabase\\.(from|rpc)\\(", message: "await eksik olabilir" }
capture_reminder: true   # hafızaya geçmemiş commit hatırlatıcısı
```

---

## Mimari

```
src/
  cli/        komut yönlendirici + her komut (ince sarmalayıcılar)
  markdown/   obje modeli, YAML parser/serializer, şema, yazma işlemleri
  scanner/    dosya tarama, import çözümleme, modül sahipliği
  graph/      graf inşa, 11-bulgu analiz, HTML viewer
  query/      arama/guard/impact/risk çekirdeği (CLI + MCP ORTAK)
  mcp/        MCP sunucusu (saf-Node JSON-RPC)
  hooks/      kapı kurulumu
  dashboard/  çok-brain panel
```

Kanonik veri = `.serif-brain/objects/projects/<proje>/<tip>s/<id>.md`
(Markdown + YAML frontmatter). Index/graf/rapor **türetilmiştir** ve
versiyonlanmaz.

Tasarım kuralı: aynı hesap iki yerde yaşamaz. CLI ve MCP aynı çekirdeği çağırır
— ikinci bir kopya, "CLI'da çalıştı ama MCP'de başka şey yazdı" sınıfında sessiz
ayrışma demektir.

---

## Belgeler

- [docs/BASLANGIC.md](docs/BASLANGIC.md) — **ilk 15 dakika** (buradan başlayın)
- [docs/USAGE.md](docs/USAGE.md) — oturum döngüsü, çoklu-Claude, komut refleksleri
- [docs/MCP.md](docs/MCP.md) — `.mcp.json` kurulumu ve test reçetesi
- [docs/WINDOWS.md](docs/WINDOWS.md) — Windows kurulumu
- [CHANGELOG.md](CHANGELOG.md) · [ROADMAP.md](ROADMAP.md)

## Geliştirme

```bash
npm test        # node --test test/*.test.mjs — sıfır bağımlılık
```

## Lisans

MIT — © 2026 Muhammed Serif Demir. `package.json`'da `private: true` bilinçlidir:
paket npm'e yayınlanmaz (bakım yükü), git üzerinden kurulur.
