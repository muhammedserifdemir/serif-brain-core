# LinkedIn — serif-brain

**Format:** tek görsel + metin. **Görsel:** `panel.png` (birincil) — `graf.png` ikinci kare (carousel).

**Sayı sözleşmesi (2026-08-11'de ölçüldü, yayından önce tekrar doğrula):**

| İddia | Gerçek | Nasıl ölçüldü |
|---|---|---|
| Brain'li proje | **19** (boş olmayan) | `find ~ -name .serif-brain` + obje sayımı |
| Karar/hata kaydı | **1.217** | aynı taramanın toplamı |
| En büyük kod grafı | **2.605 düğüm** | `graph.json` nodes |
| Test | **364** | `npm test` |
| Kapı kurulu | **global** → tüm projeler | `~/.claude/settings.json` |

> ⚠ Önceki taslak "17 proje, 930 kayıt, 229 test" diyordu ve **merkez iddiası <!-- belge-dogrulugu:yoksay -->
> 22 projeden 1'inde doğruydu** — kapı yalnız paketin kendi reposunda kuruluydu.
> Global kuruluma geçildi; artık iddia gerçeği anlatıyor. Sayı değişirse metni
> değiştir, metni koruyup sayıyı zorlama.

---

## ÖNERİLEN — A varyantı: "Tavsiye vs. kapı"

> AI'a "şunu yapma" demek işe yaramıyor. Çünkü tavsiye atlanabilir.
>
> Aylardır AI ile kod yazıyorum ve tekrar eden bir sorun var: model her oturuma
> sıfırdan başlıyor. Geçen ay "bunu şu yüzden böyle yapmıştık" diye verdiğim
> kararı bu hafta bilmiyor. Aynı hatayı ikinci kez yapıyor.
>
> Önce doküman yazdım. Sonra talimat dosyaları. İkisi de aynı sebepten yetersiz
> kaldı: **bunlar tavsiyedir, model okumayı atlayabilir.**
>
> Yaklaşımı değiştirdim. Projelerimin kararlarını ve hatalarını dosya sistemine
> yazdım, bunları kod grafına bağladım — sonra en kritik adımı attım: bu bilgiyi
> *düzenleme anında* devreye giren mekanik bir kapıya çevirdim.
>
> Artık bir dosyaya dokunulmadan önce o dosyanın geçmişi otomatik önüne düşüyor.
> Düzenlemeden sonra yapısal kontrol çalışıyor. "Bitti" denmeden önce kapı
> sorguluyor. Atlanamıyor, çünkü tavsiye değil.
>
> İşin ilginç yanı, kapının kendisi de bir disiplin dayatıyor: **söyleyecek şey
> yoksa susuyor, ve söylediğini bir daha söylemiyor.** İkincisini eklemek zorunda
> kaldım — çünkü tekrar eden bir uyarı, uyarı değil gürültüdür.
>
> Bugünkü hâli: 19 proje, 1.217 karar/hata kaydı, en büyüğü 2.605 düğümlük kod
> grafı. Sıfır bağımlılık, saf Node, 364 test.
>
> En çok şu ders kaldı: bir kuralın işe yaraması için doğru olması yetmiyor —
> **atlanamaz olması gerekiyor.**
>
> Siz AI ile çalışırken bağlamı nasıl kalıcı kılıyorsunuz? Yorumlarda merak
> ediyorum.
>
> #YazılımGeliştirme #YapayZeka #BuildInPublic #SoloFounder #DeveloperTools

**Kelime:** ~215 · **Kanca:** 1. satır · **CTA:** tek soru

---

## B varyantı — "Sessiz hata" (teknik kitle, en güçlü içerik)

> Bir aracın "sorun yok" demesi, sorun **aramadığı** anlamına gelebilir.
>
> Kendi geliştirici aracımda bu haftaki en pahalı hatayı buldum. Kod her
> düzenlemeden önce projenin hafızasını önüme koyan bir kapı çalıştırıyor.
> Aylardır sessizdi. "Demek temiz" diye düşündüm.
>
> Değildi. Kapının çağırdığı komutlar, **bulgu varsa** sıfır olmayan çıkış kodu
> veriyor — pre-commit kapısı oldukları için bu doğru davranış. Ama kapıyı
> çalıştıran kod, sıfır olmayan her çıkışı "komut başarısız" sayıp çıktıyı
> atıyordu.
>
> Yani kapı, **tam da sorun bulunduğunda susuyordu.** Sorun yokken konuşuyor,
> sorun varken susuyordu. Bu yüzden aylarca "çalışıyor" göründü.
>
> Aynı hafta ikinci bir örnek: bir yapılandırma kuralı yazdım, hiçbir şey
> değişmedi. Sebep şuydu — kod `graftanGelen || configtenGelen` diye yazılmıştı;
> graf eşleşmeyen dosyaya `"unknown"` yazıyor ve **`"unknown"` truthy'dir.**
> Yani yedek yol hiç çalışmadı. Kuralı yazan kişi hiçbir uyarı görmedi.
>
> İkisinin de ortak dersi şu: **bir kural yazılıp üretim yolu onu çağırmıyorsa,
> yazan kişi hiçbir hata görmez.** Testin geçmesi bunu yakalamaz; yanlış şeyi
> ölçen bir kanıt, kanıtsızlıktan daha tehlikelidir — çünkü üstüne karar
> verirsiniz.
>
> Şimdi kuralım şu: bir kapı eklerken *aynı turda* onun sustuğu durumu da test
> ediyorum. "Konuşuyor mu" değil, "susması gerektiğinde susuyor, konuşması
> gerektiğinde konuşuyor mu."
>
> Sizin "aylardır sessizdi, meğer bozukmuş" hikâyeniz hangisi?
>
> #YazılımGeliştirme #YapayZeka #BuildInPublic #DeveloperTools

**Kelime:** ~250 · **Not:** A'dan daha dar kitle ama etkileşimi daha derin;
teknik okuyucu bu tür postu kaydeder ve paylaşır.

---

## Yayın notları

- **"Sınırsız bağlam" DEME.** Ürünün yaptığı bunun tersi ve güçlü olanı da o:
  17 kaydın tamamı ~9.222 token, oturuma giren ~407 token (%4,4). Doğru cümle:
  *"hafızanın %4'ünü göstererek %100'ünü hatırlatıyor."* Piyasa 2026'da tam
  buraya yakınsadı (seçici hatırlatma, milyon-token bağlamdan ucuz).
- **Kategori kalabalık** (Cognee, CodeGraph MCP, Codebase Memory MCP…).
  "Hafıza sistemi yaptım" postu kaybolur. Ayrıştırıcı olan şey **kapı**:
  rakipler *sorgulanmayı bekleyen* MCP sunucuları; bu, sorulmadan konuşuyor.
- **B varyantı ürün övmüyor, yine de ürünü satıyor.** Solo founder için
  mühendislik-disiplini içeriği, ürün duyurusundan daha uzağa gider.
- Repo public yapılacaksa önce: `.serif-brain/` içeriği tarandı ve temiz
  (müşteri/sunucu/kimlik yok), görseller anonim, lisans MIT.
