---
name: somut-rapor
description: "Somut Rapor — yapılan işi kullanıcının anlayacağı şekilde anlatma disiplini. Bu skill'i bir iş bittiğinde, commit sonrası, 'ne yaptın', 'anlamadım', 'somut anlat', 'özetle', 'durum ne', 'nereye geldik' dendiğinde ve oturum devri/handoff yazarken MUTLAKA kullan; ayrıca kullanıcı bir açıklamandan sonra tekrar soru soruyorsa (anlaşılmadığının işaretidir) kullan. Amaç teknik olarak doğru ama okunamaz raporu engellemek — kullanıcı kararı rapora göre verir, anlaşılmayan rapor yanlış rapor kadar zarar verir: önce ne değiştiği söylenir, hangi yüzeyde olduğu adıyla belirtilir, önce/sonra sayıyla gösterilir, tanımlanmamış jargon kullanılmaz, 'hiçbir görünür şey değişmedi' gibi sonuçlar da açıkça söylenir."
---

# Somut Rapor

## Neden

Teknik olarak kusursuz bir rapor, anlaşılmıyorsa işe yaramaz — hatta zararlıdır,
çünkü kullanıcı kararını ona göre verir. "Anlamadım, somut anlat" cümlesi bir
üslup şikâyeti değil, **raporun başarısızlığıdır**.

Modelin doğal eğilimi kendi çalışma sırasını anlatmaktır: hangi dosyayı açtım,
hangi fonksiyonu buldum, nasıl refactor ettim. Kullanıcı bunu sormaz. Kullanıcı
şunu sorar: *benim için ne değişti, nerede değişti, emin miyim, sırada ne var?*

Bu skill raporu kullanıcının sorusuna göre yeniden sıralar.

## Zincir

### 1. İlk cümle: kullanıcı için ne değişti

Rapora değişimin **sonucuyla** başla, süreçle değil.

```
✗ "player-engine.template.ts'te handleClick'e interactive-option geçişi ekledim,
   ayrıca groupCompiledUnits helper'ını ir-compiler'dan çıkardım."
✓ "SCORM'a aktarılan quizlerde öğrenci artık şıkka fareyle tıklayabiliyor.
   Gerçek destede 3 slayttan 4'e çıktı — hepsi değil, nedenini aşağıda yazdım."
```

Görünür bir değişiklik yoksa **bunu da ilk cümlede söyle**: "Uygulamada hiçbir
fark görmezsin; bu commit ileride X'i imkânsızlaştıran bir kilit." Sessiz
kalmak kullanıcıya "bir şeyler değişti herhalde" dedirtir.

### 2. Yüzeyi adıyla söyle

Aynı üründe birden çok yüzey vardır: editör, önizleme, dışa aktarılan paket,
sunucu, mobil. Bir iddia hangi yüzeyde geçerliyse **o yüzeyin adı yazılır**.
Yüzey belirtilmeyen iddia, kullanıcının aklındaki başka bir yüzeye oturur ve
ikiniz aynı şeyi konuştuğunuzu sanarak farklı şeyler konuşursunuz.

Bakmadığın yüzeyi de yaz: "editörde durum farklı olabilir, oraya bakmadım."

### 3. Önce/sonra göster

Sayı veya gözlem, tek satırda karşılaştırmalı:

```
Önce : C şıkkına tıklama → hiçbir şey seçilmedi
Sonra: C şıkkına tıklama → cevap kaydedildi, seçim halkası göründü
```

İki sütunlu küçük bir tablo, üç paragraf açıklamadan iyidir. Sayı varsa
kapsamıyla birlikte gelsin (bkz. `olcum-sozlesmesi`).

### 4. Jargonu ya tanımla ya kullanma

Kullanıcının kendi kod tabanındaki terimler serbesttir (modül adları, dosya
adları, ürün kavramları). Ama **senin ürettiğin** teknik terimler — "parity
gate", "ratchet", "IR", "fallback", "idempotent" — ilk geçtiği yerde tek
cümleyle tanımlanır ya da hiç kullanılmaz.

Test: raporu okuyan kişi o terimi bilmiyorsa cümle anlamını koruyor mu?
Korumuyorsa terim yerine ne yaptığını yaz.

### 5. Kendi hatanı gömme

İş sırasında yanlış ölçtüysen, yanlış rapor verdiysen veya bir varsayımın
çürüdüyse, bunu **düzeltme olarak açıkça yaz** — raporun ortasına iliştirme.
Kullanıcı önceki rapora göre plan yapmış olabilir.

Düzeltme kısa olur: ne demiştim, doğrusu ne, neden yanıldım. Uzun pişmanlık,
tekrar tekrar özür ve öz-eleştiri gürültüdür; kullanıcıyı yormaz, yorar.

### 6. Kapanış: neyin açık kaldığı ve sırada ne var

Her rapor iki şeyle biter:
- **Kapatamadıklarım** — ve neden. "Yapamadım" değil, "şu sınır yüzünden
  bu yolla kapanmıyor, şu gerekiyor."
- **Sırada** — tek bir öneri. Çok seçenek sunmak karar yükünü kullanıcıya
  atmaktır; en doğrusunu öner, gerekçesini bir cümleyle yaz.

## Uzunluk

Rapor, işin büyüklüğüyle orantılı olsun ama **hiçbir zaman yaptığın işin
kronolojisi kadar uzun olmasın**. Kronoloji senin için anlamlıdır, kullanıcı
için değil. Yapılanların tamamını değil, **kullanıcının kararını etkileyenleri**
yaz.

Uzun bir oturumdan sonra: her commit için tek satır + tek bir "şu an nerede
duruyoruz" paragrafı yeterlidir.

## Rapor iskeleti

```
<Tek cümle: kullanıcı için ne değişti / değişmedi>

## Ne yaptım
<2-5 madde veya küçük tablo — dosya listesi değil, davranış>

## Kanıt
<önce/sonra + hangi yüzey + hangi veri>

## Kapatamadıklarım
<açık kalan + neden + ne gerekiyor>

## Sırada
<tek öneri + tek cümle gerekçe>
```

Küçük işlerde iskelet üç satıra iner; yine de sıra korunur: önce sonuç,
sonra kanıt, sonra açık kalanlar.

## Yasaklar

- Rapora süreçle başlamak (hangi dosyayı açtığınla, ne aradığınla).
- Yüzey belirtmeden iddia yazmak.
- Tanımlanmamış kendi jargonunu kullanmak.
- Görünür değişiklik olmadığını saklamak.
- Kendi yanlış raporunu düzeltmeden yenisini yazmak.
- Kapanışta üç-dört seçenek sıralayıp kararı tamamen kullanıcıya bırakmak.
- Kronolojiyi rapor sanmak.
