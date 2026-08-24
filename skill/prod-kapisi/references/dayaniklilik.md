# Dayanıklılık — dış dünya ve eşzamanlılık

Kapsanan liste kavramları: timeouts, retries, exponential backoff, idempotency,
circuit breakers, message queues, pub/sub, DLQ, backpressure, cron jobs,
websockets, race conditions, deadlocks, distributed locks, thread safety,
graceful shutdown.

Temel ilke: **tek sunucuda dağıtık sistem problemi yoktur.** Eşzamanlılık
problemi vardır ve çözümü DB'nin transaction/constraint mekanizmasıdır,
Redis kilidi değil.

## T1 ZORUNLU

### Timeout — her dış çağrıya
Dış API, DB, fetch: sınırsız bekleyen çağrı yoktur. Timeout'suz bir dış çağrı,
karşı taraf yavaşladığında senin sürecini de asar (Node'da event loop'u değil
ama bağlantı havuzunu ve isteği tutar).
- Kanıt: koddaki dış çağrılarda timeout parametresi/AbortSignal grep'i.
  `grep -rn "fetch(" --include="*.ts"` → timeout'suz olanlar bulgu.

### Idempotency — para ve kayıt üreten uçlarda
Çift tıklama, ağ retry'ı, webhook'un iki kez gelmesi: aynı istek iki kez
işlenirse iki ödeme/iki kayıt oluşuyor mu? Çözüm uygulama katmanında "kontrol
ettim" değil, **DB'de unique constraint** veya idempotency key'dir — kontrol
ile insert arasına ikinci istek girer (race).
- Kanıt: kritik uçların tablosunda unique constraint (`\d tablo` / şema dosyası).

### Cron işleri — kilit + log + hata sinyali
Günlük tarama gibi zamanlanmış işler üç şey ister: (1) önceki koşum bitmeden
yenisi başlamasın (flock veya DB kilidi), (2) çıktısı bir yere yazılsın,
(3) başarısızlık sessiz kalmasın (bkz. gozlem.md hata bildirimi). En yaygın
sessiz arıza: cron aylardır patlıyor, kimse fark etmiyor.
- Kanıt: crontab/Coolify scheduled task tanımı + son koşum logu + kilit satırı.

### Race condition — kontrol-sonra-yaz desenleri
"Önce SELECT ile baktım yoksa INSERT" deseni iki eşzamanlı istekte kırılır.
Sayaç artırma, stok düşme, tek kullanımlık kod tüketme gibi yerler ya atomik
sorgu (`UPDATE ... WHERE`, `INSERT ... ON CONFLICT`) ya transaction ister.
- Kanıt: kritik yazma yollarının kodu — kod-denetim koşulduysa oradan devral.

### Graceful shutdown
Coolify yeni container'ı açıp eskiye SIGTERM yollar. Süreç SIGTERM'de açık
istekleri bitirip DB bağlantılarını kapatmıyorsa her deploy birkaç isteği
keser — kullanıcıya "deploy anında hep hata alıyorum" olarak yansır.
- Kanıt: SIGTERM handler'ı kodda; yoksa YOK.

## T1 ÖNERİLİR

### Retry + exponential backoff + jitter
Sadece **idempotent** işlemler retry edilir (GET, idempotency key'li POST).
Retry'ı olmayan dış API entegrasyonu geçici hatada işi düşürür; backoff'suz
retry ise karşı tarafı döver ve rate limit'e takılır. Dış API kritikse
(ödeme, AI sağlayıcı) bu madde ZORUNLU'ya yükselir.

### WebSocket yeniden bağlanma (varsa)
İstemci kopunca otomatik reconnect + state'i yeniden kurma. Yoksa mobilde
ekran kilitlenince oturum ölür. WebSocket yoksa KAPSAM DIŞI.

## T1 GEREKMEZ — önerme

- **Circuit breaker**: T1'de timeout+retry yeter. T2'de kritik dış bağımlılık
  varsa (ödeme sağlayıcı) değerlendirilir.
- **Message queue / pub-sub / DLQ / backpressure**: tek sunucuda kuyruk
  ihtiyacının %90'ı "DB'de status kolonlu tablo + cron" ile çözülür. RabbitMQ/
  Redis queue kurmak bir arıza yüzeyi daha eklemektir. Gerçek kuyruk ancak
  T2+'da, işlem hacmi DB-kuyruğu aşarsa gündeme gelir. (Kuyruk zaten
  kuruluysa DLQ ve zehirli mesaj yolu ZORUNLU olur — kuyruğun yarısı olmaz.)
- **Distributed lock / leader election**: tek süreçte anlamsız; birden çok
  replika yoksa DB transaction'ı kilittir. Tek sunucuda Redis lock görürsen
  FAZLA bulgusu yaz.
- **Thread safety**: Node tek thread'dir; worker_threads kullanılmıyorsa
  KAPSAM DIŞI. Python'da ise paylaşılan state varsa bakılır.
