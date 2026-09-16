# Serif Brain Core — geliştirme planı

Tarih: 2026-09-05. Başlangıç değerlendirmesi: 7,5/10. Hedef: yanlış güven üretmeyen, verisini koruyan ve etkisi bağımsız olarak ölçülebilen bir geliştirme aracı.

10/10 bir pazarlama vaadi değildir. Yerel testlerin geçmesi, dış kullanıcı başarısını veya bütün platformlarda güvenilirliği tek başına kanıtlamaz.

## 1. Güncel ve doğru denetim — uygulandı

- `check`, MCP `brain_check` ve `review` ortak graf oluşturucuyla güncel kaynakları denetler.
- Eski graf üzerinde inceleme CLI'da yalnız `--snapshot` ile seçilir.
- Graf önbelleği iki kademeli: mtime+boyut eşleşirse dosya okunmaz; değiştiyse içerik SHA-256 özeti aynı parse'ın tekrarını önler. (2026-09-07: her kurulumda tüm dosyaları okuyup özetlemek serif-platform'da 50–260 ms ek gecikme ölçüldü; hook her düzenlemede koştuğu için okuma atlandı. Bilinçli sınır: mtime+boyut korunarak değiştirilen dosya görülmez.)
- `guard` (CLI, MCP `brain_guard`, PreToolUse hook) de canlı graf kurar; `--snapshot` ile kayıtlı graf. (2026-09-07)
- Review dil listesi tarayıcıyla ortaktır. İmza kontrolü tüm tanımlı dillerde çalışır; import grafı bulunmayan diller yapısal olarak temiz sayılmaz.
- Git çağrıları review/aktivite ve otomatik dosya ilişkilendirme yollarında kabuk yerine argüman dizisi kullanır. Alt proje yolları proje köküne göredir; review dosya adları NUL ayracıyla okunur.

Kabul: önceden temiz graf + yeni yasak import senaryosu CLI check, review ve MCP'de yakalanır; Python/PHP/Ruby/Astro imza senaryoları geçer. Eski snapshot kapsam testleri açık snapshot kipinde korunur.

## 2. Panel ve veri güvenliği — uygulandı

- HTTP Host, Origin ve cross-site kontrolleri; yazan uçlarda JSON zorunluluğu.
- Hatalı JSON 400, büyük gövde 413, yanlış medya tipi 415 verir.
- Sunucu dış ağ arayüzüne bağlanmayı reddeder.
- macOS/Linux'ta panelin başlattığı süreç grubu kapatılır; Windows yolu `taskkill /T` kullanır.
- Obje, registry ve tarama önbelleği atomik dosya değiştirme kullanır.
- Obje/proje yollarının dizin dışına çıkması reddedilir.
- Reddedilmiş/arşivlenmiş kayda not eklemek mevcut durumu korur.

Sınırlar: Panel yerel kullanıcı yetkisiyle komut çalıştıran güvenilir bir yerel araçtır; çok kullanıcılı uzaktan yönetim servisi değildir. Atomik değiştirme yarım dosyayı önler, eşzamanlı iki yazarın güncelleme kaybını veya güç kesintisinde disk dayanıklılığını tek başına çözmez. POSIX'te kendi süreç grubundan ayrılan daemon'lar ayrıca ele alınmalıdır. Windows davranışı yerelde değil CI'da doğrulanmalıdır.

## 3. Tekrarlanabilir kalite — uygulandı / platform doğrulaması bekliyor

- 9 yeni regresyon testi; toplam 396 test.
- `npm run benchmark -- 1000`: geçici, deterministik 1.000 dosyalık zincir üretir; 999 import kenarını doğrular; soğuk ve sıcak graf sürelerini JSON olarak raporlar; geçici veriyi temizler.
- CI matrisi Node 22/24 × Linux/Windows/macOS. Sentetik benchmark CI'a eklendi.
- README hook'ların engelleyici olmadığını açıklar; kayıt varlığı ile hata önleme etkisi ayrılır.

Yerel sonuç: Node 24.11.1 / macOS, 391/391 test. 1.000 dosyalık graf yaklaşık 37 ms soğuk; beş sıcak koşu yaklaşık 23–26 ms. Bu hook uçtan uca gecikmesi değildir. Ağdaki CI çalıştırılmadı.

## 4. Ekosistem üzerinde kontrollü doğrulama — sonraki sıra

Her proje için aynı sıra uygulanmalı:

1. Teknoloji yığını, çalışma komutları, mevcut git değişiklikleri ve proje talimatlarını incele.
2. Test/build durumunu ve gerçek kullanıcı yolunu ölç; sorunları kanıtlarıyla kaydet.
3. Brain kapsamı, bayat kayıtlar, kopuk dosya ilişkileri ve graf çözümlemesini salt okunur denetle.
4. En yüksek etkili doğruluk, güvenlik ve kullanıcı akışı sorunlarını düzelt; anlamlı regresyonlarla doğrula.
5. Önce/sonra değerlendirmesi ve kalan sınırları raporla. Ortak paket değişikliği gerekiyorsa tek kaynakta yap; diğer projelere kopya mantık ekleme.

Bu çalışma diğer ekosistem projelerinin dosyalarını, çalışan panellerini veya kurulu global kopyalarını değiştirmez. Sonraki proje seçilince proje özelinde ilerlenir; hepsine aynı anda toplu yükseltme yapılmaz.

## 5. 9–10/10 için açık işler ve kabul ölçütleri

| İş | Kabul ölçütü | Öncelik |
|---|---|---|
| Eşzamanlı yazma kontrolü | İki süreç aynı kayda not eklediğinde not kaybı olmaz veya açık sürüm çatışması döner | Yüksek |
| İçe aktarma ayrıştırıcısının doğruluğu | String, yorum, çok satırlı ifade, Python alias ve paket örneklerinde yanlış/eksik kenarlar ölçülür | Yüksek |
| Diğer raporlarda graf tazeliği | guard canlıya geçti (2026-09-07). impact/layers gibi snapshot kullanan raporlarda yaş ve kapsam görünür; güncel kontrol ile karıştırılmaz | Orta |
| Git hata görünürlüğü | Hatalı ref/izin hatası boş ve temiz review sonucuna dönüşmez; git bulunmayan proje davranışı ayrı kalır | Yüksek |
| Gerçek depo performansı | En az 3 farklı boyuttaki depoda hook toplam gecikmesi p50/p95 ve tarama maliyeti raporlanır | Orta |
| Platform doğrulaması | Altı CI hücresi yeşil; süreç ağacı testleri Windows ve Linux'ta da geçer | Yüksek |
| Bağımsız kullanım | En az 3 dış kullanıcı ve önceden tanımlanmış görev seti | Orta |
| Etki ölçümü | Kör içerik etiketlemesiyle ilgili/ilgisiz kayıt ayrımı; eşleştirilmiş kapılı/kapısız görevlerde hata ve süre ölçümü | Orta |

Yeni özellikten önce doğruluk ölçümü gelir. Puan, bu kabul ölçütleri gerçekleşmeden 10'a yükseltilmez.
