# İlk 15 dakika

Bu belgedeki her komut gerçek bir projede çalıştırılıp çıktısı buraya
kopyalanmıştır. Beklediğinizden farklı bir şey görürseniz bu bir hatadır —
`serif-brain doctor` çalıştırın.

---

## 0. Kurulum (1 dakika)

```bash
npm i -g git+https://github.com/muhammedserifdemir/serif-brain-core.git
cd ~/projelerim/uygulamam
serif-brain init
```

`init` üç şeyi birden kurar:

- `.serif-brain/` — hafızanın kendisi (düz Markdown, `git diff` ile okunur)
- `.claude/skills/` — çalışma disiplini skill'leri
- **Claude Code kapısı** — `.claude/settings.json`'a bağlanır

Modül eşlemesi klasör yapınızdan türetilir (`src/api/` → `api`). Yanlışsa
`.serif-brain/config.yaml`'daki `module_paths`'i düzeltin.

---

## 1. Bir şey kaydet (2 dakika)

Hafıza kendi kendine dolmaz. En değerli kayıt türü: **"neden böyle yaptık"**.

```bash
serif-brain add decision \
  --title "Kullanıcı listesi cache'lenmiyor — tutarlılık öncelikli" \
  --files src/api/users.js
```

> ### `--files` neden önemli
>
> Ölçüldü (20 gerçek proje, 1.179 kayıt): dosyaya bağlanmayan kayıt, o dosyaya
> dokunulurken **kapıda görünmez**. Kayıtların %33'ü yalnız modüle bağlıydı,
> %12'si hiçbir yere. Sonuç: kapı değişen dosyaların %78'inde susuyor.
>
> `--files` vermezseniz araç git'ten doldurmaya çalışır ve boş kalırsa
> **uyarır** — engellemez, ama uyarıyı ciddiye alın.

---

## 2. Kapının ne gördüğünü gör (1 dakika)

```bash
serif-brain guard src/api/users.js
```

```
[serif-brain guard] DIKKAT — src/api/users.js (modul:api)
  ✓ risk: LOW (2) · 1 bu dosyaya bagli kayit
  🔗 TAM BU DOSYAYA bagli (1):
     [decision/active] decision-2026...-kullanici-listesi-cache-lenmiyor — Kullanıcı listesi cache'lenmiyor — tutarlılık öncelikli
```

Üç verdict vardır ve **üçü ayrı şey söyler**:

| Verdict | Anlamı |
|---|---|
| `DIKKAT` | Bilmen gereken bir şey var |
| `TEMIZ` | Kayıt **var**, ama bu değişiklik için risk yok |
| `KAYIT YOK` | Bu dosya hakkında hiçbir şey bilinmiyor — *"risk yok" demek değil* |

Son satır önemli: araç bilmediğini bilmediği gibi göstermez.

---

## 3. Claude Code'un bunu sen sormadan görmesi (2 dakika)

```bash
serif-brain hooks test
```

```
  SessionStart  ✓ konusuyor (78 token):
      [serif-brain] Bu projenin bir hafizasi var. Oturum acilisi:
        📌 IHLAL ETME — aktif karar (1):
          · Kullanıcı listesi cache'lenmiyor — tutarlılık öncelikli
  PreToolUse    ✓ konusuyor (42 token):
      [serif-brain] src/api/users.js:
        🔗 BU DOSYA: decision — Kullanıcı listesi cache'lenmiyor [active]
```

Kapı dört anda çalışır ve **söyleyecek şeyi yoksa susar**:

| Ne zaman | Ne yapar |
|---|---|
| Oturum açılışı | aktif plan/bug/karar + son bakıştan beri olanlar |
| Edit/Write **öncesi** | o dosyanın kararları, yara izleri, imza eşleşmeleri, blast-radius |
| Edit/Write **sonrası** | katman ihlali, döngü, god-file |
| "Bitti" demeden önce | değişen dosyalarda bulgular + kapsam etiketi |

Ayrıca **söylediğini bir daha söylemez** — aynı metin ikinci kez üretilmez.
(Bu kural bir kez eksikti ve kapı sonsuz döngüye girdi.)

---

## 4. Günlük döngü (kalan süre)

```bash
serif-brain brief                    # neredeyiz + son bakıştan beri ne oldu
serif-brain guard <dosya>            # dokunmadan önce
serif-brain review                   # commit'ten önce
serif-brain capture --days 14        # commit'lerden hafızaya geçmemişleri öner
serif-brain close <id> --note "..."  # iş bitince
```

`capture`, commit mesajlarınızdan aday bug/karar çıkarır. **Otomatik yazmaz** —
gösterir, siz onaylarsınız. (Otomatik yazan bir sürüm denendi; ürettiği gürültü
hafızayı okunmaz hâle getirdi ve geri alındı.)

---

## Sık karşılaşılanlar

**"guard hep `KAYIT YOK` diyor"** — normaldir, hafıza yalnız yazdığınız yerde
vardır. Ölçüm: yeni bir projede kapsam sıfırdan başlar; 20 gerçek projede
ortalama %5,8. Yükseltmenin tek yolu `--files` ile kayıt açmak.

**"Kayıtlarım kopmuş, dosyalar taşındı"** —
```bash
serif-brain relink            # ne onarılacak, göster
serif-brain relink --apply    # onar
```
Git'in kendi rename kayıtlarını takip eder. **Tahmin etmez**: benzer isimli
dosyayı "herhalde budur" diye bağlamaz.

**"Kapı hiç konuşmuyor, bozuk mu?"** —
```bash
serif-brain hooks test        # gerçekten ateşler, ne dediğini gösterir
serif-brain doctor            # kapı kurulu mu + hata günlüğü
```
Kapı hatalarını yutmaz; `.serif-brain/.cache/gate.log`'a yazar.

**"Python/Swift projemde çalışır mı?"** — Python, PHP, Ruby'de tam import
grafı var. Swift, C#, Java, Kotlin, Go, Rust indekslenir ama **import grafı
yoktur** — o dillerde aynı modüldeki dosyalar birbirini import etmez, kenar
üretmek yanlış olurdu. Hafıza, risk, imza taraması hepsinde çalışır.
`serif-brain scan code` hangi dilde ne olduğunu satır satır yazar.

---

## Sonraki adım

- [USAGE.md](USAGE.md) — oturum döngüsü, çoklu-Claude, komut refleksleri
- [MCP.md](MCP.md) — Claude Code'un hafızayı canlı okuması/yazması
- [WINDOWS.md](WINDOWS.md) — Windows kurulumu
