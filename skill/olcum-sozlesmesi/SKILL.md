---
name: olcum-sozlesmesi
description: "Ölçüm Sözleşmesi — bir SAYI, ORAN veya KARŞILAŞTIRMA üretmeden önce zorunlu kurulum zinciri, ve her iddianın kapsam etiketiyle raporlanması. Bu skill'i 'kaç tanesi çalışıyor', 'ne kadarı bozuk', 'kaçı düzeldi', 'ölç', 'karşılaştır', 'öncesi/sonrası', 'yüzde kaç', 'gerçekten düzeldi mi', 'benchmark', 'audit', 'tarama yap', 'sağlık kontrolü' isteklerinde MUTLAKA kullan; bir düzeltmenin etkisini raporlarken, temel çizgiyle karşılaştırırken ve iki üretici/yol/sürümün aynı sonucu verip vermediğini sorgularken de kullan. Amaç kanıtı olan ama YANLIŞ ŞEYİ ölçen raporu engellemek: veri üretim dağılımını temsil etmeli (sentetik tek fikstür iddia kapatmaz), çağrı yolu üretimdekiyle birebir olmalı, ölçüt iddianın kendisi olmalı, sayı kapsam etiketiyle söylenmeli. Cerrahi Plan işi açar, bu skill ölçümü kurar, Kanıt Disiplini işi kapatır."
---

# Ölçüm Sözleşmesi

## Neden

Kanıt disiplini "komut çıktısı olmadan sayı yazma" der. Ama bir modelin
ürettiği yanlış raporların çoğunda **komut çıktısı vardır** — sadece yanlış
şeyi ölçmüştür:

- sentetik tek fikstürle doğrulanıp "çalışıyor" denir; gerçek veride 3/20 çıkar
- ölçüm için üretimdeki çağrı taklit edilir, parametresi (seed/bağlam/sıra)
  tutmaz; sayı gerçeğin değil taklidin sayısıdır
- ölçüt iddiaya değil, hesaplaması kolay olana göre seçilir ("ikisi de aynı
  aileden" diye bakılır, oysa iddia "aynı görünüyor"dur)
- sayı kapsamsız verilir; iki taraf farklı yüzeyden konuşup boşuna tartışır

Bunların ortak kökü: **ölçüm, iddiadan önce kurulmamıştır.** Sayı çıktıktan
sonra "neyi ölçtüm" diye bakmak çok geçtir — sayı bir kez söylendiğinde
kullanıcı onun üstüne karar verir.

Bu skill sayıyı üretmeden önceki üç satırı ve sayıyı söylerken taşınacak
etiketi zorunlu kılar. Uzun değildir; asıl maliyet atlanmasındadır.

## 1. Ölçüm sözleşmesi — sayı üretmeden önce yaz

Herhangi bir sayı/oran/karşılaştırma üretecekseniz, önce bu üç satır:

**VERİ** — hangi örneklem? Üretim dağılımını temsil ediyor mu?
Kendi yazdığınız tek fikstür neredeyse hiçbir zaman temsil etmez: tek üretici
yolunu, tek içerik şeklini, tek konfigürasyonu görürsünüz. Repoda gerçek
veri (fikstür destesi, örnek proje, kayıtlı çıktı) varsa **onu kullanın**;
yoksa "temsil etmiyor" diye açıkça etiketleyin. Sentetik veri hipotez
kurmak için iyidir, **iddia kapatmak için değil**.

**YOL** — üretimde bu iş hangi fonksiyondan geçiyor?
Ölçüm için çağrıyı yeniden kurmak yerine **üretimdeki çağrı noktasını arayın**
(`grep` ile gerçekten arayın). Çoğu olgun kod tabanında zaten "iki motorun
aynı sonucu ürettiğini" garanti eden bir fonksiyon vardır ve docstring'inde
bunu söyler. Kendi kurduğunuz çağrı, üretimin geçtiği parametreleri (seed,
bağlam, sıra, hafıza, policy) kaçırırsa ölçtüğünüz şey üretim değildir.

**ÖLÇÜT** — iddia tam olarak neydi?
Ölçütü iddianın kendisinden türetin, hesaplaması kolay olandan değil.
"Aynı görünüyor" iddiasının ölçütü "aynı variant" değildir; "aynı aileden"
hiç değildir. Gevşek ölçüt yanlış tarafa yanılır: geçmemesi gerekeni
geçirir ve size "düzeldi" dedirtir.

**Zincirin SON halkasını ölçün, ilk gözlemlenebilir halkasını değil.**
Bir davranış genellikle birkaç adımdan geçer: işaret var mı → isabet ediyor mu
→ durum kaydedildi mi → sonuç doğru mu. İlk adım kolay ölçülür ve kolayca
"çalışıyor" dedirtir; kullanıcının yaşadığı ise son adımdır. "Tıklanabilir"
ile "tıklama işe yarıyor" farklı ölçütlerdir — birincisi geçip ikincisi
kalabilir, ve o boşlukta ürün kullanıcıya *yalan söyler* (tıklanabilir
görünen ama hiçbir şey yapmayan bir arayüz, hiç tıklanabilir görünmeyenden
kötüdür). Zinciri yazın, hangi halkada ölçtüğünüzü söyleyin.

Üçü yazıldıktan sonra ölçün. Sonuç sürpriz çıkarsa **önce ölçümden şüphelenin** —
özellikle sonuç "hiçbir şey çalışmıyor" veya "her şey mükemmel" gibi uç bir
değerse, çoğunlukla ölçüm kusurludur.

## 2. Kapsam etiketi — her sayı üç şey taşır

Çıplak sayı yanıltır. Aynı üründe iki kişi farklı yüzeyden bakıp ikisi de
haklı olabilir — biri editörü, diğeri export edilmiş paketi kastediyordur.

Her sayı **yüzey + örneklem + yol** ile birlikte söylenir:

```
✗ "3/20 tıklanabiliyor"
✓ "3/20 tıklanabiliyor (export edilen SCORM paketi · 2 gerçek deste ·
   lessonToSerifProject yolu). Editörde durum farklı, oraya bakmadım."
```

Bakmadığınız yüzeyi de söyleyin. "Bilmiyorum" bir bulgudur; sessizlik
kullanıcıya "her yerde böyle" diye okunur.

## 3. Regresyon kapısı yazarken fikstür UZAYI kapsamalı

Ölçüm bittikten sonra genellikle bir kapı (test) yazılır ki bulgu geri
gelmesin. Burada aynı tuzak ikinci kez kurulur: kapı, ölçümde kullandığınız
**tek kolay örnekle** yazılır. Kapı yeşil yanar, herkes rahatlar — oysa kapı
yalnızca zaten çalışan durumu bekliyordur.

Gerçek bir örnek: bir hattı düzelten üç ayrı kapı yazıldı, üçü de yeşildi ve
üçü de **aynı sentetik multiple-choice fikstürünü** kullanıyordu. Aynı hatta
16 farklı soru tipi vardı ve bunların çoğunda hat çalışmıyordu. Kapılar
"çalışan %20"yi koruyordu.

Kapı yazarken sorun: **bu davranışın kaç farklı üreticisi/tipi/yolu var?**
Fikstür o uzayı örneklemeli — hepsini değil ama her sınıftan birini. Kapsamı
kapının başına yazın ("16 tipin 4'ü: her üretici ailesinden bir tane").
Kapsanmayanı da yazın; sessiz kapsam, yanlış güven üretir.

## 4. Temel çizgi karşılaştırmasında kapsamı sabit tut

"0 hata / hepsi yeşil" olmayan olgun kod tabanlarında tek ölçü sayının
kendisidir — ve o sayı **kapsama** bağlıdır. Aynı testleri `shared/` diye
çağırmakla `shared/cekirdek shared/adaptor shared/__tests__` diye
çağırmak farklı dosya kümesi toplar; sayı değişir, siz bunu regresyon
sanarsınız (veya daha kötüsü: regresyonu kaçırırsınız).

Temel çizgiyi hangi kapsamla aldıysanız **karşılaştırmayı birebir aynı
kapsamla** yapın: aynı yol listesi, aynı filtreler, aynı hariç tutmalar.
Kapsamı raporda yazın ki bir sonraki ölçüm aynısını kullanabilsin.

## Rapor formatı

Ölçüm bitince tek blok:

```
ÖLÇÜM: <ne ölçüldü>
VERİ: <örneklem — temsil ediyor mu>
YOL: <üretimdeki çağrı noktası>
ÖLÇÜT: <iddianın tam karşılığı>
SONUÇ: <sayı> (<yüzey> · <örneklem> · <yol>)
BAKILMAYAN: <ölçüm dışı kalan yüzey/durumlar>
```

Sayı beklenenden farklıysa, farkın nedenini ölçümle açıklayın — "muhtemelen
şundandır" bir açıklama değildir.

## Yasaklar

- Sözleşmenin üç satırını yazmadan sayı üretmek.
- Sentetik tek fikstürle bir iddiayı kapatmak (hipotez kurmak serbest).
- Üretimdeki çağrı noktasını aramadan kendi ölçüm çağrısını kurmak.
- Ölçütü iddiadan değil, hesap kolaylığından seçmek.
- Çıplak sayı raporlamak (yüzey/örneklem/yol etiketi olmadan).
- Temel çizgi karşılaştırmasında kapsamı değiştirmek.
- Zincirin ilk gözlemlenebilir halkasını ölçüp son halkası hakkında konuşmak.
- Regresyon kapısını tek kolay fikstürle yazıp uzayı kapsadığını sanmak.

## Komşu skill'ler

Bu skill yalnız **ölçümü kurar**. Yakın sorumluluklar başka yerde:

- İşin kapsamı, en küçük kesik, dallanma kontrolü → `cerrahi-plan`
- Ortam tuzakları (çalışma dizini, üretilmiş kod, kopya ağaçlar) ve
  "bitti" doğrulaması → `kanit-disiplini`
- Proje hafızasındaki teşhislerin hipotez sayılması → `serif-brain-core`
