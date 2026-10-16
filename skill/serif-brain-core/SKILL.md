---
name: serif-brain-core
description: "Serif Brain Core — proje hafızası (serif-brain CLI) ve yazılım mühendisliği disiplininin MERKEZİ; kod YAZAN, DEĞİŞTİREN veya GÜNCELLEYEN her işin giriş kapısı. Oturum başında hafızayı yükler (brief), dosyaya dokunmadan önce brifing verir (guard), ölçek seçtirir (S0 nokta · S1 dilim · S2 modül · S3 ürün), kabul ölçütünü koddan önce yazdırır, diff'i kusur kataloğuna karşı betikle taratır, kanıtsız 'bitti' dedirtmez ve diğer disiplin skill'lerini (cerrahi-plan, test-once, kanit-disiplini, prod-kapisi …) doğru sırada çağırır. Tetikleyiciler: herhangi bir kod değişikliği (bug fix, düzelt, özellik ekle, refactor, güncelle, bağımlılık yükselt, config, env, migration, şema); 'şu modüle gir', 'modülü bitir', 'yayına hazırla', 'eksikleri tamamla', 'dağıldık'; yeni ürün/özellik planı; 'bitti' iddiasından önce; 'brain', 'ne karar vermiştik', 'bug kaydet', 'karar kaydet', 'neredeyiz', 'serif-brain'. English: implement, build, fix, refactor, upgrade, ship, release, feature, module, code change, project memory."
---

# Serif Brain Core — hafıza + disiplin merkezi

İki işi tek yerde yapar: projenin **hafızasını** taşır ve kod değişikliğinin
**disiplinini** yönetir. Disiplin zincirinin tek haritası buradadır; başka skill'ler
bu tabloyu tekrar etmez.

Ana ilke: **kuralı modele okutma, sisteme yakalat.** Mekanik kontroller betik, hook
ve CLI kapısındadır (`katalog-tara.sh`, `serif-brain review`, `serif-brain lint`).
Bu dosya yalnız yargı gerektiren kısmı anlatır.

## 1. Hafıza — `serif-brain`

**Kapı kuruluysa bunların çoğu kendiliğinden gelir** (`serif-brain hooks status`):
oturum açılışında `brief`, her Edit/Write öncesi `guard`, sonrası `check`, Stop'ta
`review` çıktısı `[serif-brain …]` bloğu olarak bağlama düşer. O bloğu oku, aynı
komutu elle tekrar koşma. Kapı yoksa ya da blok gelmediyse aşağıdakileri elle çalıştır.

| An | Komut |
|---|---|
| Oturum başı | `serif-brain brief` — aktif bug/karar, son dokunulanlar, park kuyruğu |
| Dosyaya dokunmadan önce | `serif-brain guard <dosya>` — o dosyanın kararları, bug izleri, etki alanı, risk |
| Hafızada ara | `serif-brain search "<metin>" --module X` |
| Kayıt | `serif-brain add bug\|decision\|plan\|record --title … --module … --body …` |
| Kapat | `serif-brain close <id> --note … --commit <sha>` ya da commit'te `Brain-Closes: <id>` + `sync-commits` |
| Commit öncesi kapı | `serif-brain review` (katman/döngü/god-file + bug imzası; sorun varsa exit 2) |
| Diğer her şey | `serif-brain --help` (graph, impact, hotspot, analyze, doctor, mcp …) |

- Brain kayıtları **gözlem günlüğüdür, olgu kaynağı değil.** Teşhisler çoğu zaman dar
  bir aramayla (tek dosyada grep) yazılmıştır. Plana temel yapacağın kaydı **o turda
  yeniden doğrula**; yanlış çıkarsa düzelt ve `add record` ile not düş.
- **Açık iş tavanı:** `brief` WIP sayacını basar. Tavan aşılmışsa yeni iş açılmaz.
  `status: standing` kural kayıtları sayaca girmez.
- `.serif-brain/` altında `graph/`, `reports/`, `context/`, `indexes/` türetilmiş
  çıktıdır, yeniden üretilir; kanonik olan `brain.db` + `objects/` dosyalarıdır.
- `serif-brain` komutu bulunamazsa sessizce atlama: sahibine PATH sorununu söyle.

## 2. Ölçek seç — atlanmaz

İlk satır: `ÖLÇEK: S1 — <neden>`.

| Ölçek | Ne zaman | Yol |
|---|---|---|
| **S0** nokta | Tek dosya, davranış değişmiyor (metin, yorum, yazım) | değişiklik → kanıt (derle/test + TR tarama) |
| **S1** dilim | Tek akışta düzeltme veya küçük özellik | kabul satırı → kırmızı test → kesik → katalog → kanıt |
| **S2** modül | Modülü bitirmek, çok akışlı özellik, refactor, bağımlılık yükseltme | S1 + modül defteri + denetim + prod-kapisi; `references/disiplin.md` tamamı |
| **S3** ürün | Yeni ürün veya alt sistem | **urun-teslim** ile başla, sonra S2 |

**Küçültme tuzağı:** Davranış değişiyorsa S0 değildir. Birden çok dosyaya yayılıyorsa en
az S1'dir. Yetki, veri, para, silme veya kalıcı biçime dokunuyorsa **bağımsız göz**
zorunludur. Şüphede bir üst ölçek.

**Ayrı plan adımı yok.** Güncel modeller teşhis ve kesiği kendi içinde yapar. Kök neden
belirsizse ya da birden çok dosya/davranış etkileniyorsa **cerrahi-plan** çağrılır;
aksi halde doğrudan kabul satırı yazılıp işe başlanır.

## 3. Kabul — "bitti" tanımı koddan ÖNCE

S1 ve üstünde işe başlamadan üç satır yazılır, kapanışta doldurulur:

```
KABUL:  <önce → sonra, yüzeyin adıyla; ikili ve gözlenebilir; hangi veriyle>
KANIT:  <kırmızı→yeşil test adı / kare yolu / komut çıktısı>
BRAIN:  <yazılan kayıt id | GEREKMEZ>
```

"Daha iyi" ölçüt değildir; "görsel önizleme slaytında görünüyor" ölçüttür. Sayı içeren
ölçütte önce **olcum-sozlesmesi**. Para, veri silme, canlıya yazma ya da geri dönüşsüz
işlem varsa dur, sahibe sor.

## 4. Uygulama

1. **Bağlam:** `brief` + `guard <dosya>` (kapıdan gelmediyse); `git status` (başkasının commit'lenmemiş
   değişikliğine dokunma); sunucu/build ihtimalinde `lsof -i`. Hata görüldüğü yerde
   üretilmeden düzeltmeye başlanmaz.
2. **Önce kırmızı** (**test-once**): hatayı yakalayan test önce kırmızı, sonra yeşil
   görülür ve projenin test paketine commit'lenir.
3. **En küçük tutarlı değişiklik.** Deponun deseni izlenir; gerekçesiz bağımlılık, desen
   ya da dosya yapısı eklenmez. İstenmeyen özellik eklenmez, önerilir.
4. **Katalog taraması — betikle:** `bash <bu-skill>/scripts/katalog-tara.sh [taban-ref]`.
   Tetiklenen her sınıf için `yok (neden)` | `var → düzeltildi (test)` | `var → PARK`.
   Sınıfın ayrıntısı gerekirse `references/kusur-katalogu.md`'de o satıra bakılır.
   Betiğin göremediği 5 soru her dilimde cevaplanır:
   - Veri son yüzeye (ekran, dışa aktarma, köprü, e-posta) kadar gidiyor mu?
   - Başarı mesajı sonucu mu ölçüyor, yoksa yalnız çağrının döndüğünü mü?
   - Bu değişikliğe bağlı başka ne var? (sabit, eşik, ikiz kod, eski kayıt, eski istemci)
   - Yetkisiz kullanıcı ya da başka kiracı ne görür?
   - Kötü yol: boş, hata, zaman aşımı, çift tık, geri tuşu — kullanıcı ne görüyor?
5. Kalıcı biçim, bağımlılık yükseltme, yeni env, API sözleşmesi →
   `references/disiplin.md` §5.

## 5. Kanıt merdiveni

| Basamak | Kanıt | Ne kanıtlar |
|---|---|---|
| 1 | Kullanıcı yüzeyinde kare | **Görünürlüğü** — UI ölçütünde zorunlu |
| 2 | Çalışan sistemde gerçek akış (HTTP, tarayıcı otomasyonu, gerçek veri) | Davranışı |
| 3 | Ölçütü sınayan otomatik test (üretimi import eder, taklit etmez) | Doğruluğu, kalıcı olarak |
| 4 | Statik okuma | Yalnız "muhtemel" |

Kare doğruluğu kanıtlamaz: sayısal/mantıksal ölçüt basamak 2 ya da 3 olmadan kapanmaz.
Kare alınamıyorsa iş **DOĞRULANMADI** statüsünde kalır. Her ölçekte **kanit-disiplini**.

## 6. Zincir — tek harita

| İş | Skill | Ne zaman |
|---|---|---|
| Yeni ürün / alt sistem | `urun-teslim` | S3, en başta — ürün/sistem/dilim kararı |
| Kök neden belirsiz, çok dosya | `cerrahi-plan` | koda dokunmadan önce |
| Bug ya da sözleşme değişikliği | `test-once` | koda dokunmadan önce — kırmızıyı gör |
| Aynı mantık ikinci kez yazılacak | `ikiz-kod` | gömülü/üretilmiş kod, farklı runtime |
| Sayı, oran, karşılaştırma | `olcum-sozlesmesi` | ölçümü kurmadan önce |
| "Bitti / tamam / çalışıyor" | `kanit-disiplini` | iddiadan önce |
| Deploy / "yayına hazır mı" | `prod-kapisi` | deploy'dan önce |
| Kullanıcıya anlatma | `somut-rapor` | iş bitince |
| Aynı düzeltme 3. kez deneniyor | `systematic-debugging` (kuruluysa) | hemen |

Ayrıntılı kapılar (bağlam, modül defteri, dilimler, yayın, kapanış, modül "bitti"
tanımı): `references/disiplin.md`. Modül defteri şablonu: `references/modul-defteri.md`.

## 7. Kapanış

- Brain: `add decision` / `add bug` (gövde zorunlu) / `close --note`.
- Yeni hata sınıfı yaşandıysa kataloğa yazılır; yakalama yolu otomatik kapıya
  (betik deseni, `lint` imzası, test) çevrilebiliyorsa çevrilir.
- Rapor: önce sonuç, en fazla 3 madde, en fazla 1 soru (**somut-rapor**).

## Kayma alarmları — dur, yeniden planla

Doğrulama farklı kök neden gösterdi · yeni bağımlılık/veri/yetki modeli riski
değiştiriyor · çözüm kullanıcı davranışını değiştiren geçici çözüme dönüşüyor · dilim
tek dar sonuçla anlatılamıyor · aynı düzeltme üçüncü kez · iş hiçbir kabul satırına
denk gelmiyor. Dururken yazılır: kanıt, gereken karar, önerilen yol. Yanlış yöne
gidildiyse ısrar edilmez; son sağlam noktaya geri dönülür.

## Yasaklar

- Ölçek ve kabul satırı yazmadan koda dokunmak.
- Kırmızısı görülmemiş testle "düzeldi" demek; regresyon testini commit'lememek.
- Kanıt karesi olmadan UI işine "bitti" demek.
- Kapıyı gevşeterek yeşile çevirmek (`skip`, `--no-verify`, `any`, `@ts-ignore`,
  beklenen değeri çıktıya uydurmak).
- Başkasının commit'lenmemiş değişikliğine dokunmak; kapıdan geçmemiş SHA'yı push etmek.
- Boş hücreli defterle modül kapatmak; yeni hata sınıfını kataloğa yazmadan kapatmak.
- Kullanıcıya uzun rapor dökmek.
