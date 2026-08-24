# Güvenlik — operasyon tarafı

Kapsanan liste kavramları: TLS, encryption at rest/in transit, secrets
management, IAM, OAuth, JWT rotation, WAF, DDoS protection, CORS, rate
limiting (güvenlik yönü), dependency hell (güvenlik yönü).

**Sınır çizgisi:** SQLi, XSS, CSRF, SSRF, yetki kaçağı gibi KOD seviyesi
zafiyetler bu dosyada DENETLENMEZ — onlar `kod-denetim` (yetki + hata yolu
mercekleri) veya `/security-review`'un işidir. Bu dosya koda değil kuruluma
bakar: sertifika, secret, başlık, sınırlama. Kod tarafı koşulmadıysa raporda
"kod güvenliği: denetlenmedi" satırı zorunludur — sessizce VAR sayılmaz.

## T1 ZORUNLU

### TLS uçtan uca
1. Site HTTPS ve HTTP → HTTPS yönlendiriyor.
2. Cloudflare SSL modu **Full (strict)** — "Flexible" modda Cloudflare→origin
   arası düz HTTP'dir; kilit ikonu vardır ama şifreleme yarımdır.
- Kanıt: `curl -sI http://<site>` (301 görünmeli) + Cloudflare SSL ayarı.

### Cloudflare proxy + temel koruma
DNS kaydı proxy'li mi (turuncu bulut)? Bu tek başına WAF'ın ve DDoS
korumasının temel katmanını bedavaya verir ve origin IP'yi gizler. Gri
buluta düşmüş kayıt, sunucu IP'sini dünyaya açar.
- Kanıt: `dig <site>` çıktısında Cloudflare IP'si (origin IP görünmemeli).

### Secrets yönetimi
1. Repo'da secret yok — `.env` gitignore'da VE geçmişe sızmamış
   (`git log --all --diff-filter=A -- .env` boş dönmeli; sızdıysa anahtar
   döndürülür, sadece silmek yetmez — geçmişte durur).
2. Canlı secret'lar Coolify env'de, container image'ına gömülü değil.
3. Aynı secret iki ortamda (dev/prod) ortak değil.
- Kanıt: gitleaks/grep taraması çıktısı + Coolify env listesinin varlığı.

### Auth uçlarında rate limit
Login, kayıt, OTP, şifre sıfırlama uçları denemeye karşı sınırlı mı?
Sınırsız login ucu, sızmış şifre listeleriyle otomatik taranan ilk hedeftir.
Uygulama içi limiter veya Cloudflare rate limiting rule — biri yeter.
- Kanıt: limiter kodu/kuralı + arka arkaya isteklerde 429 döndüğünün testi.

### CORS — wildcard değil
`Access-Control-Allow-Origin: *` credentials taşıyan API'de bulgudur. İzinli
origin listesi açık yazılmalı. (Tarayıcıdan çağrılmayan salt-sunucu API'de
KAPSAM DIŞI.)
- Kanıt: `curl -sI -H "Origin: https://evil.example" https://<site>/api/...`
  cevabındaki CORS başlıkları.

### Oturum/token temel hijyeni
- Cookie'ler `HttpOnly; Secure; SameSite` taşıyor mu?
- JWT kullanılıyorsa süresi makul mü (saatler, aylar değil) ve logout/ban
  gerçekten erişimi kesiyor mu? (Süresiz JWT + kontrolsüz refresh = banlanan
  kullanıcı içeride kalır.)
- Kanıt: Set-Cookie başlığı çıktısı + token üretim kodundaki expiry satırı.

## T1 ÖNERİLİR

- **Güvenlik başlıkları**: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options`/`frame-ancestors`, temel bir CSP. Beş dakikalık iş,
  bir sınıf saldırıyı kapatır.
- **Bağımlılık taraması**: `npm audit --omit=dev` — critical/high bulgular
  değerlendirilir (hepsi gerçek değildir ama bakılmadan geçilmez).
- **Admin yüzeyi ayrımı**: admin paneli tahmin edilir yolda ve herkese açık
  mı? En azından rate limit + güçlü parola; idealde IP kısıtı veya Cloudflare
  Access.

## T1 GEREKMEZ — önerme

- **Ücretli/ayrı WAF ürünü**: Cloudflare proxy'nin verdiği yeter.
- **IAM altyapısı** (Vault, AWS IAM benzeri): Coolify env + tek sunucuda
  gereksiz katman.
- **JWT anahtar rotasyon otomasyonu**: T1'de "sızıntı şüphesinde anahtarı
  elle değiştir ve tüm oturumları düşür" planının YAZILI olması yeter;
  otomasyon T2+.
- **Encryption at rest (disk/DB şifreleme)**: T1'de VPS sağlayıcının fiziksel
  güvenliğine dayanmak kabul edilebilir; kişisel/kurumsal veri taşıyan T2'de
  backup şifreleme (bkz. veri.md) ve gerekirse kolon seviyesi şifreleme
  gündeme gelir.
