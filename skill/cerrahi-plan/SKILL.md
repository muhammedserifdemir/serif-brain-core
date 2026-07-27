---
name: cerrahi-plan
description: "Cerrahi Plan — koda dokunmadan ÖNCE zorunlu teşhis ve planlama zinciri. Bu skill'i her bug fix, davranış değişikliği, refactor veya 'şunu düzelt', 'şu hatayı çöz', 'şu özelliği ekle' isteğinin BAŞINDA mutlaka kullan; özellikle semptomun nedeni belirsizken, birden çok dosyaya dokunulacakken veya mevcut bir davranış değişecekken. Amaç yanlış teşhisle doğru kod yazmayı engellemek: kök neden kanıtla bulunur, etki haritası çıkarılır, en küçük değişiklik seçilir, 'bitti' ölçütü düzenlemeden önce yazılır. Kanıt Disiplini skill'i işi kapatır; bu skill işi açar."
---

# Cerrahi Plan

## Neden

Kod yazan modellerin en pahalı hatası kötü kod değil, **yanlış teşhisle
yazılmış iyi koddur**: semptomu susturan ama kök nedeni bırakan düzeltme,
yanlış katmana yapılan müdahale, kodda zaten var olan helper'ın ikinci kez
yazılması, bir fonksiyon değişirken onu çağıran yerlerin unutulması.
Bunların hepsi tek nedenden çıkar: **anlamadan kesmeye başlamak.**

Bu skill bir ameliyat protokolüdür. Cerrah, neşteri hastayı görmeden,
tahlilleri okumadan, kesiğin sınırını çizmeden eline almaz. Aynı disiplin:
aşağıdaki dört adım tamamlanmadan hiçbir dosya düzenlenmez. Adımlar
uzun değildir — basit bir işte dört adım toplam birkaç dakikadır — ama
atlanmaları, saatlerce yanlış yönde kod yazmanın en yaygın sebebidir.

## Ameliyat öncesi zincir

### 1. Teşhis — semptomu üret, kök nedeni kanıtla

Önce semptomu kendi gözünle gör: hatayı yeniden üret (test, komut, log).
Üretemiyorsan bunu açıkça söyle ve teşhisi "doğrulanmamış hipotez" olarak
etiketle — hipotez üstüne kesin dille plan kurma.

Sonra semptomdan kök nedene **kanıt zinciriyle** in: stack trace'i oku,
veri akışını gerçekten izle (bu değer nereden geliyor, nerede bozuluyor?),
şüpheli noktaya log koy veya küçük bir deneme çalıştır. "Muhtemelen
şuradandır" bir teşhis değildir. Teşhisin testi şudur: *bozuk davranışı
hangi satırın hangi girdiyle ürettiğini gösterebiliyor musun?*

Semptomun göründüğü yer ile kök nedenin yaşadığı yer çoğu zaman farklı
dosyalardadır. Semptomun olduğu yere yama yapmak (çıktıyı maskelemek,
NaN'ı sıfıra çevirmek, hatayı yutmak) kök neden bulunamadıysa ancak
bilinçli ve beyan edilmiş bir geçici çözüm olarak kabul edilir — sessiz
semptom yaması yasaktır.

### 2. Etki haritası — kesiğin çevresini tanı

Değiştireceğin fonksiyon/modül için cevapla:

- **Kim çağırıyor?** (`grep` ile gerçekten ara; hafızadan sayma.)
- **Hangi sözleşmeler var?** Dönüş tipi, null/hata davranışı, sıralama,
  yan etkiler — çağıranlar bunların hangisine güveniyor?
- **Bu iş için kodda zaten bir araç var mı?** Yeni helper yazmadan önce
  mevcut util/helper'ları ara. Aynı işi yapan ikinci fonksiyon, gelecekte
  sessizce ayrışan iki gerçek demektir.

Bu adımın çıktısı kısa bir liste: dokunulacak dosyalar + etkilenen
çağıranlar + korunacak sözleşmeler.

### 3. En küçük kesik — kapsamı çiz

Kök nedeni çözen **en küçük** değişikliği seç. Büyük refactor, ancak küçük
değişiklik gerçekten imkânsızsa ve kullanıcı onaylarsa gündeme gelir —
"hazır buradayken şunu da düzelteyim" cerrahi bir hata türüdür.

Planı iki listeyle yaz:
- **Dokunulacak:** dosya/fonksiyon bazında, her birinde ne değişecek.
- **Dokunulmayacak:** çalışan ve kapsam dışı kalan komşu kod — bilerek
  isimlendir. Bu liste, iş sırasında kapsam kaymasını fark etmenin çıpasıdır.

### 4. Bitti tanımı — ölçütü kesmeden önce yaz

Düzenlemeye başlamadan, "bitti"nin nesnel ölçütünü tek satırda yaz:
hangi test/komut hangi sonucu verirse iş bitmiş sayılacak? (Ör: "skor.test
3/3 geçer, tsc 0 hata, çağıran 2 dosyanın testleri yeşil kalır.")

Bu ölçüt sonradan yumuşatılamaz; iş sonunda doğrulama (varsa
kanit-disiplini skill'i ile) bu ölçüte karşı yapılır.

## Plan formatı

Zincir bitince, kesime başlamadan önce planı bu kısa blokla sun:

```
TEŞHİS: <kök neden — dosya:satır + kanıt (test çıktısı/trace)>
ETKİ: <çağıranlar ve korunan sözleşmeler>
KESİK: <dokunulacak dosyalar> | DOKUNULMAZ: <kapsam dışı bırakılanlar>
BİTTİ ÖLÇÜTÜ: <komut + beklenen sonuç>
```

Basit ve tek dosyalık işlerde blok üç-dört satırı geçmez; yine de yazılır,
çünkü en tehlikeli varsayımlar "basit" görünen işlerde yapılır. Kullanıcı
planı görünce itiraz etmezse (veya önceden onay verdiyse) kesime geç.

## Yasaklar

- Semptomu yeniden üretmeden veya üretemediğini beyan etmeden düzeltmeye
  başlamak.
- Kanıtsız teşhis üstüne kesin dille plan kurmak ("muhtemelen", "büyük
  ihtimalle" ile başlayan cümle teşhis değildir).
- Çağıranları grep'lemeden imza/davranış değiştirmek.
- Mevcut helper'ı aramadan yenisini yazmak.
- Plan bloğunda beyan edilmemiş dosyaya dokunmak — kapsam büyüyecekse
  önce planı güncelle ve söyle.
- "Hazır buradayken" düzeltmeleri — kapsam dışı bulguları düzeltme,
  raporla.
