# Modül Defteri — yöntem ve şablon

Defter, "bu modülde neye bakıldı" sorusunun tek cevabıdır. Listede olmayana bakılmamıştır.

## Nerede durur

- Dosya: ürün deposunda `docs/defter/<modul>.md`. Depoda belgeler için başka bir yer
  kullanılıyorsa (ör. `doc/`, `belgeler/`) o konvansiyona uyulur.
- Brain: modül başına tek plan objesi `plan-<modul>-defter`. Gövdesinde defterin yolu ve
  özet sayılar durur (satır sayısı, ✓ sayısı, açık sayısı, park sayısı). Ayrıntı brain'e
  kopyalanmaz, yalnız işaret edilir.
- Defter commit'lenir. Commit'lenmemiş defter oturum sonunda kaybolur.

## Derinlik modu — defterin başına yazılır

Büyük modülde (editör modülü, LMS ürünü gibi) her rolle her öğeyi tıklamak yüzlerce hücre demektir.
Tavansız defter ya bitmez ya da ezbere `GEREKMEZ` ile dolar. Bu yüzden derinlik baştan
seçilir:

| Mod | Kapsam | Ne zaman |
|---|---|---|
| **hızlı** | Ana yolculuk + para/yetki/veri silme akışları; durum matrisinde yalnız hata ve yetkisiz | Küçük modül, düşük risk, iç araç |
| **standart** | Tüm akışlar; tam durum matrisi; ana rol + bir yetkisiz rol | Varsayılan. Yayına çıkacak her modül |
| **derin** | Standart + her rol + uzun içerik/TR-EN/dar ekran kareleri + eşzamanlılık testleri | Para, kişisel veri, çok kiracılı çekirdek, ilk müşteri öncesi |

Seçilen mod ve **"Bakılmayanlar"** listesi zorunludur. Bakılmayanlar, modun dışarıda
bıraktığı akış, rol ve durumların açık listesidir. Listede yazılı olan bilerek
bırakılmıştır. Hiçbir yerde yazmayan şey ise kaçmıştır.

**Sütun düzeyinde GEREKMEZ:** Ürüne hiç uymayan bir sütun hücre hücre değil, başlıkta bir
kez işaretlenir. Örnek: "TR/EN — GEREKMEZ: ürün yalnız TR, karar D12". Eşzamanlılık
sütunu da salt okunur ekranlarda böyle işaretlenir.

**UI'li modülde:** A ve B listeleri ui-denetim'in envanter ve etkileşim turu çıktısından
doldurulur, ikinci kez çıkarılmaz. Aşağıdaki tarama tablosu ui-denetim'in olmadığı
yüzeyler (API, iş, CLI) ve çapraz kontrol içindir.

## Çıkarma — iki kaynak, çapraz

### A. Koddan (mekanik tarama, elle hatırlamak değil)

Stack'e göre uyarla. Amaç, kullanıcıya ulaşan her girişi bulmak:

| Ne | Nasıl bulunur (örnek) |
|---|---|
| Sayfa/route | Next.js `app/**/page.tsx`, `pages/**`; React Router `<Route path=`; Express `router.(get\|post\|…)`; Laravel `routes/*.php`; SwiftUI `NavigationLink`/`.sheet` |
| Modal/dialog/drawer/toast | `Dialog`, `Modal`, `Sheet`, `Drawer`, `toast(`, `confirm(`, `alert(` |
| Etkileşim | `onClick`, `onSubmit`, `addEventListener`, kısayol tanımları; **her düğmenin dinleyicisinin gerçekten bağlı olduğu** kontrol edilir |
| API uç noktaları | route handler'lar, `fetch(`/`axios` çağrılarının hedefleri; istemcinin çağırıp sunucuda olmayan uç = kırık yol |
| Arka plan | kuyruk işçileri, cron, zamanlanmış işler, webhook alıcıları |
| Dışa/içe aktarma | export/import, SCORM/PDF/PPTX/CSV üreticileri, dosya yükleme |
| E-posta/bildirim | şablonlar ve tetikleyicileri |
| Yetki | rol kontrolleri, middleware, RLS politikaları |
| Ayarlar/flag | env değişkenleri, feature flag'ler, kurum ayarları |
| Metinler | i18n anahtarları (TR/EN), sabit kodlanmış metinler |

Tarama komutunun kendisi deftere yazılır ki bir sonraki tur aynı kapsamı yeniden üretebilsin.

### B. Kullanıcı gözünden (gerçek yüzeyde)

- Her rolle giriş yapılır (ör. yönetici, eğitmen, öğrenci, misafir).
- Her ekranda tıklanabilir her öğe sayılır. Her öğe en az bir kez tıklanır.
- Menü, sağ tık, kısayol ve sürükle-bırak gibi gizli girişler de dahildir.

### C. Fark

| Durum | Anlamı | Ne yapılır |
|---|---|---|
| Kodda var, ekranda yok | Erişilemez özellik ya da ölü kod | Bulgu. Ya bağlanır ya da silinmesi sahibe sorulur |
| Ekranda var, kod izi yok veya dinleyicisi yok | Ölü düğme | Bulgu (engelleyici) |
| İstemci çağırıyor, sunucuda yok | Kırık yol | Bulgu (engelleyici) |

## Satır şablonu

```markdown
# Defter — <modül> (<depo>, dal <dal>, başlangıç SHA <sha>)
Tarama komutları: <komutlar>
Roller: <roller>

## Akışlar
| # | Akış / yüzey | Giriş (kod yolu) | Roller | İKİZ | Durum |
|---|---|---|---|---|---|
| A01 | Ders oluştur → yayınla | app/kurs/yeni/page.tsx → api/kurs POST | eğitmen | — | ✓ |

## Durum matrisi (her akış için)
| # | boş | yükleniyor | dolu | hata | yetkisiz | zaman aşımı | uzun içerik | TR/EN | dar ekran |
|---|---|---|---|---|---|---|---|---|---|
| A01 | ✓ k/a01-bos.png | ✓ | ✓ k/a01-dolu.png | ✓ test:kurs.hata | ✓ test:yetki | GEREKMEZ (eşzamanlı) | ✓ | ✓ | ✓ k/a01-390.png |

## Veri yaşam döngüsü
| Varlık | Oluşturan | Gören (kiracı/rol) | Silen | Silinince bağlılar | Yedekte |
|---|---|---|---|---|---|

## Bulgular
| # | Satır | Kusur sınıfı (katalog) | Ağırlık | Durum | Kanıt |
|---|---|---|---|---|---|

## PARK
| # | Ne | Neden bekliyor | Kim karar verecek |
|---|---|---|---|
```

Hücre değerleri yalnız şunlar olabilir:
- `✓ <kanıt-yolu>`: kare dosyası, test adı ya da komut çıktısı dosyası.
- `GEREKMEZ (<neden>)`: neden zorunludur.
- `PARK (<kim>)`: kimin karar vereceği zorunludur.
- `✗ <bulgu-no>`: açık bulgu.

Boş hücre ya da açıklamasız `-` yasaktır.

## Ağırlık

- **Engelleyici:** Ana yolu kırar, veri kaybeder ya da bozar, yetki veya kiracı sızıntısı
  yaratır, para ve fatura yanlış çıkar.
- **Büyük:** Ana yol çalışır ama kullanıcı takılır ya da yanlış sonuç görür.
- **Küçük:** Cila, metin, hizalama.

Tetik testi: "Bu yarın canlıda bir kullanıcının başına gelirse ne olur?" Sorunun cevabı
ağırlığı belirler. Bulgu yalnızca güvenlik ya da yetki kelimesi geçtiği için engelleyici
sayılmaz.

## Bir sonraki tur

Defter silinmez, güncellenir. Yeni özellik eklenince yeni satır açılır. Bir hata canlıda
kaçmışsa ilgili satırın hangi hücresinin yanlış ✓ aldığı bulunur ve o hücrenin kanıt
türü güçlendirilir.
