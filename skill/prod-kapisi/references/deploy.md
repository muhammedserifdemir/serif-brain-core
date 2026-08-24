# Deploy — çıkış hızlı, geri dönüş denenmiş

Kapsanan liste kavramları: CI/CD, blue-green/canary/rolling deployments,
rollbacks, feature flags, build caching, infrastructure as code, Terraform,
Helm, Docker, Kubernetes, API versioning, semantic versioning, cold starts,
serverless limits, CDN, edge caching, cache invalidation.

Temel ilke: **deploy'un kalitesi çıkış anında değil, kötü çıkışta ne
olduğunda belli olur.** Rollback'i olmayan deploy, tek yönlü kapıdır.

## T1 ZORUNLU

### Rollback yolu — denenmiş
Bozuk bir sürüm çıktığında önceki sürüme dönüş yolu ne ve **bir kez denenmiş
mi**? Panelde eski image'a redeploy / önceki commit'i deploy etmek —
hangisiyse adımları yazılı olmalı ve bir kez uygulanmış olmalı. Migration
içeren sürümlerde rollback planı migration'ı da kapsar (geri alınamıyorsa
"ileri sarma" planı yazılır).
- Kanıt: rollback adımlarının yazılı hali + bir deneme kaydı.

### Kalite kapısı build'in İÇİNDE
Build + test + type-check image build'inde (Dockerfile'da) koşmalı ki kırık
commit deploy OLAMASIN. Harici CI'a (GitHub Actions vb.) emanet edilen kapı,
CI öldüğünde (fatura, kota, konfigürasyon) kör kalır ama deploy paneli
deploy etmeye devam eder — kapı sinyalsiz kaldığında değil, aşılamaz
olduğunda kapıdır. CI varsa ek sinyal olarak kalır; kapının kendisi image
build'i içinde olmalı.
- Kanıt: Dockerfile'da test/type-check satırları + testi kırıp build'in
  kırıldığını gösteren bir koşum.

### Health check'li geçiş
Yeni container health check'ten geçmeden eskisi ölmesin ve trafik almasın
(panelin health check ayarı — gozlem.md'deki endpoint'e bağlı). Bu, T1'in
blue-green'idir: sıfır maliyetle "bozuk sürüm hiç trafik almadı" garantisi.
- Kanıt: Dockerfile HEALTHCHECK'i ve/veya panelin health check konfigürasyonu.

### Env parity — prod env listesi yazılı
Prod'un ihtiyaç duyduğu TÜM env değişkenleri bir yerde listeli mi
(`.env.example` güncel mi)? Eksik env ile açılan uygulama ya çakılır (iyi)
ya sessizce yanlış davranır (kötü — ör. secret'sız imza, koddaki varsayılan
parola, dev API'sine yazma). Açılışta zorunlu env'leri doğrulayan bir
kontrol idealdir. **Koddaki güvenli varsayılanın canlıda gerçekten ezildiğini
container env'inden doğrula** — "env ile ezilebilir" tasarımı, kimse env'i
girmediyse varsayılanla yayında demektir.
- Kanıt: `.env.example` ile paneldeki env listesinin karşılaştırması +
  kritik değişkenlerin container'da VAR olduğunun kontrolü (adları, değerleri
  değil).

### CDN/proxy cache tuzağı
HTML asla cache'lenmemeli; JS/CSS ya dosya adında hash taşımalı ya da
içerik-özetli versiyonlu URL olmalı. Aksi halde deploy'dan sonra kullanıcı
eski JS + yeni API kombinasyonu çalıştırır ve "bende hâlâ eski hali"
bug'ları başlar. Bazı CDN katmanları kaynağın `no-cache` başlığını
ezebilir — adresi içeriğe bağlamak tek güvenilir yoldur.
- Kanıt: build çıktısında hash'li dosya adları + `curl -sI` ile HTML'de
  `cache-control` başlığı.

### Paketleme tuzakları — doğru dosyalar gidiyor mu
1. `.gitignore` deploy'a girmesi gereken bir klasörü yutuyor mu? (Ör. kök
   `veri/` kuralı başında `/` yoksa `src/veri/` gibi kaynak klasörleri de
   yutar — kod lokalde çalışır, build'de klasör yoktur.)
2. Build çıktısı seçilirken glob değil build manifesti esas alınmalı —
   senkron araçlarının ürettiği "dosya 2.css" tipi hayalet kopyalar glob'la
   canlıya taşınabilir.
3. Deploy edilen commit, denetlenen repo/branch ile aynı mı? Canlının
   `SOURCE_COMMIT`'i yerel geçmişte yoksa ya yanlış repoya bakıyorsun ya
   canlı başka kaynaktan besleniyor — ikisi de bulgudur.
- Kanıt: `git ls-files` ile deploy'un beklediği yolların karşılaştırması +
  canlı container'ın commit'inin repoda bulunması.

## T1 ÖNERİLİR

- **Sürüm görünürlüğü**: çalışan sürümün commit'i/versiyonu bir yerden
  okunabilsin (`/health` cevabına commit hash koymak yeter). "Canlıda hangi
  sürüm var?" sorusunun cevabı tahmin olmamalı.
- **Build cache**: Dockerfile katman sırası (önce lockfile+install, sonra
  kod) — deploy süresini dakikalardan saniyelere indirir; yanlış sıra her
  push'ta full install demektir.
- **Feature flag'in ucuz hali**: riskli özellik için env değişkeniyle aç/kapa.
  Ayrı flag servisi değil.

## T1 GEREKMEZ — önerme

- **Kubernetes / Helm**: tek sunucu + deploy paneli dururken K8s önermek bu
  skill'de FAZLA bulgusunun ders kitabı örneğidir.
- **Blue-green / canary altyapısı**: health check'li rolling (yukarıda) aynı
  garantinin T1 halidir. Canary, gerçek trafik hacmi ve metrik altyapısı
  olmadan anlamsızdır.
- **Terraform / IaC**: tek sunucunun kurulumu operasyon.md'deki runbook'ta
  YAZILI olsun yeter; kod olarak altyapı T3 işidir.
- **API versioning / semver**: dış tüketicisi (senin kontrolünde olmayan
  istemci) olmayan API'de gerekmez. Dışarı verilen paket/artefakt varsa
  orada sürümleme zaten ürün gereğidir.
- **Cold start / serverless limits**: VPS'te KAPSAM DIŞI.
- **CDN stratejisi**: önünde zaten bir CDN/proxy varsa ayrıca kurulmaz,
  sadece cache kuralları (yukarıda) doğru olur.
