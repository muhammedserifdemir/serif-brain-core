---
name: urun-teslim
description: "Ürün Teslim — belirsiz bir ürün fikrini küçük, doğrulanmış sürümlere çeviren kapı zinciri. Bu skill'i YENİ ÜRÜN, YENİ MODÜL, kapsamlı özellik, entegrasyon veya 'şunu yapalım', 'bir uygulama lazım', 'şu sistemi kuralım', 'nereden başlayalım' isteklerinin BAŞINDA kullan; ayrıca iş dağıldığında, kapsam belirsizleştiğinde veya 'ne yapıyorduk biz' dendiğinde. Amaç teknolojiden değil KULLANICI SONUCUNDAN başlamak, ve tek seferde uçtan uca çalışan İNCE BİR DİLİM teslim etmek. Tek bug/küçük fix bu skill'in işi değildir — o cerrahi-plan'ındır."
---

# Ürün Teslim

## Neden

Dağılmanın en pahalı biçimi kötü kod değil, **hiçbiri bitmemiş beş iyi
başlangıçtır**. Şu döngü tanıdıktır: fikir heyecan verir, mimari konuşulur,
üç modül birden açılır, hiçbiri kullanıcının tamamlayabileceği bir akışa
ulaşmaz, sonra yeni bir fikir gelir ve aynı şey tekrarlanır. Geriye
yarım kalmış dosyalar ve "aktif" görünen ama kimsenin dokunmadığı kayıtlar
kalır.

Sebep tembellik değil, **sıranın yanlış olması**: teknolojiden başlamak,
katman katman ilerlemek ("önce tüm API'ler, sonra tüm UI"), ve bitti
ölçütünü işin sonunda aramak. Üçü de aynı sonucu verir — hiçbir noktada
gösterilebilir bir şey yoktur.

Bu skill sırayı tersine çevirir: **kullanıcı sonucundan başla, tek dikey
dilim teslim et, dilim bitmeden ikincisini açma.**

## Bu skill nerede durur

Bu skill işi **açar ve sınırlar**; kesme, doğrulama ve raporlama zincirin
diğer halkalarınındır. Kapsam çakışması olmasın diye devir noktaları net:

| Ne zaman | Hangi skill |
|---|---|
| Kapı 1–3 (ürün / sistem / dilim kararı) | **bu skill** |
| Dilim seçildi, koda dokunulacak | `cerrahi-plan` |
| Dilimin bitti ölçütü test olacaksa | `test-once` |
| Aynı mantık ikinci kez yazılacaksa | `ikiz-kod` |
| Sayı/oran/karşılaştırma üretilecekse | `olcum-sozlesmesi` |
| "Bitti" denmeden önce | `kanit-disiplini` |
| Kullanıcıya anlatırken | `somut-rapor` |
| Kalıcı karar kaydedilecekse | `serif-brain add decision` |

Tek bug, tek dosyalık fix, davranış düzeltmesi **bu skill'in işi değildir** —
doğrudan `cerrahi-plan`'a git.

## Kapılar

Kapılar sırayla geçilir. Her kapının **geçilemez ölçütü** vardır: ölçüt
sağlanmadan bir sonraki kapıya geçilmez. Kapıyı geçmek uzun sürmez —
küçük bir işte üçü toplam birkaç dakikadır — ama atlanmaları, haftalarca
yanlış şey inşa etmenin en yaygın sebebidir.

### Kapı 1 — Ürün: neyin yapılmaya değer olduğuna karar ver

Yaz:

- **Kim, hangi sorunu yaşıyor?** Öncesi → sonrası tek cümlede.
- **Başarı işareti:** ne olursa bu işin işe yaradığını anlarız?
- **Kapsam dışı:** bilerek YAPILMAYACAK olanlar (bu liste kapsamın çıpasıdır).
- **Kısıtlar:** süre, bütçe, platform, mevzuat, mevcut sistemler.

> **GEÇİLEMEZ:** Başarı işareti **gözlenebilir** değilse kapı kapalıdır.
> "Daha iyi olsun" bir işaret değildir. "Kullanıcı X akışını yardım
> almadan tamamlayabiliyor" işarettir. Sayı üreteceksen `olcum-sozlesmesi`.

Tek bir **birincil kullanıcı yolculuğunu** düz Türkçeyle yaz. Yazamıyorsan
sorun tarifsizdir; çözüm uydurmak yerine soruyu netleştir.

### Kapı 2 — Sistem: nasıl çalışacağına karar ver

Seçilen dilim için haritala:

- **Akış:** giriş noktası → adımlar → çıkış. **Boş, yükleniyor, hata ve
  tekrar-dene** durumları dahil.
- **Veri:** hangi varlıklar, sahibi kim, gerçeğin kaynağı nerede, hangi
  işlem geri alınamaz.
- **Yüzeyler:** ekran, API, olay, arka plan işi, üçüncü taraf servis.
- **Yetki ve gizlilik:** kim ne görebilir, sırlar nerede durur.
- **Başarısızlık:** en olası üç arıza ve kullanıcının gördüğü davranış.

> **GEÇİLEMEZ:** Mevcut kod **okunmadan** yeni yapı önerilemez. Kodda bu iş
> için zaten bir araç var mı — `grep` ile gerçekten ara, hafızadan sayma.
> İkinci bir çözüm yazacaksan `ikiz-kod` devreye girer.

Geri dönüşü pahalı bir seçim varsa (veritabanı, kimlik, üçüncü taraf
bağımlılık) **karar olarak işaretle**: seçenekler, öneri, bedel, ve
`serif-brain add decision --body "..."` ile kaydet. Kalıcı kural/sözleşme
üretiyorsan `--status standing` kullan — kural iş değildir, yaşlanmaz.

### Kapı 3 — Dilim: işi yürütülebilir hale getir

İşi **dikey dilimlere** böl. Her dilim:

- kullanıcının **görebileceği** bir sonuç üretir,
- dar bir sınırı vardır ve sınır yazılıdır,
- ön koşulları ve dokunacağı bileşenler listelidir,
- **kabul ölçütü** ve **nasıl doğrulanacağı** bellidir.

Sırala: önce çalışan mutlu yol, sonra güvenlik ve kenar durumlar, en son
cila. **Katmana göre bölme** ("tüm API'ler, sonra tüm UI") — o katman tek
başına teslim edilebilir değilse yasaktır.

> **GEÇİLEMEZ:** Kabul ölçütü **hangi veriyle** sağlanacağını söylemiyorsa
> dilim hazır değildir. "Çalışıyor" ölçüt değil; "repodaki gerçek fikstürle
> X akışı baştan sona tamamlanıyor" ölçüttür.

> **GEÇİLEMEZ — AÇIK İŞ TAVANI:** Yeni dilim açmadan önce `active-work.md`
> içindeki WIP sayacına bak. Tavan aşılmışsa **önce bir işi kapat**. Bulgu
> bırakmak istiyorsan iş açma, kuyruğa yaz — kuyruk tavana sayılmaz.

### Kapı 4 — Uygulama: tek dilim, tek iş parçacığı

Dilim seçildi. Buradan sonrası `cerrahi-plan`'ın işidir: teşhis, etki
haritası, en küçük kesik, bitti ölçütü. Bu skill'in buradaki tek katkısı
şu iki yasak:

- **Dilim bitmeden ikinci dilim açılmaz.** İş sırasında çıkan bulgu
  kuyruğa yazılır, peşinden gidilmez.
- **Kapsam sessizce büyütülmez.** "Hazır buradayken" düzeltmeleri
  bir sonraki dilimin konusudur.

### Kapı 5 — Sürüm: göndermenin güvenli olduğunu kanıtla

> **GEÇİLEMEZ:** Bu kapı `kanit-disiplini` olmadan geçilmez. Komut çıktısı
> görülmeden "bitti" denmez; koşulmamış kontrol, geçmiş kontrol değildir.

Ek olarak bu kapıda:

- Kabul ölçütü **hedeflenen kullanıcı yolculuğu için** sağlandı mı?
- Hata yolları, yetkiler, doğrulama, geri alınamaz işlemler kapsandı mı?
- Riskle orantılı: log, uyarı, bayrak, göç, geri alma planı var mı?
- Öğrenilen kalıcı şey `serif-brain`'e yazıldı mı? (Yazılmayan şey bir
  sonraki oturumda **yoktur**.)
- Kullanıcıya devir `somut-rapor` ile: ne değişti, nasıl doğrulandı,
  ne eksik kaldı, önerilen sonraki dilim.

## Hazır / Bitti

Bir dilim **hazır**dır: sonucu, sınırı, bağımlılıkları, kabul ölçütü ve
doğrulama yöntemi biliniyorsa.

Bir dilim **bitmiş**tir: kabul ölçütü ve ilgili kontroller **gerçekten
koşulup** geçtiyse, hata davranışı kabul edilebilirse, ve yeni kalıcı
kararlar kaydedildiyse.

## Yasaklar

- Belirsiz bir istekten doğrudan geniş uygulamaya başlamak.
- Varsayımı doğrulanmış gereksinim gibi sunmak. Olgu / varsayım / karar /
  açık soru ayrı ayrı yazılır.
- Kullanıcıyı gereksiz sorguya çekmek. Düşük riskli varsayımı **beyan
  ederek** ilerle; yalnızca cevabı kapsamı, maliyeti, güvenliği veya
  mimariyi değiştirecek soruyu sor.
- Başarı işareti gözlenebilir değilken Kapı 1'i geçmek.
- Mevcut kodu okumadan yeni yapı önermek.
- Kabul ölçütünü hangi veriyle sağlanacağını yazmadan bırakmak.
- Açık iş tavanı aşılmışken yeni dilim açmak.
- Dilim yarım kalmışken ikincisine geçmek.
- Kalıcı kararı yalnızca sohbette bırakmak — `serif-brain`'e yazılmayan
  karar bir sonraki oturumda yoktur.

## Yön değiştirme sinyalleri

Şunlardan biri olduğunda **dur ve yeniden planla**:

- İstenen değişiklik, yazılı kapsam dışı maddesiyle çelişiyor.
- Yeni bir bağımlılık, veri modeli, yetki modeli veya dış servis riski
  ya da maliyeti belirgin biçimde değiştiriyor.
- Çözüm, kullanıcı davranışını değiştiren bir geçici yama gerektiriyor.
- Doğrulama, dilimin varsaydığından **başka** bir kök sorun gösteriyor.
- İş artık tek, dar, test edilebilir bir sonuç olarak tarif edilemiyor.

Durduğunda: kanıtı özetle, gereken kararı adlandır, bir yol öner, ve
kullanıcının yetkisi dışına çıkma.
