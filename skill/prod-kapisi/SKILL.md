---
name: prod-kapisi
description: "Prod Kapısı — bir proje canlıya çıkmadan/çıkmışken production hazırlık denetimi. Bu skill'i 'deploy edelim', 'canlıya alalım', 'yayına hazır mı', 'prod'a geçelim', 'sunucuya kuralım', 'launch', 'go-live', 'müşteriye açalım' dendiğinde MUTLAKA kullan; halihazırda canlı bir ürün için 'altyapı sağlam mı', 'ölçeklenir mi', 'başımıza ne patlar' tarzı sorularda da kullan. İki yönlü kapıdır: hem eksik olan zorunluları bulur (restore edilmemiş backup, denenmemiş rollback, rate limitsiz login) hem de projenin ölçeğine göre GEREKSİZ karmaşıklığı yasaklar (tek sunucuda Kubernetes, distributed lock, multi-region önermek bulgudur). Cerrahi Plan işi açar, Kanıt Disiplini işi kapatır; bu skill deploy'dan önceki son kapıdır."
---

# Prod Kapısı

## Neden

İnternette dolaşan "production'da bilmen gereken 110 kavram" listeleri iki
şekilde zarar verir: ya hiçbiri uygulanmaz (bilgi olarak kalır) ya da hepsi
uygulanmaya çalışılır (tek sunuculu ürüne Kubernetes kurulur). İkisi de
aynı hatadır: **listenin ölçeksiz okunması.**

Bu skill listeyi kapıya çevirir. Kapının iki yönü vardır:

1. **Eksik zorunlu** — bu ölçekte olmazsa olmaz bir şey yoksa kapı geçilmez.
   Restore edilmemiş backup, denenmemiş rollback, rate limitsiz login gibi.
2. **Fazla mühendislik** — bu ölçekte gerekmeyen bir şey kuruluysa veya
   önerilecekse o da bulgudur. Gereksiz karmaşıklık küçük ekipte bakım borcu
   olarak geri döner; "olsa iyi olur" diye eklenen her katman bir arıza
   yüzeyidir.

Kavramı bilmek denetim değildir. Her madde **kanıt** ister: komut çıktısı,
config satırı, denenmiş prosedür. "Backup var" iddiası restore denenmediyse
YOK sayılır — felaket günü ilk kez denenen prosedür, prosedür değildir.

**Denetim iki katmana birden bakar: repoya VE canlıya.** İddia "repo temiz
mi" değil, "canlıdaki ürün ayakta kalır mı"dır. En pahalı bulgular ikisinin
arasındaki boşlukta yaşar: repo tertemizken sunucudaki backup script'inin o
projeyi kapsamaması; koddaki güvenli varsayılanın canlıda env ile ezilmemiş
olması; canlının repodaki koddan başka bir commit'ten çalışması. Sadece
repoya bakan denetim bunların hiçbirini göremez.

## Akış

### 1. Tier'i sınıfla

Projeyi aşağıdaki tabloya oturt ve raporda tier'i gerekçesiyle söyle.
Emin değilsen küçük olanı seç — tier yükseltmek kolay, gereksiz kurulmuş
altyapıyı sökmek zordur.

| Tier | Tanım |
|---|---|
| **T1 — Tek sunucu ürün** (varsayılan) | Tek VPS (Coolify vb. panel), solo/küçük ekip, ~<1k aktif kullanıcı, gelir yok/düşük |
| **T2 — Gelir/sözleşme taşıyan** | Gerçek müşteri, ödeme veya kurumsal sözleşme, kişisel/kurumsal veri (KVKK/GDPR), SLA beklentisi |
| **T3 — Çok sunuculu/ekipli** | Birden çok sunucu, ekip, yüksek trafik |

### 2. İlgili referans dosyalarını oku

Altı kategori, altı dosya. Hepsini körlemesine okuma — projeye dokunmayan
kategoriyi atla ve raporda "kapsam dışı" olarak işaretle (ör. WebSocket'i
olmayan projede o maddeler konu dışıdır, "VAR" değil).

| Dosya | Kapsam |
|---|---|
| `references/dayaniklilik.md` | timeout, retry, idempotency, kuyruk, cron, race condition, graceful shutdown |
| `references/veri.md` | backup+restore, migration, index, N+1, pool, volume kalıcılığı, constraint |
| `references/gozlem.md` | health check, log, uptime, hata bildirimi, disk doluluğu |
| `references/guvenlik.md` | TLS, secrets, rate limit, CORS, başlıklar, bağımlılıklar (ops tarafı) |
| `references/deploy.md` | rollback, CI kapısı, env parity, cache tuzakları, paketleme tuzakları |
| `references/operasyon.md` | runbook, olay kaydı, fatura/oto-ödeme, felaket kurtarma, maliyet |

### 3. Çek listesini işlet — her madde kanıtlı

Her maddeye beş durumdan biri verilir:

- **VAR** — kanıtıyla (komut çıktısı, config satırı, denenmiş prosedür).
- **YOK** — zorunluysa kapıyı düşürür.
- **GEREKMEZ** — bu tier'de gerekmiyor; tek cümle gerekçe yaz.
- **KAPSAM DIŞI** — projede o bileşen yok (kuyruk yoksa DLQ tartışılmaz).
- **DOĞRULANAMADI** — kanıta CLI'dan ulaşılamıyor (panel ayarı, ödeme
  ekranı). VAR'a da YOK'a da çevrilmez; raporda sahibe yöneltilmiş somut
  soru olarak listelenir ("sağlayıcıda oto-ödeme açık mı?"). Kapıyı
  düşürmez ama kapanmamış sayılır — bir sonraki koşuda hâlâ DOĞRULANAMADI
  ise sahibin cevabı istisna olarak kaydedilir.

Kanıt dili `kanit-disiplini` ile aynıdır: o turda alınmış gerçek çıktı.
"Vardır herhalde", "panel halleder" iddia değildir. Sunucuya salt-okunur
bakmak (ssh + cat/ls/docker inspect) serbesttir; **canlıda değişiklik bu
skill'in işi değildir** — eksik bulunur, raporlanır, düzeltme ayrı iştir ve
`cerrahi-plan` ile açılır.

### 4. Delegasyon — kopyalama, yönlendir

- Kod seviyesi güvenlik (SQLi, XSS, CSRF, yetki kaçağı) bu skill'de
  **denetlenmez**; ayrı bir kod güvenlik denetimi (projede varsa kendi
  denetim zinciri, yoksa security review) koşulur ve sonucu bu rapora tek
  satır olarak işlenir. Koşulmadıysa raporda "kod güvenliği: denetlenmedi"
  satırı zorunludur — sessizce VAR sayılmaz.
- UI/UX hazırlığı ayrı bir denetimdir, buraya taşınmaz.
- Sayı/oran üretilecekse (ör. "P95 kaç ms") `olcum-sozlesmesi` kuralları geçerli.

### 5. Rapor ve kapı kararı

```
PROD KAPISI — <proje> | Tier 1 (tek VPS, solo, ~200 kullanıcı)
ZORUNLU 22: 17 VAR · 3 YOK · 2 KAPSAM DIŞI
YOK (kapıyı düşürenler):
  1. Backup restore hiç denenmemiş (dump var, geri dönüş yolu kanıtsız)
  2. Rollback: önceki image'a dönüş prosedürü yok
  3. Login ucunda rate limit yok
FAZLA: Redis distributed lock tek sunucuda gereksiz — DB transaction yeterli
GEREKMEZ (doğru karar): K8s, read replica, multi-region, tracing
KAPI: GEÇMEDİ — 3 zorunlu eksik. Sıra: restore testi → rollback → rate limit.
```

Kapı kararı ikili: **GEÇTİ** ya da **GEÇMEDİ**. "Büyük ölçüde hazır" yok.
Zorunlu bir madde eksikse kapı geçmez; kullanıcı bilinçli olarak "bunu göze
alıyorum" derse bu rapora **kullanıcı kararıyla istisna** diye yazılır,
sessizce VAR'a çevrilmez.

## Yasaklar

- Kanıtsız VAR işaretlemek ("muhtemelen ayarlıdır", "panelin default'u iyidir").
- Tier'in üstünde altyapı önermek — GEREKMEZ damgalı maddeyi tavsiye etmek
  bulgu üretmek değil, bulgu olmaktır.
- Restore denenmemiş backup'ı VAR saymak.
- Denetim bahanesiyle canlıda değişiklik (restart, config edit, paket kurma).
  Teşhis salt-okunur; düzeltme ayrı iş, ayrı onay.
- KAPSAM DIŞI ile GEREKMEZ'i karıştırmak (biri "bileşen yok", öbürü "bilinçli
  karar" — raporda ayrı görünürler).
- Kapıyı yüzdeyle raporlamak ("%87 hazır") — kapı ikilidir.
