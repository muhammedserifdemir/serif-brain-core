# Gözlem — patladığında kullanıcıdan önce sen duy

Kapsanan liste kavramları: monitoring, logging, distributed tracing, metrics,
alerting, SLOs, SLIs, error budgets, observability, health checks,
liveness/readiness probes, latency, throughput, P99.

Temel ilke: **T1'de gözlemin amacı dashboard değil, tek bir garantidir:
"site öldüğünde veya hata fırlattığında bunu kullanıcıdan önce öğrenirim."**
Bu garanti üç parçayla sağlanır: health check + uptime pingi + hata bildirimi.
Gerisi (tracing, SLO, P99) T1'de süs.

## T1 ZORUNLU

### Health check endpoint'i — DB'ye dokunan
`/health` sadece "süreç ayakta" demesin; DB'ye bir sorgu atsın. Süreç ayakta
ama DB bağlantısı kopmuş durumu, sadece-200-dönen health check'in göremediği
en yaygın arızadır. Coolify'ın health check'i bu endpoint'e bağlı olmalı —
deploy'da yeni container sağlıklı olmadan trafik almasın.
**SQLite istisnası:** DB süreç içinde yaşadığından "bağlantı kopması"
senaryosu yoktur; endpoint DB'ye dokunmuyorsa madde yine VAR sayılır, tek
satırlık `SELECT 1` iyileştirme notu düşülür (disk arızasını da yakalar).
Ayrı DB sunucusu (Postgres/MySQL) varsa dokunmayan health check YOK'tur.
- Kanıt: `curl -s https://<site>/health` çıktısı + Coolify health check ayarı.

### Uptime kontrolü — sunucunun DIŞINDAN
Sunucu kendi kendini izleyemez (kendisi ölünce izleyen de ölür). Harici bir
uptime servisi (Uptime Kuma başka makinede, UptimeRobot, Cloudflare health
check) siteye periyodik bakar ve düşünce telefona/maile haber verir.
- Kanıt: izleme servisinin config'i + test bildirimi (bir kez kasıtlı
  tetiklenmiş olması ideal — bildirim yolu da restore gibi denenmeden sayılmaz).

### Hata bildirimi — 500'ler bir yere düşsün
Yakalanmamış exception ve 500 cevapları sadece log dosyasına değil, senin
göreceğin bir kanala gitsin (mail, Telegram bot, ücretsiz Sentry). Solo
geliştiricide "kullanıcı şikayet edene kadar bilmiyordum" en pahalı öğrenme
biçimidir.
- Kanıt: error handler'da bildirim çağrısı + bir test hatasının kanala
  düştüğünün görüntüsü.

### Log — yakalanır, okunur, taşmaz
1. Uygulama stdout/stderr'e yazıyor ve Coolify/docker logs'ta görünüyor mu?
2. Hata loglarında stack trace var mı, yoksa `console.log("hata")` ile
   yutuluyor mu?
3. Log rotasyonu var mı? (docker json-file driver sınırsız büyür; max-size
   ayarı yoksa disk dolduran şey çoğu zaman loglardır.)
- Kanıt: `docker logs --tail 50 <container>` + logging driver ayarı.

### Disk doluluğu
Tek sunucuda disk dolarsa DB yazamaz, her şey birden ölür ve teşhisi
şaşırtıcıdır. Basit bir eşik uyarısı yeter: cron'da `df` kontrolü + %85
üstünde bildirim, veya izleme servisinin disk metriği.
- Kanıt: `df -h /` güncel çıktısı + uyarı mekanizmasının tanımı.

## T1 ÖNERİLİR

- **Basit istek metriği**: günlük istek sayısı ve hata oranını görebilmek
  (Coolify/Cloudflare analytics yeter). Bir sorun "dün başladı" mı "hep
  böyleydi" mi sorusuna cevap verir.
- **Yavaş sorgu logu**: Postgres `log_min_duration_statement` (ör. 500ms).
  Yavaşlama şikayeti gelmeden suçluyu kayda geçirir.

## T1 GEREKMEZ — önerme

- **Distributed tracing**: dağıtık sistem yok, trace edilecek hop yok.
  Tek süreçte stack trace zaten trace'dir.
- **SLO / SLI / error budget**: SLA'sı olan müşteri yokken SLO tanımlamak
  ritüeldir. T2'de sözleşmeye yazılan uptime taahhüdü varsa basit bir SLO
  (aylık uptime %) anlamlı olur.
- **P99 latency takibi**: performans şikayeti veya ölçülmüş bir yavaşlık
  yokken persentil altyapısı kurulmaz. Gerekirse `olcum-sozlesmesi` ile
  tek seferlik ölçüm yapılır, kalıcı altyapı kurulmaz.
- **Prometheus/Grafana stack'i**: T1'de bakım yükü faydasını aşar. Coolify +
  harici uptime + hata bildirimi üçlüsü aynı garantiyi verir.
