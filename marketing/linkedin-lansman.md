# LinkedIn — serif-brain lansman postu

**Format:** tek görsel + metin · **Görsel:** `panel.png` (anonim demo verisi)
**CTA:** tek — repo linki (postun İÇİNDE, yorumda değil)
**Sayılar:** `marketing/brand.md` doğrulanmış tablo, 2026-08-13

> ⚠ Yayından önce: repo PUBLIC olmalı. Aksi halde hem link hem kurulum komutu
> 404 verir. Bkz. brand.md "Durum".

---

## POST

> Aylardır her sabah aynı şeyi yapıyordum: AI'a projemi baştan anlatmak.
>
> Geçen ay o kararı neden verdiğimi, hangi dosyanın canımı yaktığını, neyi bilerek öyle bıraktığımı... Hepsini, her oturumda, yeniden.
>
> Sonunda dayanamadım ve kendime bir şey yazdım. Bugün açık kaynak yapıyorum. MIT, ücretsiz.
>
> **serif-brain** projenin kararlarını ve hatalarını dosya sistemine yazıyor, kod grafına bağlıyor. Ama asıl mesele şu: senin okumanı beklemiyor.
>
> Bir dosyaya dokunmadan önce o dosyanın geçmişini önüne koyuyor. Düzenledikten hemen sonra yapısal kontrolü çalıştırıyor. "Bitti" demeden önce kapıyı kapatıyor.
>
> Çünkü tavsiye atlanabilir. Kapı atlanamaz.
>
> En sevdiğim tarafı, kendi verinin sende kalması: sıfır bağımlılık, saf Node. Kayıtlar düz Markdown — `git diff`'te okuyorsun, canın isterse elle düzeltiyorsun. Bulut yok, hesap yok, dışarı giden tek bir istek yok.
>
> Kurulumu tek satır:
> `npm i -g git+https://github.com/muhammedserifdemir/serif-brain-core.git`
>
> 👉 github.com/muhammedserifdemir/serif-brain-core
>
> Claude Code ile çalışıyor. Sihirli değil, baştan söyleyeyim: hafıza yalnızca yazdığın yerde var. Ama bir kez yazdın mı, bir daha kaybolmuyor.
>
> Kullanan olursa neyin eksik kaldığını duymak isterim — asıl merak ettiğim o.
>
> #YazılımGeliştirme #YapayZeka #BuildInPublic #DeveloperTools #SoloFounder

**Kelime:** ~205 · **Kanca:** 1. satır · **CTA:** tek link

---

## Neden bu biçim

- **Kanca kişisel bir itiraf**, ürün tanıtımı değil. "Her sabah aynı şeyi yapıyordum"
  okuyucunun kendi sabahı; ürün adı 4. paragrafa kadar geçmiyor.
- **Fayda listesi değil, günün akışı**: dokunmadan önce / hemen sonra / bitmeden önce.
  Özellik saymak yerine kullanıcının zaten yaptığı üç anı işaretliyor.
- **"Armağan" iddia edilmiyor, gösteriliyor**: MIT + ücretsiz + veri sende + tek satır
  kurulum. Bedava demekle "kilitlenme yok, verin makinenden çıkmıyor" demek farklı.
- **Sınır önden söyleniyor** ("sihirli değil"). Abartılı vaat, denemeye gelen
  geliştiricinin güvenini ilk 10 dakikada bitirir; sınırı söylemek doğru kişiyi getirir.
- **Claude Code bağımlılığı gizlenmiyor.** Cursor kullanan biri kurup hayal
  kırıklığına uğrarsa, kazanılan ilgi kaybedilen güvene değmez.
- **CTA tek**: repo. Kurulum komutu linkin hemen üstünde, çünkü LinkedIn'de
  tıklamayan ama kopyalayan bir kitle var.

## Yayın öncesi kontrol

- [ ] Repo public (yoksa link + kurulum komutu 404)
- [ ] GitHub Actions faturası çözülmüş (README'de CI rozeti var; kırmızı görünür)
- [ ] `panel.png` hâlâ anonim
- [ ] brand.md'deki rakamlar taze
- [ ] **Windows'ta uçtan uca çalıştırma yapılmadı** — ya denenmeli ya da
      README'de açıkça "macOS/Linux'ta doğrulandı" yazmalı
