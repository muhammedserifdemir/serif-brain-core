# Ölçüm — "işe yarıyor mu" sorusunun yanıtı

README'deki sayılar buradan geliyor. Yöntemi yazmayan sayı, sayı değildir.

**Tarih:** 2026-08-12 · **Örneklem:** 20 gerçek proje, 1.179 kayıt, gerçek git
geçmişi (sentetik fikstür **değil**) · **Yol:** üretimdeki çağrı noktası
(`gatherGuard()`, `loadObjects()`) — ölçüm için ayrı çağrı kurulmadı.

---

## Neden bu ölçümler

Çökme yokluğu (20 projede 94 komut çalıştırması, 0 çökme) yalnızca aracın
**çalıştığını** gösterir. Değerin kanıtı farklıdır: kapı konuştuğunda söylediği
şey **karar değiştirir mi?**

---

## 1. Kapı ne sıklıkla, ne kalitede konuşuyor

Son 90 günde değişmiş 1.937 dosyanın her biri için `gatherGuard()` çalıştırıldı
ve çıktı üçe ayrıldı:

| Sınıf | Sayı | Oran |
|---|---|---|
| **Dosyaya özel** (o dosyaya bağlı kayıt ya da imza eşleşmesi) | 302 | **%15,6** |
| Modül geneli (modülün her dosyasında aynı çıkar) | 119 | %6,1 |
| Sessiz | 1.516 | **%78,3** |

Modül geneli sinyal ayrı sayıldı çünkü **karar değiştirmez**: modülün her
dosyasında aynı metin çıkar.

Varyans büyük ve öğretici: GameX %51, klavye-savaş %39, anketx %35 — buna
karşılık bazı projelerde %0. Fark araçta değil, kayıtların dosyaya bağlanıp
bağlanmamasında.

## 2. Neden %78 sessiz

| | |
|---|---|
| Kayıtların dosyaya bağlı olanı | %54,6 |
| Yalnız modüle bağlı | %33,3 |
| Hiçbirine bağlı olmayan | %12,0 |
| Hafızanın dokunduğu benzersiz dosya | 1.066 |
| Depolardaki izlenen dosya | 18.336 |
| **Kapsam** | **%5,8** |

Sessizlik bir hata değil, kapsamın sonucudur: hafıza yalnız yazdığınız yerde
vardır.

## 3. En belirleyici: hafıza ihtiyaç anında doğru şeyi içeriyor muydu

Dosyaya bağlı 133 bug kaydı için soru: *o bug oluşmadan önce, aynı dosyada
başka bir kayıt var mıydı?* Varsa kapı, o dosyaya dokunulurken konuşurdu.

| | |
|---|---|
| **Gerçek** — bug'ın kendi dosyası | **%80,5** (107/133) |
| **Kontrol** — aynı depo, aynı an, **rastgele** dosya | **%14,3** (19/133) |
| **Sinyal / gürültü** | **5,6×** |

> Kontrol grubu şarttı. Hafıza yoğun dosyalarda birikir; kontrolsüz %80,5 hiçbir
> şey kanıtlamazdı. Rastgele dosya kıyaslaması, sinyalin şansın 5,6 katı
> olduğunu gösteriyor — hafıza gerçekten *sonradan bug çıkan* dosyalarda
> birikmiş.

**Kapsam etiketi:** bu oran yalnızca **kaydedilmiş ve dosyaya bağlanmış**
bug'lar için geçerlidir. Hiç kaydedilmemiş bug ölçümün dışındadır. Dolayısıyla
*"kapı bug'ların %80'ini önler"* denemez. Denebilecek olan: *"kayıt tutulan
yerde hafıza, ihtiyaç anında ilgili bilgiyi %80 oranında içermiş."*

## 4. Çürüme

| | |
|---|---|
| Aktif kayıt | 595 |
| Ortalama yaş | 39 gün |
| Kırık dosya referansı | 82 → `relink` ile 37 kayıt onarıldı |
| Dosyalarının tamamı kopmuş kayıt | 9 |

Kırık referansların büyük kısmı **silinmiş dosya değildi**: bir alt-dizinde
kurulu brain'de git, yolları repo köküne göre veriyordu (`apps/x/src/a.ts`
yerine `src/a.ts`). Bu bulunup hem kaynakta hem geriye dönük düzeltildi.

## 5. Graf doğruluğu

Yanlış graf, yanlış blast-radius, yanlış "güvenle değiştir" demektir.
Üç projeden 25'er import kenarı örneklendi ve kaynak kodda doğrulandı:

| Proje | Dil | Kenar | Örnek | Doğrulanan |
|---|---|---|---|---|
| serif-platform | JS/TS | 6.599 | 25 | **25** |
| avatarx | Python | 145 | 25 | **25** |
| GameX | JS/TS | 329 | 25 | **25** |

## 6. Maliyet

Kapı **her Edit'te** çalışır; değer maliyete karşı tartılmalı.

| Olay | Süre | Token |
|---|---|---|
| SessionStart | 0,7–1,3 sn | 250–380 |
| PreToolUse | 0,26–0,33 sn | 0–245 |
| PostToolUse | ~0,11 sn | 0 |
| Stop | 0,16–0,45 sn | 0 |

Edit başına ~0,4 sn. 50 düzenlemelik oturumda ~20 sn.

Bağlam maliyeti: 17 kaydın tamamı ~9.222 token, oturuma giren ~407 token
(**%4,4**). 5.000 kayıtlık sentetik brain'de `brief` çıktısı **180 token** —
liste sınırlıdır, kırpılan sayı gizlenmez.

---

## Ölçümün kendi hataları (kayda geçti)

Bu ölçüm iki kez yanlış yapıldı ve düzeltildi. İkisi de aynı derse çıkıyor:
**uç bir sonuç, önce ölçümden şüphelenmeyi gerektirir.**

1. İlk turda `gatherGuard()` çıktısı `g.memory.file_hits` diye okundu — öyle bir
   alan yok, alanlar üst seviyede. Sonuç **%97,9 sessiz** çıktı, yani "araç işe
   yaramıyor" denecekti.
2. Ölçüm betiği `git log --name-only` kullanıyordu; alt-dizindeki brain'ler için
   git repo köküne göre yol verir ve dosyalar "yok" sayılır. Bir proje 260 yerine
   1 dosya görünüyordu — **aynı taban hatası hem üründe hem ölçüm aracındaydı.**

---

## Ölçülmeyenler

- **Kapının davranış değiştirdiği ölçülmedi.** Bunun için A/B gerekir (aynı işi
  kapılı ve kapısız yapmak); tek kullanıcıyla kurulamaz.
- **Windows'ta hiçbir ölçüm yapılmadı.** Kod düzeltildi ve CI'a `windows-latest`
  eklendi, ama koşu sonucu henüz görülmedi.
- **Dış kullanıcı yok.** Buradaki her sayı, aracı yazan kişinin kendi
  projelerinden geliyor.

## Tekrarlanabilirlik

Ölçüm betikleri repoda tutulmuyor (tek seferlik analiz). Yöntem yeniden
kurulabilir: `gatherGuard()` üzerinden dosya sınıflandırma, `loadObjects()`
üzerinden kayıt/ilişki sayımı, kontrol grubu için aynı depodan deterministik
rastgele dosya seçimi. Kapsam etiketi her sayının yanında verilmelidir.
