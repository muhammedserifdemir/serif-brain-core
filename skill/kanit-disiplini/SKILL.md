---
name: kanit-disiplini
description: "Kanıt Disiplini — kod/geliştirme işlerinde 'bitti', 'tamam', 'hazır', 'çalışıyor' demeden önce zorunlu doğrulama zinciri. Bu skill'i her kodlama görevinin SONUNDA mutlaka kullan; bug fix, release, version bump, refactor, UI değişikliği, prompt değişikliği veya herhangi bir 'durumu raporla' isteğinde de kullan. Kullanıcı 'test et', 'kontrol et', 'emin misin', 'gerçekten çalışıyor mu' dediğinde de tetiklenir. Amaç varsayımla ilerlemeyi engellemek: build/test çıktısı görülmeden başarı iddia edilmez, UI stringlerinde Türkçe karakter bozulması taranır, port/servis sahipliği lsof ile doğrulanır."
---

# Kanıt Disiplini

## Neden

Dil modellerinin en yaygın hatası kanıt yerine varsayımla konuşmaktır:
dosyanın hafızadaki haline güvenmek, build'i çalıştırmadan "derlenir" demek,
testi görmeden "geçer" saymak, "eğitim türü"nü fark etmeden "egitim turu"na
çevirmek. Bu skill tek bir ilkeyi zorlar:

**Kanıtı olmayan iddia yok.** Bir şeyi söyleyeceksen, o turda alınmış gerçek
bir komut çıktısını gösterebilmelisin. Gösteremiyorsan iddia etme; "bunu
doğrulayamadım" de. Doğrulanamamış bir adımı geçmiş gibi sunmak, başarısız
bir adımı raporlamaktan çok daha maliyetlidir — kullanıcı senin raporunun
üstüne karar verir.

## Doğrulama zinciri

Bir işi tamamlandı ilan etmeden önce bu zinciri sırayla işlet. Uygulanamayan
adım varsa (ör. projede test yok), adımı atlandı diye işaretle ve raporda
açıkça belirt — sessizce geçme.

### 1. Gerçek durumu oku

Değiştirdiğin dosyaların son halini diskten tekrar oku (`git diff` /
`git status` + ilgili dosyalar). Hafızandaki versiyona güvenme; araya başka
düzenleme girmiş, bir edit yarım kalmış olabilir. Ayrıca diff'te kapsam dışı
değişiklik var mı kontrol et: dokunmaman gereken bir dosya değiştiyse bunu
raporla — çalışan bir şeyi farkında olmadan kırmanın en erken sinyali budur.

**Hangi ağaçta olduğunu doğrula.** Aynı depo birden çok yerde açık olabilir
(worktree, ikinci klasör, başka bir oturum). Bulunduğun ağacın commit'i
beklediğin commit mi? `git rev-parse --short HEAD` + `git worktree list`.
Bayat bir ağaçta doğru iş yapmak, doğru ağaçta yanlış iş yapmak kadar
zaman kaybettirir — ve rapor karşı tarafta anlamsız görünür.

### 1b. YOKLUK iddiası — en kolay yanılma

"Bu fonksiyon repoda yok", "hiçbir yerde çağrılmıyor", "böyle bir alan
tanımlanmamış" cümleleri **pozitif bir bulgu kadar kanıt ister**, çünkü
yanlış negatif sessizdir: arama bir şey döndürmediğinde hata almazsın,
yokluğu onaylanmış sanırsın.

Yokluk iddiası yazmadan önce:
- **Deseni değil, sabit dizeyi ara.** Regex lehçeleri farklıdır (`grep`,
  `ripgrep`, `ugrep`, `ack` alternasyon ve kaçışları aynı yorumlamaz);
  `\|` bir araçta alternasyon, diğerinde düz karakterdir. Önce
  `--fixed-strings` ile ara.
- **Kapsamı kontrol et:** doğru kök dizin mi, `node_modules`/`dist` dışlaması
  aramayı da mı kesti, büyük/küçük harf duyarlılığı ne.
- **En az iki farklı yolla** teyit et (dize araması + dosyayı doğrudan okuma).

Ve bulduğun yokluğun **sebebini uydurma**. "Şu commit'te silinmiş" demek için
o commit'in gerçekten o dosyaya dokunduğunu göstermen gerekir
(`git show --stat <commit>`). İnandırıcı bir hikâye, kanıt değildir; hatalı
sebep açıklaması yanlış bulgudan daha zararlıdır çünkü sorgulanmaz.

### 2. Derle ve test et — çıktıyı yakala

Projenin gerçek komutlarını çalıştır (type-check, build, test; projede ne
varsa). Rapora geçecek her sayı komut çıktısından gelmeli: hata sayısı,
test geçen/toplam, build süresi. "Muhtemelen geçer", "derlenmesi lazım"
gibi ifadeler yasak — komutu çalıştıramadıysan bunu söyle.

Build süresi ve test sayısındaki gerilemeler de bulgudur: build belirgin
yavaşladıysa veya test sayısı düştüyse raporda belirt.

### 3. Türkçe karakter ve jargon taraması

UI'a dokunan her değişiklikten sonra çalıştır:

```bash
python3 ~/.claude/skills/kanit-disiplini/scripts/tr_tarama.py <değişen dosyalar veya dizin>
```

Script skill ile birlikte gelir — proje içinde aramaya gerek yok. Bulgu varsa
çıkış kodu 1 döner.

Script iki şey arar:
- ASCII'leşmiş Türkçe ("egitim turu" → "eğitim türü" olmalı). Kullanıcıya
  görünen stringlerde bozuk Türkçe gerçek bir bug'dır, kozmetik değil.
- UI stringlerine sızan iç/pedagojik jargon (ör. "Bloom", "taksonomi",
  "karar matrisi"). Bunlar debug loglarında kalmalı; kullanıcıya görünen
  metin sıcak ve jargonsuz olmalı.

Bulguları değerlendir: script sinyal üretir, karar senindir (İngilizce kod
tanımlayıcıları false positive olabilir). Gerçek bulguysa düzelt ve zinciri
2. adımdan tekrar işlet.

### 4. Ortam kontrolü — "komut çalıştı" ≠ "iş yapıldı"

Bir portun boş olduğunu, bir servisin senin başlattığın servis olduğunu
veya bir endpoint'in ayakta olduğunu varsayma. Önce bak:

```bash
lsof -i :<port> -sTCP:LISTEN
pm2 ls        # pm2 kullanılıyorsa
```

Sessiz başarısızlık kaynakları — hepsi hata vermeden yanlış sonuç üretir:

- **Çalışma dizini kabuk çağrıları arasında kalıcıdır.** Bir önceki komutta
  `cd` yaptıysan göreli yol başka yere düşer; `rm -f`, `cp`, `mkdir -p` gibi
  komutlar hata vermeden hiçbir şey yapmaz. Yıkıcı/temizleyici işlerde
  **mutlak yol** kullan ve sonucu ayrıca listeleyerek doğrula.
- **Kod üreten dosyalar** (içeriği template literal / backtick içinde tutanlar):
  yorumlara bile backtick yazamazsın, string erken kapanır ve dosya derlenmez.
  Üretilmiş çıktıyı bir kez derleyip veya koşup gör.
- **Kopya ağaçlar** (`worktrees/`, `backups/`) test toplayıcısına girip aynı
  testi iki kere koşturur; sayı iki katına çıkar veya alias çözülmediği için
  sahte hata verir. Toplayıcıyı daralt.
- **Bir şeyi bozmadığını ölçerken**: dosyayı geçici bir yere kopyala →
  `git checkout <commit> -- <dosya>` → ölç → geri kopyala. `git stash`
  KULLANMA: başkasının bekleyen çalışması varsa pop yanlış şeyi çalışma
  ağacına uygular.

Aynı makinede birden çok oturum/proje çalışıyor olabilir; 3000-3001 gibi
portları başka bir süreç tutuyorsa bunu teşhis olarak raporla, süreci
sormadan öldürme.

### 5. Görsel doğrulama (UI değişikliklerinde)

UI değişikliğinde mümkünse ekran görüntüsü/preview al ve gerçekten bak.
Alınamıyorsa raporda "görsel doğrulama yapılamadı" yaz — "tamam" deme.

## Rapor formatı

Zincir bitince tek satırlık durum raporu ver. Uzun özet, madde madde recap
yok — sadece rakamlı durum satırı ve (varsa) bulgular:

```
DURUM: build 0.72s | TS 0 hata | test 159/159 | TR tarama temiz | diff 3 dosya (kapsam içi)
```

Başarısız veya atlanan adım varsa aynı satırda dürüstçe göster:

```
DURUM: build 0.81s | TS 0 hata | test 157/159 (2 FAIL: quiz.spec) | TR tarama: 1 bulgu (egitim turu) | görsel doğrulama yapılamadı
```

Böyle bir satırın ardından iş "tamamlandı" ilan edilmez; önce bulgular
çözülür ya da kullanıcıya karar bırakılır.

## Yasaklar

- Komut çıktısı olmadan sayı veya başarı iddiası yazmak.
- Başarısız/atlanmış adımı sessizce geçmek.
- "Çalışması lazım", "muhtemelen geçer" kalıpları.
- Tek aramayla yokluk ilan etmek (regex lehçesi sessizce yanlış negatif verir).
- Bulunan bir yokluğun sebebini kanıtlamadan anlatmak (commit suçlamak dahil).
- Doğrulama bahanesiyle yıkıcı işlem (dosya/tablo silme, süreç öldürme,
  force push) — teşhis koy, kararı kullanıcıya bırak.
- Rapor satırı dışında uzun kapanış özeti yazmak.
