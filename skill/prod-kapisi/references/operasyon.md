# Operasyon — ürün yaşarken sen uyurken

Kapsanan liste kavramları: production incidents, on-call, postmortems,
disaster recovery, failover, multi-region deployments, chaos engineering,
cost optimization.

Temel ilke: solo/küçük ekipte operasyon ekibi yoktur; operasyon,
**gelecekteki kendine bırakılmış yazılı talimatlardır.** Arıza gecesi
hatırlamaya çalıştığın her şey, bugün on dakikada yazılabilirdi.

## T1 ZORUNLU

### Tek sayfalık runbook
Proje köküne `RUNBOOK.md`:
- Nerede çalışıyor (sunucu, panel app adı, domain, DNS nerede)?
- Nasıl yeniden başlatılır, loglara nereden bakılır?
- Rollback adımları (deploy.md'dekiyle aynı — link ver, kopyalama).
- Backup nerede, restore adımları (veri.md'dekiyle aynı — link ver).
- Kritik env değişkenleri listesi (değerleri DEĞİL, adları ve nereden
  bulunacağı).
Ölçüt: altı ay sonra, hiçbir şey hatırlamadan, sadece bu dosyayla siteyi
ayağa kaldırabilir misin?
- Kanıt: dosyanın varlığı + içinin bu başlıkları karşılaması.

### Fatura ve süre dolumları — altyapının sessiz katili
Prod'lar kod hatasından çok, ödenmemiş küçük bir faturadan veya süresi dolmuş
bir domain'den kapanır — sağlayıcı önce uyarır, uyarı okunmaz, sonra keser.
Kontrol listesi:
1. VPS sağlayıcısında oto-ödeme aktif mi?
2. Domain'lerin bitiş tarihi ne, oto-yenileme açık mı?
3. Ücretli API anahtarlarında (varsa) bakiye/limit uyarısı var mı?
- Kanıt: oto-ödeme ayarının görüntüsü + domain expiry tarihleri (`whois`).

### Olay kaydı — postmortem'in solo hali
Prod'da bir şey patladığında tören değil, iki paragraf istenir: ne oldu,
kök neden ne, tekrarını ne engelliyor. serif-brain kullanan projede
`serif-brain add bug` / `add decision` ile; değilse RUNBOOK altına.
Yazılmayan olay tekrar eder, çünkü alınan ders oturumla birlikte silinir.
- Kanıt: geçmiş olayların kayıtlı olması (hiç olay yaşanmadıysa mekanizmanın
  bilinmesi yeter — bu madde ancak olay yaşanmış ve yazılmamışsa YOK olur).

## T1 ÖNERİLİR

### Felaket senaryosu — kağıt üstünde tatbikat
"Sunucu şu an geri dönülmez şekilde öldü" varsayımıyla adımları yaz: yeni
VPS + panel kurulumu + backup'tan restore + DNS değişimi = kaç saat?
Cevap 1 gün bile olsa kabul edilebilir; önemli olan cevabın TAHMİN değil
yazılı bir yol olması. (Restore testi zaten veri.md'de zorunlu; burası onun
üstüne sunucu katmanını ekler.) T2'de ZORUNLU.

### Aylık maliyet görünürlüğü
Sunucu + domain'ler + API'ler + servisler toplamda ayda kaç birim? Tek satır
yeter. Bilinmeyen maliyet optimize edilemez ve fatura sürprizi üretir.

## T1 GEREKMEZ — önerme

- **Failover / standby sunucu**: ikinci sunucunun bakım maliyeti, T1'de
  vereceği faydayı aşar. Kabul edilen risk: arıza günü birkaç saat kesinti.
  Bu bilinçli karar RUNBOOK'a yazılır — böylece "gerekmez" görünmez bir
  varsayılan değil, imzalı bir tercih olur.
- **Multi-region**: kullanıcıların tamamı tek coğrafyadayken çözdüğü problem
  yok. FAZLA bulgusunun klasik örneği.
- **Chaos engineering**: rastgele arıza enjekte etmek, izleme+alarm olgunluğu
  olan ekiplerin işidir; T1'de tek "chaos" tatbikatı yukarıdaki kağıt üstü
  felaket senaryosudur.
- **On-call rotasyonu**: solo'da rotasyon yok; on-call'un T1 karşılığı
  gozlem.md'deki hata bildiriminin telefona düşmesidir. T2'de (SLA'lı
  müşteri) sessiz saat / tatil planı konuşulur — müşteriye verilen taahhüt
  uyurken de geçerlidir.
