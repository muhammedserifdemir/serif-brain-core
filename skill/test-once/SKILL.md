---
name: test-once
description: "Test Önce — bitti ölçütünü koddan ÖNCE çalıştırılabilir hale getiren kapı. Bu skill'i bir bug'ı düzeltmeden, yeni davranış eklemeden veya bir sözleşmeyi (fonksiyon imzası, çıktı formatı, hesap kuralı) değiştirmeden ÖNCE kullan; 'test yaz', 'TDD', 'önce test', 'regression testi', 'bu bir daha olmasın' dendiğinde de tetiklenir. Amaç düzeltmenin GERÇEKTEN düzelttiğini kanıtlayabilmek: önce KIRMIZI gören bir test yazılır, sonra en küçük kod yeşile çevirir. Cerrahi Plan'ın 'bitti ölçütü' adımını çalıştırılabilir kılar; Kanıt Disiplini o testin çıktısıyla işi kapatır."
---

# Test Önce

## Neden

Düzeltmeden **sonra** yazılan test, düzeltmeyi doğrulamaz — düzeltmenin
mevcut halini tarif eder. Aradaki fark görünmezdir ve şuradan anlaşılır:
o test, hata **hâlâ oradayken** kırmızı olur muydu? Cevabı bilmiyorsan
testin sana hiçbir şey söylemiyor demektir.

Bu, kanıtı olan ama yanlış şeyi ölçen rapor sınıfının en yaygın hâlidir:
"test yazdım, geçiyor" cümlesi doğrudur ve hiçbir şey ispatlamaz. Testin
değeri geçmesinde değil, **doğru sebeple kırmızı olabilmesinde**dir.

İkinci pahalı biçim: aynı bug'ın altı ay sonra geri gelmesi. Kırmızıyı
görmüş bir test, o bug'ın mezar taşıdır — geri gelirse yeniden kırmızı
olur. Görülmemiş kırmızı öyle bir garanti vermez.

## Ne zaman zorunlu, ne zaman değil

**Zorunlu:**
- Bir bug düzeltilecek (test = bug'ın kendisi).
- Bir hesap, kural, dönüşüm veya ayrıştırma değişecek.
- Bir sözleşme değişecek: imza, dönüş tipi, hata davranışı, sıralama,
  çıktı formatı.
- Aynı mantık ikinci bir yerde yaşayacak → `ikiz-kod` ile birlikte.

**Zorunlu değil** (ama ölçüt yine yazılır):
- Yalnız görsel/stil değişikliği.
- Yeniden adlandırma, dosya taşıma gibi davranış değiştirmeyen işler.
- Tek seferlik script.

Test yazılamayan bir iş varsa bu **bir istisna değil, bir bulgudur**:
neden yazılamadığını açıkça söyle (ortam yok, dış servis, UI). O zaman
ölçüt elle doğrulanabilir bir komut/akış olur ve öyle beyan edilir.

## Zincir

### 1. Kırmızıyı yaz — ve GÖR

Testi, düzeltmeden önce yaz ve **çalıştır**. Kırmızı olmalı.

- Kırmızıysa: hata mesajını oku. **Beklediğin sebeple mi kırmızı?**
  Import hatası, yanlış dosya yolu veya syntax hatası yüzünden kırmızı
  olan test hiçbir şey doğrulamaz.
- **Yeşilse: dur.** Ya hata senin sandığın yerde değil, ya test yanlış
  şeyi ölçüyor. İkisi de plana dönmeyi gerektirir (`cerrahi-plan`).
  Yeşil bir "kırmızı test", teşhisin yanlış olduğunun kanıtıdır.

> **GEÇİLEMEZ:** Kırmızı çıktı **görülmeden** koda dokunulmaz. "Kırmızı
> olurdu" bir gözlem değildir.

### 2. Testi gerçek veriye bağla

Testin girdisi, üretimde geçen veriyi temsil etmelidir.

- Kendi yazdığın tek kolay fikstür iddiayı kapatmaz — kenar durumu,
  boş girdi, Türkçe karakter, gerçek fikstür dosyası.
- Çağrı yolu üretimdekiyle aynı olmalı: iç fonksiyonu doğrudan çağıran
  test, üretimde o fonksiyona giden sarmalayıcı bozuksa yeşil kalır.
- Sayı/oran üreten bir iddia test ediyorsan `olcum-sozlesmesi` bu kısmı
  ayrıntılandırır.

> **GEÇİLEMEZ:** "Hangi veriyle" sorusunun cevabı yoksa test ölçüt değildir.

### 3. En küçük kodla yeşile çevir

Kırmızıyı yeşile çeviren **en küçük** değişikliği yaz. Testi geçirmeyen
ek iyileştirmeler bu turun konusu değildir — kuyruğa.

Test geçmiyorsa **testi yumuşatma.** Ölçütü gevşetmek (assert'i silmek,
beklentiyi çıktıya uydurmak, `skip` koymak) semptomu maskelemenin test
hâlidir ve yasaktır. Ölçüt yanlışsa gerekçesiyle beyan edilerek değişir.

### 4. Yeşili doğrula, sonra çevresini koru

- Yeni test yeşil.
- **Mevcut testler hâlâ yeşil** — tam süiti çalıştır, yalnız yeni dosyayı
  değil. Çağıranları kırmadığının tek kanıtı budur.
- Test sayısı iddia eden bir belge varsa (README vb.) sayı güncellenir.

### 5. Testi bug'a bağla

Bug düzeltiyorsan, testin **neden** var olduğunu testin içine yaz: hangi
bug, hangi girdi, hangi yanlış davranış. Bir yıl sonra o testi okuyan
kişi (sen olabilirsin) neden var olduğunu anlayamazsa test silinmeye
adaydır.

`serif-brain` kullanan projede: kaydı testle ilişkilendir —
`serif-brain close bug-... --note "test: <dosya>::<test adı>; kırmızıydı, şimdi yeşil"`.

## Yasaklar

- Kırmızıyı görmeden koda dokunmak.
- Yanlış sebeple kırmızı olan testi (import/syntax hatası) kanıt saymak.
- "Kırmızı olurdu" diyerek adım 1'i atlamak.
- Testi geçirmek için ölçütü gevşetmek, assert silmek, `skip` koymak.
- Yalnız yeni testi çalıştırıp "geçti" demek — tam süit koşulmadan
  çağıranların kırılmadığı bilinemez.
- Sentetik tek fikstürle gerçek veri iddiası kapatmak.
- Üretimdeki çağrı yolunu atlayıp iç fonksiyonu doğrudan test edip
  "uçtan uca çalışıyor" demek.

## Zincirdeki yeri

| Önce | `cerrahi-plan` bitti ölçütünü yazar |
| Bu skill | o ölçütü **çalıştırılabilir** hale getirir ve kırmızısını gösterir |
| Sonra | `kanit-disiplini` gerçek komut çıktısıyla işi kapatır |

Ölçüt `cerrahi-plan`'da yazılır, burada koda dönüşür, `kanit-disiplini`'nde
kanıt olur. Üçü aynı ölçüttür — sonradan yumuşatılamaz.
