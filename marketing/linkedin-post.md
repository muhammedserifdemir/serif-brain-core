# LinkedIn — serif-brain fikir postu

**Format:** tek görsel + metin. Ürün lansmanı DEĞİL, fikir postu (repo private, tek kullanıcı).
**Görsel:** `panel.png` (birincil) — istenirse `graf.png` ikinci kare olarak carousel.

---

## ÖNERİLEN — A varyantı: "Tavsiye vs. kapı"

> AI'a "şunu yapma" demek işe yaramıyor. Çünkü tavsiye atlanabilir.
>
> Aylardır AI ile kod yazıyorum ve tekrar eden bir sorun var: model her oturuma sıfırdan
> başlıyor. Geçen ay "bunu şu yüzden böyle yapmıştık" diye verdiğim kararı bu hafta
> bilmiyor. Aynı hatayı ikinci kez yapıyor.
>
> Önce doküman yazdım. Sonra talimat dosyaları. İkisi de aynı sebepten yetersiz kaldı:
> **bunlar tavsiyedir, model okumayı atlayabilir.**
>
> Yaklaşımı değiştirdim. Projelerimin kararlarını ve hatalarını dosya sistemine yazdım,
> bunları kod grafına bağladım — sonra en kritik adımı attım: bu bilgiyi *düzenleme anında*
> devreye giren mekanik bir kapıya çevirdim.
>
> Artık bir dosyaya dokunulmadan önce o dosyanın geçmişi otomatik önüne düşüyor.
> Düzenlemeden sonra yapısal kontrol çalışıyor. "Bitti" denmeden önce kapı sorguluyor.
> Atlanamıyor, çünkü tavsiye değil.
>
> Bugünkü hâli: 17 proje, 930 karar/hata kaydı, en büyüğü 2.537 düğümlük kod grafı.
> Sıfır bağımlılık, saf Node, 229 test.
>
> En çok şu ders kaldı: bir kuralın işe yaraması için doğru olması yetmiyor — **atlanamaz
> olması gerekiyor.**
>
> Siz AI ile çalışırken bağlamı nasıl kalıcı kılıyorsunuz? Yorumlarda merak ediyorum.
>
> #YazılımGeliştirme #YapayZeka #BuildInPublic #SoloFounder #DeveloperTools

**Kelime:** ~185 · **Kanca:** 1. satır · **CTA:** tek soru · **Etiket:** 5

---

## B varyantı: "Sessiz hata" (daha teknik, dar kitle)

> Bir aracın "sorun yok" demesi, sorun aramadığı anlamına gelebilir.
>
> Kendi geliştirici aracımda bu haftaki en pahalı hatayı buldum: kural dosyalarını
> okuyan ayrıştırıcı, aracın kendi dokümanının önerdiği yazım biçimini çözemiyordu.
> Kurallar yüklenmiş *görünüyor*, ama boş geliyordu.
>
> Sonuç: katman ihlallerini denetleyen kapı, denetleyecek kuralı olmadığı için
> yeşil yanıyordu. Hata veren bir sistem değil — sessizce onaylayan bir sistem.
>
> Bu, hatanın en pahalı sınıfı: kanıt var ama kapsam yanlış. Kullanıcı yeşil ışığa
> bakıp karar veriyor.
>
> Düzelttikten sonra kapıya bir şey daha ekledim: artık **neyi denetlemediğini** de
> söylüyor. "5 dosyanın 3'ü grafta yok, bu dosyalar için sonuç YOK" diyor.
>
> Bir kapının en tehlikeli hâli, yanlış cevap vermesi değil — kapsamını gizlemesi.
>
> Sizin sisteminizde "sorun yok" çıktısı, gerçekten arandığını kanıtlıyor mu?
>
> #YazılımKalitesi #DeveloperTools #BuildInPublic #Mühendislik

**Kelime:** ~160 · Daha dar kitle, daha yüksek teknik güven

---

## Yayın notları

**Görsel:** `panel.png` — anonimleştirilmiş demo veri. Gerçek panel ekran görüntüsü
paylaşılamaz (müşteri adı + açık güvenlik kaydı görünür, bkz. `brand.md`).

**Sunulmayacaklar:**
- Repo linki (private) — "ilgilenen yazsın" bile deme, veremezsin
- Kullanıcı/benimsenme iddiası — tek kullanıcı var
- "Açık kaynağa açıyorum" — `brand.md`'deki 3 koşul tamamlanmadan olmaz

**Yorum gelirse hazır cevap:**
> "Henüz private — Windows tarafı test edilmedi ve README İngilizce değil.
> O ikisi bitince açacağım."

**Zamanlama:** Salı–Perşembe 09:00–11:00 TR (LinkedIn TR teknik kitle en aktif).

**Sonraki post fikri (2 hafta sonra):** bir hafta gerçek kullanım sonrası "ne işe yaradı,
ne gürültü çıktı" ölçümü. Kullanım verisi biriktikten sonra daha güçlü olur.
