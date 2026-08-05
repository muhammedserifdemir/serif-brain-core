---
name: ikiz-kod
description: "İkiz Kod — aynı mantığın iki ayrı yerde yaşamak zorunda olduğu durumlarda kopyaların sessizce ayrışmasını engelleyen mekanik kapı. Bu skill'i şu durumlarda MUTLAKA kullan: bir fonksiyonu/kuralı ikinci kez yazmak üzereyken; standalone paket, gömülü/üretilmiş kod, template literal içindeki script, farklı runtime (tarayıcı/Node/worker/oynatıcı), farklı dil (TS↔Python↔SQL) veya sunucu/istemci arasında AYNI hesabın tekrar yazılması gerektiğinde; kodda 'SYNC_WITH', 'keep in sync', 'burayı değiştirirsen şurayı da değiştir' gibi yorumlar gördüğünde; 'renderer parity', 'export parity', 'iki motor aynı sonucu vermeli' işlerinde. Amaç: kopya kaçınılmazsa yorum konvansiyonuyla yetinmemek — kopyayı üretilmiş çıktıdan söküp orijinalle aynı fikstür matrisinde karşılaştıran bir test yazmak. Yorum denetlenmez, test denetlenir."
---

# İkiz Kod

## Neden

Bazen aynı mantık iki yerde yaşamak zorundadır ve bu bir tasarım hatası
değildir: standalone bir paket `import` edemez, template literal içine gömülen
script derleme hattının dışındadır, tarayıcı ile sunucu farklı dilde konuşur,
oynatıcı bağımsız çalışmak zorundadır. Kod paylaşımı gerçekten mümkün değildir.

Bu duruma verilen olağan cevap bir yorumdur:

```
// SYNC_WITH_RENDERER: burayı değiştirirsen player-renderer'ı da değiştir
```

Bu cevap işe yaramaz. Yorum denetlenmez; kimse iki tarafı yan yana koyup
karşılaştırmaz. Kopyalar aylarca sessizce ayrışır ve fark "önizlemede başka
görünüyor", "export'ta çalışmıyor" gibi çok sonra, çok pahalı bir yerde
patlar. Gerçek bir kod tabanında ölçüldü: on tane böyle yorum vardı, hiçbiri
denetlenmiyordu; kayıt bunu kendi içinde itiraf ediyordu ("CI taramasında 0
eşleşme"). O çiftlerden yalnız birine mekanik kapı kurulduğunda **ilk koşumda**
gerçek bir ayrışma çıktı.

Bu skill kopyayı yasaklamaz — kopyayı **denetlenebilir** kılar.

## Zincir

### 1. Kopya gerçekten zorunlu mu?

Önce paylaşımı dene. Çoğu "zorunlu kopya" aslında tembelliktir:
- İki taraf da aynı derleme hattındaysa → ortak modüle çıkar, işin biter.
- Bir taraf üretilmiş metin (template/string) ise → mantığı saf bir fonksiyona
  çıkar, üretilmiş tarafa **o fonksiyonun kaynağını göm** (aşağıda).
- Gerçekten farklı runtime/dil ise → kopya zorunludur, 2. adıma geç.

Kopyanın zorunlu olduğunu **beyan et**: hangi sınır yüzünden paylaşılamıyor?
Beyan edemiyorsan muhtemelen paylaşabilirsin.

### 2. Tek kaynağı seç

İki kopyadan biri **kanonik**tir; diğeri onu izler. Kanonik olan, tip
sisteminin ve testlerin kapsadığı taraf olmalı — orada bir hata daha erken
yakalanır. Kanonik tarafta mantık **saf** olsun: dış bağımlılık, global durum,
DOM erişimi olmasın. Saf olmayan kod karşılaştırılamaz.

### 3. Mekanik kapı yaz — asıl iş bu

Kapı şunu yapar: kopyayı **üretilmiş çıktıdan söker**, izole bir kapsamda
çalıştırır, kanonik uygulamayla **aynı girdi matrisinde** karşılaştırır.

Üretilmiş metinden fonksiyon sökme (dil bağımsız fikir):

```ts
/** Script string'inden bir fonksiyon gövdesini süslü-parantez sayarak söker. */
function fonksiyonKaynagi(src: string, ad: string): string {
  const bas = src.indexOf(`function ${ad}(`);
  if (bas < 0) throw new Error(`${ad} bulunamadı`);
  let i = src.indexOf('{', bas), derinlik = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') derinlik++;
    else if (src[i] === '}') { derinlik--; if (derinlik === 0) return src.slice(bas, i + 1); }
  }
  throw new Error(`${ad} gövdesi kapanmadı`);
}
```

Sökülen fonksiyon kapsam değişkenlerine (closure) bakıyorsa, onları
**parametreye çevirerek** izole et — böylece bağımlılık açıkça görünür:

```ts
const kur = new Function('suAn', 'gorunurlukEzmeleri', `${kaynak}
  return { hedefFn: hedefFn };`);
```

Sonra iki uygulamayı aynı matriste koştur ve **birebir eşitlik** iste.
Gevşek karşılaştırma (truthy/falsy) ayrışmayı gizler: bir taraf `false`,
diğeri `undefined` dönüyorsa bugün zararsızdır ama yarın `=== false`
yazan biri geldiğinde sessizce bozulur.

### 4. Fikstür matrisini tuzaklarla kur

Kapı ancak matrisi kadar iyidir. Üç sınıf girdi olsun:

- **Normal**: gerçek üretim verisinden alınmış tipik değerler.
- **Sınır**: kenarın tam üstü/altı, sıfır, boş, en büyük/küçük.
- **Tuzak**: eşleşiyormuş gibi *görünen* ama eşleşmemesi gerekenler
  (`group:adopt3` ile `group:opt3` gibi), görünmez/zaman dışı öğeler,
  üstte duran ama hedef olmayan komşular.

Tuzaklar en değerlisidir: iki uygulamanın **aynı yanlışı** yapmadığını değil,
aynı doğruyu yaptığını gösterirler.

### 5. Yorumu da yaz — ama yorumla yetinme

Her iki tarafa da kısa bir işaret koy ve **kapının adını** ver:

```
SYNC: interactive-option-info.ts getQuizOptionIndex — quiz-hit-parity testi kilitler.
```

Yorum insan içindir, kapı makine içindir. Yorum tek başına bir sözleşme değil,
bir dipnottur.

## Kapıyı ne zaman yazamazsın

Bazı ikizler karşılaştırılamaz: çizim komutları, animasyon, rastgelelik,
zamanlama. Bu durumda **kapıyı yazmadığını açıkça söyle** ve nedenini yaz —
sessizce geçme. Alternatif: karşılaştırılabilir bir alt küme çıkar (ör. çizim
yerine "hangi komutlar hangi sırayla çağrıldı" kaydı) ve onu kapıya bağla.

## Rapor formatı

```
İKİZ: <hangi mantık, hangi iki yerde>
ZORUNLU MU: <hangi sınır paylaşımı engelliyor>
KANONİK: <tek kaynak dosya:fonksiyon>
KAPI: <test dosyası> — <matris boyutu: kaç fikstür × kaç girdi × kaç senaryo>
İLK KOŞUM: <ayrışma çıktı mı, çıktıysa ne>
```

Matris boyutunu yazarken çarpım gibi okunan ifade kullanma; **gerçek
karşılaştırma sayısını** yaz.

## Yasaklar

- Paylaşımı denemeden "zorunlu kopya" demek.
- İkinci kopyayı yazıp yalnız yorumla işaretlemek.
- Gevşek karşılaştırma (truthy/falsy, "ikisi de hata verdi") ile eşitlik iddia etmek.
- Matrisi yalnız mutlu yoldan kurmak — tuzak girdisi olmayan kapı boş kapıdır.
- Kapı yazılamayan ikizi sessizce bırakmak.
