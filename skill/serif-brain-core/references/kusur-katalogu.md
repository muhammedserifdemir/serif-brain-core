# Kusur Kataloğu — "küçük detay" sınıfları

§5.4'te `scripts/katalog-tara.sh` diff'e bakıp ilgili sınıfları listeler. Tetiklenen her
sınıf için tek satır yazılır: `K07: yok (neden)` · `K07: var → düzeltildi (test X)` ·
`K07: var → PARK`. Betiğin göremediği anlamsal sınıflar için aşağıdaki **"Her zaman sor"**
bölümü her dilimde okunur. Toplu "yok" yazmak yasaktır: "yok" yazılan her sınıfın
nedeni de yazılır (K61, ayırt etmeyen ✓).

Derin mantık incelemesi (durum makinesi, hata yolu, kenar durumu, yetki, veri tutarlılığı,
güvenlik, performans) **kod-denetim** mercekleriyle yapılır. Bu katalog hızlı bir diff
taramasıdır: her dilimde koşar, kod-denetim'in yerini tutmaz.

**Vaka** sütunu bizim projelerimizde gerçekten yaşanmış örnektir. Yeni bir sınıf yaşanınca
listenin sonuna eklenir (§7 katalog beslemesi).

---

## Her zaman sor — betiğin göremediği 5 soru

1. **Veri sonuna kadar gidiyor mu?** Ürettiğim ya da değiştirdiğim alanı son yüzeye
   (ekran, dışa aktarma, köprü, e-posta) kadar izledim mi? (K02, K06)
2. **Başarı mesajı sonucu mu ölçüyor?** (K10, K60)
3. **Bu değişikliğe bağlı başka ne var?** Sabit, eşik, ikiz kod, eski kayıt, eski istemci.
   (K11, K50, K70, K78)
4. **Yetkisiz ya da başka kiracı ne görür?** (K30, K31)
5. **Kötü yol nedir?** Boş, hata, zaman aşımı, çift tık, geri tuşu. Kullanıcı o anda ne
   görüyor? (K20, K40, K72, K74)

---

## A. Bağlantı — "kod var ama çalışmıyor"

| # | Sınıf | Nasıl yakalanır | Vaka |
|---|---|---|---|
| K01 | **Ölü düğme / bağlanmamış dinleyici.** Öğe render ediliyor, handler yazılmamış ya da yanlış öğeye bağlanmış | Her yeni ya da değişen etkileşimli öğe için gerçek tıklama ve gözlenen etki | AnimatorX "⋯" düğmesinin dinleyicisi hiç yazılmamıştı; 10 araç erişilemiyordu |
| K02 | **Veri yolda düşüyor.** Üretici yazıyor, tüketici okumuyor (alan, köprü ya da aktarma atlıyor) | Veriyi kaynaktan son yüzeye kadar izle; her aşamada alanın varlığını kontrol et | içerik modülü görseli `ozel-img://` yazıyordu, sunum modülü okumuyordu, editör modülü köprüsü taşımıyordu |
| K03 | **Alan adı / sözleşme uyuşmazlığı.** İki taraf farklı alan adı ya da biçim bekliyor; hata vermez, yanlış cevap verir | Paylaşılan tip ya da şema; sözleşme testi | TellMe marquee hatası |
| K04 | **İstemci çağırıyor, uç yok ya da taşınmış (404).** | İstemcideki tüm URL'leri sunucu route listesiyle karşılaştır | masaüstü paket lisans ve güncelleme uçları site yeniden yapılınca 404 verdi |
| K05 | **Kısayol veya olay yanlış hedefe kaçıyor.** Odak, seçim ya da bağlam yanlış | Odak durumunu değiştirip kısayolu tekrar dene | AnimatorX `i`/`x` kısayolları seçili nesneye kaçıyordu |
| K06 | **Önizleme ve gerçek farklı yol kullanıyor.** Önizleme sahneyi ya da veriyi kurmuyor | Önizleme ile çıktıyı aynı veriyle karşılaştır | AnimatorX'te 2 kişilik klip önizlemede tek kişi görünüyordu |

## B. Doğruluk — "çalışıyor ama yanlış"

| # | Sınıf | Nasıl yakalanır | Vaka |
|---|---|---|---|
| K10 | **Başarı mesajı iddiası doğrulanmıyor.** "Üretildi/kaydedildi" mesajı sonucun gerçekleşmesine bağlı değil | Mesaj, sonucun gözlenmesinden SONRA mı gösteriliyor? Testte sonucun kendisini ölç | "12 görsel üretildi" yazıyordu, slaytta görsel yoktu |
| K11 | **Bağımlı sabit güncellenmedi.** Çözünürlük, birim ya da ölçek değişti, ona bağlı eşik ve sabitler eski kaldı | Değişen her boyut/birim için `grep` ile tüm tüketicileri bul | avatar modülünde aynı sınıf 3 kez yaşandı |
| K12 | **Türkçe harf dönüşümü.** `.upper()`/`.lower()`/`toUpperCase()` i/İ/ı/I eşleşmesini sessizce kaçırır | Metne VE desene `tr_fold`/`toLocaleUpperCase('tr')` uygula; İ/ı içeren fikstürle test et | Bir taramada üç kez ısırdı; hata atmaz, yalnız az sayar |
| K13 | **Türkçe sıralama ve arama.** Varsayılan sıralama Ç/Ş/Ü harflerini sona atar; alt-dizi araması tamlamada baş kelimeyi kaçırır | `localeCompare(x,'tr')`; ekli ve tamlamalı örnekle test et | AnimatorX kütüphanesinde A→Z sıralama; prop araması "…rafı"→"raf" bulamıyordu |
| K14 | **Ayna veya işaret hatası.** Simetrik yapıda ters çarpım, işaret ya da eksen | Sol ve sağı ayrı ayrı test et | Aynalanmış iskelette parmaklar dışa bükülüyordu |
| K15 | **Ölçüm üretimi taklit ediyor.** Test ya da ölçüm kodu üretim mantığını kopyalıyor | Ölçüm üretimi IMPORT eder (olcum-sozlesmesi §1b) | Bir oturumda 5 yanlış ölçüm |
| K16 | **Yuvarlama, para, tarih.** Kayan nokta ile para hesabı, saat dilimi (UTC/TR), gün sınırı, yaz saati | Para tam sayı kuruş; tarih saklama UTC, gösterim yerel; gün sınırında test | — |
| K17 | **Sıfırlanmayan sayaç veya durum.** Yeni döngüde eski deneme sayısı ya da hakkı kalıyor | Döngüyü iki kez koşturan test | LMS ürününde yenilenen eğitimde sınav hakkı sıfırlanmıyordu; 19 kişi kilitlendi |
| K18 | **Yayınlanmamış veya taslak içerik akışa sızıyor.** | Taslak/yayında/silinmiş durumlarının her biriyle akışı koştur | LMS ürününde yayınlanmamış ders yüzünden eksik eğitimle sertifika veriliyordu |

## C. Sessiz başarısızlık

| # | Sınıf | Nasıl yakalanır | Vaka |
|---|---|---|---|
| K20 | **Yutulan hata.** `catch {}`, `.catch(()=>null)`, `|| []` hatayı "boş" sonuca çeviriyor | Diff'teki her catch için sor: kullanıcı ne görüyor, log nereye düşüyor? | — |
| K21 | **Sessiz kesilme.** Model çıktısı, dosya ya da liste sınırda kırpılıyor; hata yok | Uzunluk, sayı ve kapanış işaretini doğrula | içerik modülü "JSON kapatma eksik"; anlik.js 614 KB'lık veriyi 16 bayta indirdi |
| K22 | **Zaman aşımı etkisiz ya da yok.** Parametre o kod yolunda okunmuyor | Yavaşlatılmış sahte sunucuyla dene | Gemini `httpOptions.timeout` `interactions` yolunda çalışmıyordu |
| K23 | **Varsayılan değer yanlış yöne düşüyor.** Ayar yoksa özellik kapalı/açık doğuyor ve kimse fark etmiyor | Ayarsız durumda davranışı test et ve belgele | Zamanlanmış İşler'de yeni işler kapalı doğuyor |
| K24 | **Kalan durumlar mesajsız.** `switch`/eşleme yeni değeri bilmiyor | Kapsamlı eşleme (`never` kontrolü); bilinmeyen değerde gürültülü hata | LMS ürünü kuyruk işçisinde "bilinmeyen tür" hatası |

## D. Çoklu kiracı, yetki, veri

| # | Sınıf | Nasıl yakalanır | Vaka |
|---|---|---|---|
| K30 | **Kiracı süzgeci eksik.** Sorgu `org_id`/`tenant` koşulsuz | Diff'teki her sorgu için sor: kiracı koşulu nerede? İki kiracılı test | — |
| K31 | **Yetki yalnız arayüzde.** Düğme gizli ama uç açık | Ucu yetkisiz rolle doğrudan çağır | — |
| K32 | **Kalıcı silme ve sarkan referans.** Silinen kayda bağlı kayıtlar kalıyor ya da silinen kayıt geri diriliyor | Sil, sonra bağlı her ekranı aç | editör modülünde silinen proje diriliyordu; içe aktarma ders siliyordu |
| K33 | **Eşzamanlılık / çift işlem.** İki sekme, çift tık, iki zamanlayıcı aynı işi yapıyor | Atomik claim, idempotency anahtarı; paralel test | LMS ürünü zamanlayıcısı atomik claim'e geçirildi |
| K34 | **Sır sızıntısı.** Anahtar istemci paketinde, depoda ya da logda | `grep` ile anahtar desenleri; derlenmiş paketi tara | masaüstü pakette lisans HMAC anahtarı istemcideydi |
| K35 | **Demo veya test verisi gerçek sonuç üretiyor.** Demo hesabı koltuk yiyor ya da e-posta gönderiyor | Demo bayrağının tüm yan etkilerde kontrol edildiğini doğrula | LMS ürünü demo hesapları koltuk yiyordu |

## E. Arayüz detayları

| # | Sınıf | Nasıl yakalanır | Vaka |
|---|---|---|---|
| K40 | **Durum matrisi eksik.** Boş, yükleniyor, hata ya da yetkisiz ekran yok | Defterdeki durum matrisi | — |
| K41 | **Kontrast.** Özellikle gradyan veya opaklık üstünde | Tarayıcıda gradyana duyarlı ölçüm yap; düzeltmeyi token'a yaz | AnimatorX'te AA altı 2227 öğe vardı, 0'a indi |
| K42 | **Dar ekran ve taşma.** Uzun metin, çeviri uzunluğu, 390 px | Uzun içerik ve EN metinle kare al | AnimatorX zaman çizelgesi dizüstünde ekranın %37'sini kaplıyordu |
| K43 | **Yarım çeviri.** EN arayüzde TR metin ya da tersi; sabit kodlanmış metin | i18n anahtarı olmayan metin taraması; iki dilde kare | Karışık dilli deste notları |
| K44 | **Türkçe karakter bozulması.** Mojibake, `?`, yanlış kodlama | kanit-disiplini TR taraması | — |
| K45 | **Önbellek eski sürümü gösteriyor.** CDN, service worker ya da tarayıcı | Sürüm başlığı, sert yenileme | Cloudflare önbellek tuzağı; ürünlerde 4 saatlik önbellek |
| K46 | **Erişilebilirlik.** Klavye ile ulaşılamıyor, odak görünmüyor, etiket yok | Yalnız klavyeyle tur | — |

## F. Yapı, derleme, yayın

| # | Sınıf | Nasıl yakalanır | Vaka |
|---|---|---|---|
| K50 | **İkiz mantık ayrıştı.** | ikiz-kod kapısı | — (ikiz-kod skill'i bu sınıf için kuruldu) |
| K51 | **Test edilmemiş commit yayına gitti.** HEAD derlenen SHA değil | `git push origin <SHA>:<dal>` | LMS ürününde işçi derleme sırasında commit attı |
| K52 | **Eşzamanlı build birini öldürdü.** | Yayınları sırayla yap; tek eşzamanlı build | LMS ürünü build'i başka projenin build'iyle mesajsız öldü |
| K53 | **Ortam ayrışması.** Yerelde çalışıyor, canlıda env, yol ya da PATH farklı | Canlıda gerçek akış; env listesini karşılaştır | GUI uygulaması launchd PATH'iyle açılınca `spawn ENOENT` verdi |
| K54 | **Hayalet ve bayat dosya.** `X 2.tsx`, `dist/… 4.zip`, eski paket | glob değil manifest oku; `git status` ile izlenmeyenleri kontrol et | oyun modülü canlıya bayat paket yükledi · video motoru 06.10: test depoda olmayan prova kursuna bağlıydı, yerelde yeşil, Docker imaj kapısında ENOENT → yayın düştü (temiz klonda kapı). Aynı sınıf, ikinci yüz: gitignore'lu `varliklar/ses|uretim` yalnız yazarın makinesinde vardı, SCORM paket testleri temiz klonda 4 kez kırmızıydı (canlıdaki commit'te bile); çözüm test ön yüklemesi (`test/yardim/ses-garanti.mjs`) + her yayın öncesi `git clone`+`npm run check` |
| K55 | **`git add -A` istenmeyeni alıyor.** | Dosyaları adıyla ekle | sınav uygulaması |
| K56 | **Kapı kör.** CI hiç koşmuyor (fatura, kota) ama "yeşil" sanılıyor | İşin gerçekten koştuğunu ve adımlarının dolu olduğunu kontrol et; kapıyı Dockerfile'a al | GitHub Actions fatura duvarı |
| K57 | **`.env` yanlış ortamı yüklüyor.** | Build öncesi ortam değişkenlerini yazdır | `next build` öncesi `.env` source edilince NODE_ENV=development oldu, build kırıldı |

## G. Ölçüm ve rapor

| # | Sınıf | Nasıl yakalanır | Vaka |
|---|---|---|---|
| K60 | **Sayı doğru, iddia yanlış.** Ölçüt şikâyetin kendisini ölçmüyor | "Ölçtüğüm şey kullanıcının gördüğü şey mi?" | Düğme açıldı ≠ görsel slaytta |
| K61 | **Ayırt etmeyen kontrol.** ✓ her durumda yeşil | Kontrolü bilerek bozulmuş girdiyle çalıştır; kırmızı vermeli | AnimatorX kapısı |
| K62 | **Kaynakta var ≠ ekranda erişilebilir.** | Gerçek yüzeyde tıkla | AnimatorX |
| K64 | **Sahte fikstür gerçek sözleşmeyi taklit etmiyor.** Test dış API'nin yanıtını elle uydurur; kod da aynı uydurma biçimi bekler, test yeşil, canlı yanlış | Fikstürü sağlayıcının belgesindeki örnek yanıttan kopyala, kaynağını teste yaz | video motoru kullanım kaydı: test `input_tokens`, API `total_input_tokens` → 39 gerçek satır 0 token (06.10) |
| K63 | **Görsel kanıta aşırı güven.** Kare yanlış teşhisi destekler gibi görünür | Görseli sayı veya enstrümantasyonla çapraz kontrol et | avatar modülünde 5 yanlış teşhis |

## H. Web ve istemci akışları (denetçi turu 06.10 ile eklendi)

| # | Sınıf | Nasıl yakalanır | Vaka |
|---|---|---|---|
| K70 | **Eksik alan / eski kayıt.** Yeni kod eski kayıtta olmayan alanı okuyunca `undefined` alıyor | Eski fikstürle render ve açma testi | — |
| K71 | **İstemci/sunucu doğrulama farkı.** Kural yalnız formda | İstemciyi atla (curl), geçersiz veri gönder; sunucu reddetmeli | — |
| K72 | **Sayfalama / sınırsız liste.** | 0, 1 ve 1000+ kayıtla liste; sorguda limit var mı | — |
| K73 | **URL / derin bağlantı / geri tuşu / F5.** Durum kayboluyor | Durumlu sayfada yenile, URL'yi yeni sekmede aç, geri tuşuna bas | — |
| K74 | **Bayat yanıt yarışı.** Sıra dışı gelen fetch eski sonucu basıyor | Hızlı ardışık arama veya filtre; son istek kazanmalı (abort/istek kimliği) | — |
| K75 | **Kayıttan sonra bayat liste.** Önbellek geçersizlenmiyor | Kaydet, listeye dön; yenilemeden görünmeli | — |
| K76 | **Kaydedilmemiş değişiklik kaybı.** | Değişiklik yap, çık veya oturumu düşür; uyarı ya da taslak olmalı | — |
| K77 | **Sızıntı.** Dinleyici, zamanlayıcı ya da nesne temizlenmiyor | `setInterval`/`addEventListener` için temizleme var mı; 10 kez aç-kapa sonrası heap | — |
| K78 | **Deploy sonrası eski sekme.** Eski istemci yeni API'yi çağırıyor | Eski paketle yeni sunucuyu dene; sürüm uyuşmazlığında "yenile" uyarısı | — |
| K79 | **Dosya yükleme sınırları.** | Büyük dosya, yanlış MIME, Türkçe adlı dosya; nginx `client_max_body_size` ile uygulama sınırı aynı mı | — |
| K80 | **CSV/Excel ve indirme adı TR.** | BOM + `;` + virgüllü ondalık; Excel'de aç; Content-Disposition'da `filename*=UTF-8''` | — |
| K81 | **Yerel sayı/tarih biçimi.** Ham `toFixed` veya ISO metni kullanıcıya gösteriliyor | `Intl`/`toLocaleString(dil)` taraması | — |
| K82 | **Log'da kişisel veri (KVKK).** | Log çağrılarında e-posta/TC/parola/token taraması | — |
| K83 | **E-posta teslimi.** Gönderildi ≠ ulaştı; test ortamı gerçek adrese gidiyor | Gerçek kutuya gönder, spam klasörüne bak; SPF/DKIM; demo bayrağı (K35) | LMS ürününde 96 e-posta bounce |
| K84 | **Webhook / tekrarlanan teslim.** | Aynı olayı iki kez gönder; idempotent olmalı, imza doğrulanmalı | — |
| K85 | **Satır içi betik sarmalı.** Astro `<script is:inline>{`kod`}</script>` JS'i `{`…`}` ile SARAR: tarayıcıda geçersiz betik, sessizce çalışmaz; "betik var" diyen metin testi yeşil kalır | Betik gövdesini `new Function(...)` ile ayrıştıran test + betiği `set:html={KOD}` ile gömmek (`kapılı`: kurumsal site `test/dil.test.mjs`) | kurumsal site, çerez→dil yönlendirmesi, 12.10.2026 (ekran turunda TR adresi DE çerezle yönlenmedi) |
| K86 | **E-posta: satır içi stil sınıf kuralını ezer.** Karanlık mod logosu `<style>` sınıfıyla gizlenip satır içi `display:block` verilirse sınıf kuralı kaybeder; açık modda iki logo üst üste çıkar. HTML-metin testi ("logo var") yeşil kalır | Gizleme SATIR İÇİ yazılır, karanlıkta `!important` ile açılır; test satır içi stili okur + tarayıcıda hesaplanmış `display` karesi | ekosistem deposu (cekirdek e-posta kabuğu, LMS ürünü terminali buldu, test 102) · 2026-10-13 |
| K87 | **İstemci bileşeni sunucu modülünü içe aktarıyor.** `'use client'` dosyası bir sabit için `node:crypto`/`prisma` çeken lib'i içe aktarırsa dev'de sayfa 500 ("UnhandledSchemeError node:crypto"), üretim derlemesi kırılır; `tsc` ve birim testler (node ortamı) GÖRMEZ | Tarayıcıda sayfayı aç / `next build`; sabit ve tipler ayrı, saf (içe aktarmasız) modülde dursun; istemci yalnız onu içe aktarsın | cekirdek 13.10: sihirbaz `MEVZUAT_URUN_ID`'yi mevzuat-ic.ts'ten aldı → kurum-ac 500; sabit saf modüle taşındı |
| K88 | **`'use server'` dosyasında async olmayan dışa aktarma.** `export const eylem = (…) => gonder(…)` Server Action sayılmaz → "Server Actions must be async functions", sayfa 500; `tsc` geçer | Server Action dosyasındaki her export `async function` olmalı; ekranı tarayıcıda aç | cekirdek 13.10: alan-eylem.ts ok işlevleriyle yazıldı → Alan adları sekmesi 500 |
| K89 | **Docker test kapısına yerel-only bağımlılıklı test girer.** İmajda `npm ci` yoksa `import 'playwright'` yapan test `npm test` içinde kırmızı olur, deploy durur; yerelde yeşil kalır (K54'ün kardeşi) | Tarayıcı testlerini `*.e2e.mjs` adıyla ayır, `npm run test:arayuz`; kapıyı `docker build --target test-kapisi` ile dene | SınavX kütüphane 14.10 |
| K90 | **DOM'a `null`/`false` metin olarak basılır.** `replaceChildren(a, cond && b, null)` / `append(false)` ekrana "null"/"false" yazar; kod testi ve tür denetimi geçer | Çocuk listesini `.filter(Boolean)` et; testte ekran metninde `null/false/undefined` satırı ara | SınavX kütüphane 14.10 |

---

## Yeni sınıf ekleme

Önce mevcut bir sınıfa genelleştirilebilir mi diye bakılır; katalog tavansız büyürse
taranamaz hale gelir. Genelleştirilemiyorsa ilgili bölümün sonuna `K<nn>` numarasıyla
bir satır eklenir. Satır şu dört alanı taşır: sınıf,
yakalama yolu, vaka (proje + kısa tarif), tarih. Mümkünse yakalama yolu otomatik bir
kapıya (test, lint kuralı, betik) çevrilir ve kapının adı satıra yazılır, sınıf `kapılı` işaretlenir. Sınıfın diff deseni varsa
`scripts/katalog-tara.sh` içindeki eşleme tablosuna da eklenir.
| K91 | **Genel düğme sıfırlaması bileşen dolgusunu ezer.** `.dz button{padding:0}` (0,1,1) `.dz-btn{padding:0 14px}` (0,1,0)'den özgül → metin kenara yapışır, kesilir; CSS "çalışır", test geçer | Kapsayıcı sıfırlamasında `padding` yazma; dolguyu bileşen sınıfı taşısın; kareyle bak (metin düğme kenarına değiyor mu) | SlideX düzenleyici/oynatıcı 15.10 (Sun/İndir/Tamamla düğmeleri) |
| K92 | **Taşan grid'de `overflow:hidden` öğe 0'a çöker.** Grid kapsayıcı içeriği taşınca auto satırlar en küçük katkıya (overflow:hidden → 0) düşer; öğe yalnız dolgu kadar görünür | `grid-auto-rows:max-content` ya da öğede `min-height`; kare al | SlideX düzenleyici mock hata kartı 15.10 |
| K93 | **Node `IncomingMessage.destroyed` gövde okununca `true` olur.** Akış yazarken `if (istek.destroyed) break` döngüyü ilk turda keser → boş gövde, 200 | İstemci kopuşu için `yanit.destroyed`/`writableEnded`'e bak; akış ucunu gövde satır sayısıyla test et | SlideX AI NDJSON akışı 15.10 (test boş gövde yakaladı) |
| K94 | **Otomatik metin değiştirmeyle tek satıra `//` yorum eklenir, satırın kalanı yoruma düşer.** Sözdizimi bozulursa modül hiç yüklenmez (ekran bembeyaz, sunucu 200, birim test yeşil); bozulmazsa (`let x` yutulur) sessiz ReferenceError. İki kez aynı günde | Yorum satırın BAŞINA ayrı satır olarak; `node --check` tüm tarayıcı modüllerine test olarak (`test/sozdizimi.test.mjs`); her turda tarayıcı duman testi (kanıt aracı) | SlideX 15.10 (persona turu yakaladı: uygulama açılmıyor) |
| K95 | **Yayın ortamının build değişkenleri imaj içi test kapısına sızar.** Coolify canlı env'i build'e de verir; test `{...process.env}` anlık kopyasına döndüğü için `ORGANIZATION_SLUG` gibi kilit her testten sonra GERİ gelir → yerelde temiz klon yeşil, Coolify'da kırmızı (K54/K89'un kardeşi: kopya temiz, ORTAM değil) | Test kurulumunda (setupFiles, ilk sırada) canlı davranışlı değişkenleri sil; `.env.example`'daki her adın SIL/KORU sınıfını test et; kapıyı Coolify gibi `ARG`+`--build-arg` (canlı ADLAR, sahte değerler) ile de koş | MevzuatAI 15.10 (41c5da4 kapıda 37 kırmızı; `test/ortam-yalitimi.ts`) — kapılı |
