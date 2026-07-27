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
python scripts/tr_tarama.py <değişen dosyalar veya dizin>
```

Script iki şey arar:
- ASCII'leşmiş Türkçe ("egitim turu" → "eğitim türü" olmalı). Kullanıcıya
  görünen stringlerde bozuk Türkçe gerçek bir bug'dır, kozmetik değil.
- UI stringlerine sızan iç/pedagojik jargon (ör. "Bloom", "taksonomi",
  "karar matrisi"). Bunlar debug loglarında kalmalı; kullanıcıya görünen
  metin sıcak ve jargonsuz olmalı.

Bulguları değerlendir: script sinyal üretir, karar senindir (İngilizce kod
tanımlayıcıları false positive olabilir). Gerçek bulguysa düzelt ve zinciri
2. adımdan tekrar işlet.

### 4. Ortam kontrolü (servis/port işlerinde)

Bir portun boş olduğunu, bir servisin senin başlattığın servis olduğunu
veya bir endpoint'in ayakta olduğunu varsayma. Önce bak:

```bash
lsof -i :<port> -sTCP:LISTEN
pm2 ls        # pm2 kullanılıyorsa
```

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
- Doğrulama bahanesiyle yıkıcı işlem (dosya/tablo silme, süreç öldürme,
  force push) — teşhis koy, kararı kullanıcıya bırak.
- Rapor satırı dışında uzun kapanış özeti yazmak.
