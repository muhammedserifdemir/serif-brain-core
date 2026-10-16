# Disiplin — ayrıntı (S1'de ilgili bölüm, S2/S3'te tamamı okunur)

SKILL.md çekirdeği anlatır. Bu dosya kapıların ayrıntısıdır; S0/S1 işte yalnız
dokunduğun konunun bölümünü oku.

## §1 Bağlam kapısı — dokunmadan önce

1. **Hafıza:** `serif-brain brief`; davranışını değiştireceğin dosya için
   `serif-brain guard <dosya>`. Claude Code kapısı kuruluysa ikisi de otomatik gelir;
   elle yalnız blok gelmediyse koşulur. Brain yoksa `git log -5 -- <dosya>` + README/CLAUDE.md.
   Brain teşhisleri hipotezdir; bu turda yeniden doğrulanır.
2. **Ağaç kimin:** `git status`. Sana ait olmayan commit'lenmemiş değişikliğe dokunulmaz,
   commit'lenmez, temizlenmez; raporda belirtilir.
3. **Kim koşuyor:** Sunucu/build/başka terminal ihtimalinde `lsof -i` ve `ps` ile bak.
4. **Gerçek durum:** Hata nerede görüldüyse orada üretilir. Üretilemeyen hata
   düzeltilmeye başlanmaz.

## §2 Kabul kapısı — ayrıntı

- Önce → sonra, kullanıcının gördüğü yüzeyin adıyla ("ayarlar ekranı kaydet düğmesi").
- Ölçüt ikili ve gözlenebilir. "Daha iyi" ölçüt değildir.
- Hangi veriyle: üretim dağılımını temsil eden veri mi, tek sentetik fikstür mü?
  Sayı içeriyorsa önce **olcum-sozlesmesi**.
- Kapsam dışı açıkça yazılır.
- Para, veri silme, canlıya yazma, geri dönüşsüz işlem → dur, sahibe sor.

## §3 Sistem kapısı — S2/S3 modül defteri

Yöntem, derinlik modları ve şablon: `references/modul-defteri.md`. Kısaca:

- **İki kaynak:** kod (route, modal, handler, iş, dışa aktarma, e-posta, flag) ve
  kullanıcı gözü (gerçek yüzeyde her öğe). İkisi arasındaki fark bulgudur.
- **Durum matrisi:** her akış için boş, yükleniyor, dolu, hata, yetkisiz, zaman aşımı,
  uzun içerik, TR/EN, dar ekran. Uymayan sütun başlıkta bir kez `GEREKMEZ (neden)`.
- **Veri yaşam döngüsü:** her varlık için oluşturan, gören (kiracı/rol), silen,
  silinince bağlı kayıtlar, yedek.
- **İkiz mantık:** aynı mantık iki yerdeyse satır `İKİZ`, **ikiz-kod** zorunlu.
- Depoda yeni `docs/defter/` açılacaksa sahibe ilk seferde tek satırla söylenir.

## §4 Teslim kapısı — dilimler

- Sıra: temel → çalışan mutlu yol → hata ve kenar durumları → cila.
- Her dilim gözlenebilir bir sonuç ve kendi kabul satırını taşır.
  "Önce tüm API, sonra tüm UI" yapılmaz.
- Migration, geri alma, izleme gerekiyorsa dilimin içinde yazılır.
- Tek aktif iş. Akla gelen yan iş defterin PARK bölümüne yazılır, açılmaz.

## §5 Uygulama kapısı — özel durumlar

- **Kırmızı test projenin kendi test paketine commit'lenir.** Geçici klasördeki test
  regresyonu korumaz. Otomatik test kurulamıyorsa (saf görsel, native UI, donanım)
  düzeltme öncesi kare/komut çıktısı alınır, nedeni yazılır. Ayrıntı: **test-once**.
- **Katalog taraması:** `bash <bu-skill>/scripts/katalog-tara.sh [taban-ref]`.
  Tetiklenen her sınıf: `yok (neden)` | `var → düzeltildi (test)` | `var → PARK`.
  Ardından `references/kusur-katalogu.md` → "Her zaman sor" (5 soru).
- **Kalıcı biçim** (kayıtlı JSON, DB şeması): sürüm alanı + göç fonksiyonu; eski
  fikstürle "açılıyor mu" testi; migration'ın geri alma yolu prod kopyasında denenir;
  NOT NULL sütun mevcut satırlarla test edilir.
- **Bağımlılık yükseltme:** tek seferde tek ana sürüm; changelog'daki kırıcı
  değişiklikler listelenir; lockfile diff'i okunur; build + test + bir gerçek akış;
  `npm audit` (veya eşdeğeri) önce/sonra sayısı yazılır.
- **Yeni env/config:** `.env.example` güncellenir, canlı ortama girilir; uygulama
  açılışta değişkeni doğrular, eksikse gürültülü çöker (sessiz varsayılan yok);
  RUNBOOK'a bir satır.
- **API sözleşmesi:** eski istemci (açık sekme, masaüstü sürüm) yeni sunucuyla
  çalışıyor mu? Kırılıyorsa sürümleme ya da "yenile" uyarısı.
- **Kök nedene sistematik çözüm:** hata elle yazılmış bir değerden geliyorsa şema,
  üretici veya doğrulayıcıdan biri kurulur; yalnız değeri düzeltmek yetmez.

## §6 Doğrulama kapısı — kimi çağır

- **kanit-disiplini:** her ölçekte.
- **olcum-sozlesmesi:** her sayı için.
- UI'li S2 işte projede kuruluysa UI denetim skill'i; UI'siz S2'de kod denetimi
  (kuruluysa kendi skill'i, yoksa `/code-review`).
- **Bağımsız göz:** yetki, veri, para, silme ya da kalıcı biçime dokunan her diff
  (S1 dahil) kapanıştan önce taze bir agent ya da `/code-review` ile incelenir.
  Yapan kendini puanlamaz.
- "Sayı doğru, iddia yanlış" sorusu: ölçtüğüm şey kullanıcının şikâyet ettiği şeyin
  kendisi mi?

## §7 Yayın ve kapanış

**Yayın:**
- **prod-kapisi:** S2/S3'te tam, S1'de ilgili maddeler. Canlıya çıkmayan ürün için
  `GEREKMEZ (neden)`.
- **Temiz kopyada kapı:** push'tan önce kapı, izlenmeyen dosyaları görmeyen temiz bir
  kopyada koşar (`git clone` → geçici dizin → kurulum → test). İmajla yayında kapı
  `.dockerignore` uygulanmış bağlamda (`docker build`) koşar.
- **Derlenen SHA'yı yayınla:** `git push origin <SHA>:<dal>`, ön planda.
  Sunucuda yayınlar sırayla.
- **Canlı doğrulama:** canlıdaki sürüm kimliği beklenen SHA mı; kabul ölçütü canlıda
  yeniden kanıtlanır ("deploy başarılı" kanıt değildir); önbellek (CDN, service
  worker, sert yenileme) kontrol edilir.

**Kapanış:**
- Defter: satır durumları, kanıt yolları, park listesi.
- Brain: `add decision` / `add bug` (gövde zorunlu) / `close --note`. Commit'te
  `Brain-Closes: <id>` trailer'ı kullanılırsa `sync-commits` kapanışı kendisi yapar.
- **Katalog beslemesi:** yeni hata sınıfı yaşandıysa önce mevcut bir sınıfa
  genelleştirilebilir mi bakılır; değilse yeni satır. Yakalama yolu otomatik kapıya
  (betik deseni, `serif-brain lint` imzası, test) çevrilebiliyorsa çevrilir ve sınıf
  `kapılı` işaretlenir.
- **somut-rapor:** önce sonuç, en fazla 3 madde, en fazla 1 soru.

## Modül "bitti" tanımı (S2) — altısı birden

1. Defter iki kaynaktan çıkarılmış; fark sıfır ya da açıklanmış.
2. Durum matrisinde boş hücre yok: `✓ kanıt` | `GEREKMEZ (neden)` | `PARK (kim)`.
   Derinlik modu ve "bakılmayanlar" yazılı.
3. Denetim raporunda açık engelleyici yok; büyük bulgular kapalı ya da sahibin
   bilgisiyle parkta.
4. prod-kapisi GEÇTİ ya da `GEREKMEZ (canlıya çıkmıyor)`.
5. Canlı ürünse canlı sürüm kapıdan geçen SHA, kabul ölçütleri canlıda kanıtlı.
6. Brain güncel; park listesi sahibe söylenmiş.

"Büyük ölçüde bitti" yoktur. Kalan şey ya bir defter satırıdır ya da parktır.
