# Veri — kaybolmayan, bozulmayan, yavaşlamayan

Kapsanan liste kavramları: backups, database migrations, schema versioning,
database indexing, query optimization, N+1 queries, connection pooling,
read replicas, sharding, partitioning, replication, CAP theorem, eventual
consistency, optimistic/pessimistic locking.

Temel ilke: **veri tek geri alınamaz varlıktır.** Kod yeniden yazılır, sunucu
yeniden kurulur; silinen kullanıcı verisi geri gelmez. Bu dosyanın ilk iki
maddesi diğer her şeyden önemlidir.

## T1 ZORUNLU

### Backup + RESTORE TESTİ — kapının en sert maddesi
Backup'ın varlığı değil, **geri dönülebilirliği** denetlenir. Üç soru:
1. Otomatik mi ve sunucu DIŞINA çıkıyor mu? (Aynı diskteki backup, disk
   ölünce backup değildir. Sağlayıcı snapshot'ı + harici dump ideal ikili.)
2. Restore en az bir kez DENENMİŞ mi? Boş bir DB'ye dump'ı geri yükle,
   uygulamayı ona bağla, açıldığını gör. Denenmemişse madde YOK'tur.
3. Ne kadar veri kaybı göze alınıyor? (Günlük backup = en kötü 24 saat kayıp.
   Bu bilinçli bir karar olmalı, tesadüf değil.)

⚠ En sinsi biçimi: sunucuda backup düzeni VAR ama **bu projeyi kapsamıyor**
(ör. script yalnız Postgres container'larını tarıyor, bu proje SQLite/dosya
kullanıyor). "Backup script'i çalışıyor, log 'Done' diyor" üçlemesi teker
teker doğru olup yine de yanlış sonuca götürebilir — script'in içini oku ve
hedef depoda BU projenin dosyasını gör.
- Kanıt: backup cron/panel tanımı + hedefte bu projeye ait son backup
  dosyasının tarihi/boyutu + restore denemesinin çıktısı.

### Volume kalıcılığı — container silinince veri duruyor mu
Container'lı deploy'da veritabanı dosyası veya upload klasörü container
içindeyse her redeploy'da silinir. Kalıcı veri named volume / bind mount'ta
olmalı.
- Kanıt: panelin storage tanımı veya `docker inspect` mount listesi.

### Migration disiplini
Şema değişikliği migration dosyasıyla gider; canlıda elle ALTER yok. Migration
deploy'un parçası mı, sırası belli mi, geri alınabilir mi (en azından geri
alma planı yazılı mı)? Elle yapılmış şema değişikliği, bir sonraki temiz
kurulumda "kodda var, DB'de yok" sürprizi üretir.
- Kanıt: migration klasörü + canlı şemanın migration'larla üretilebildiğinin
  işareti (migration tablosundaki son kayıt).

### Unique/foreign key constraint'ler DB seviyesinde
Tekillik ve bütünlük kuralları uygulama kodunda değil DB'de yaşar — kod
katmanındaki kontrol race'e açıktır ve ikinci bir yazma yolu (script, elle
SQL) kuralı bilmez.
- Kanıt: şema dosyasında constraint'ler; kritik tablolar için `\d tablo`.

### Connection pool sınırı (Postgres/MySQL ise)
Pool limiti Postgres `max_connections`'ın altında mı? Aynı sunucuda birkaç
uygulama aynı Postgres'i kullanıyorsa toplamları da sığmalı. SQLite ise
KAPSAM DIŞI (ama WAL modu açık mı diye bak — eşzamanlı okuma için).
- Kanıt: pool config satırı + `SHOW max_connections`.

### Dosya-tabanlı depo kullanılıyorsa: atomik yazma + bozulma davranışı
JSON/dosya deposunda iki tuzak birleşince tüm veri gider: (1) doğrudan
`writeFileSync` atomik değildir — yarıda kesilirse dosya bozulur (doğrusu:
geçici dosyaya yaz + rename); (2) okuma tarafı bozuk dosyada sessizce boş
liste dönüyorsa, sonraki kayıt o boş listeyi diske yazar ve **tüm depo tek
adımda silinir**. Bozuk dosya boş veri değil, YÜKSEK SESLİ hata olmalı.
- Kanıt: yazma yolunun kodu (temp+rename var mı) + okuma yolunun bozuk
  girdi davranışı.

## T1 ÖNERİLİR

### Index kontrolü
WHERE/JOIN/ORDER BY'da kullanılan kolonlar ve tüm foreign key'ler indexli mi?
Küçük veriyle her sorgu hızlıdır; sorun 50k satırda başlar ve "site yavaşladı"
diye gelir. Listeleme uçlarının sorgularına bir kez `EXPLAIN` bakmak ucuzdur.
- T2'de ZORUNLU.

### N+1 taraması
Liste döndüren uçlarda döngü içinde sorgu var mı? (ORM'lerde en yaygın form:
her satır için ilişkili kaydı ayrı çekmek.) 20 kayıtlık listede 21 sorgu =
N+1. Çözüm join/include/batch.

## T1 GEREKMEZ — önerme

- **Read replica, sharding, partitioning, replication**: tek DB, doğru
  indexlerle, T1 trafiğini taşır. Replica ancak T3'te veya okuma yükü
  kanıtla gösterildiğinde. Tek sunucuda replica görürsen FAZLA bulgusu.
- **CAP / eventual consistency**: tek DB'de tartışma konusu değil; her şey
  zaten strongly consistent. Bu kavramların koda sızması (ör. gereksiz
  eventual-consistency deseni) FAZLA bulgusudur.
- **Optimistic/pessimistic locking**: aynı kaydı iki kullanıcının eşzamanlı
  düzenlediği gerçek bir senaryo varsa (CMS, form editörü) version kolonu
  ile optimistic locking değerlendirilir; yoksa transaction yeter.

## T2'DE EKLENEN

- **KVKK/GDPR veri saklama**: kişisel veri hangi tablolarda, saklama süresi
  ne, silme talebi gelirse yol var mı (hard delete mi anonimleştirme mi)?
  Kurum müşterisi olan üründe ZORUNLU.
- **Backup şifreleme**: kişisel veri içeren dump sunucu dışına düz metin
  çıkmaz.
