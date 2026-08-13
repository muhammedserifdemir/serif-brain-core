# Marka Profili — serif-brain

## Ürün
**serif-brain** — projelerin karar/hata hafızasını dosya sistemine yazan, bunu kod grafına
bağlayan ve düzenleme anında devreye giren mekanik kapılara çeviren geliştirici aracı.

## Tek cümlelik değer önerisi
AI ajanı her oturumda sıfırdan başlar; serif-brain projenin hafızasını kalıcı kılar ve o
hafızayı "tavsiye" değil, atlanamaz bir kapı hâline getirir.

## Hedef kitle
- Solo founder / küçük ekip yazılımcıları
- AI destekli geliştirme yapanlar (Claude Code, Cursor, Copilot)
- Çok projeli teknik kurucular

## Ana kanca (tek mesaj)
**"Tavsiye atlanabilir, kapı atlanamaz."**
Yardımcı belge yazmak yetmiyor; kural düzenleme anında mekanik olarak devreye girmeli.

## Ton
Build-in-public, mühendislik odaklı, iddiasız. Abartı yok, ölçüm var.
Başarı hikâyesi değil, **problem + yaklaşım + ölçülen sonuç**.

## Kanallar
LinkedIn (birincil). X ikincil. Instagram uygun değil (görsel ürün değil).

## Doğrulanmış rakamlar (SADECE bunlar kullanılabilir)
| Ölçüm | Değer | Kaynak |
|---|---|---|
| İzlenen proje | 19 | disk taraması, 2026-08-13 |
| Toplam karar/bug/not kaydı | 1.217 | aynı taramanın toplamı |
| En büyük kod grafı | 2.605 düğüm | serif-platform graph.json, 2026-08-13 |
| Test | 364 | `npm test`, 2026-08-13 |
| Runtime bağımlılık | 0 | package.json `dependencies: {}` |
| Dışarı giden ağ isteği | 0 | kaynak taraması; panel yalnız 127.0.0.1 |

> Rakamlar bayatlar. `test/belge-dogrulugu.test.mjs` test sayısı iddiasını
> mekanik olarak denetler; diğerleri yayından önce elle doğrulanır.

**Kullanılamayacak iddialar:** kullanıcı sayısı, benimsenme, "en iyi/ilk", performans
karşılaştırması, zaman tasarrufu yüzdesi. Hiçbiri ölçülmedi.

## Görsel kimlik
- Zemin `#0F172A`, vurgu `#38BDF8`, çalışıyor `#22C55E`
- İkon: merkez düğüm + 5 uydu (merkezî hafıza metaforu)

## Gizlilik kuralı (ZORUNLU)
Gerçek panel/graf ekran görüntüsü **paylaşılamaz**: müşteri adları (ör. Güleryüz Ağız Diş),
belediye pilotuna ait **açık güvenlik kaydı** ve iç proje adları görünür.
Görseller anonimleştirilmiş demo veriden üretilir; **büyüklükler gerçek, kimlikler değil.**

## Durum
Repo **private**. Tek kullanıcı (kurucu). Açık kaynak için ön koşullar:
1. Windows/Linux'ta uçtan uca çalışma (veya "macOS-only" açık beyanı)
2. İngilizce README + ekran görüntüsü + 60 saniyelik kurulum yolu
3. Kurucudan başka en az bir kullanıcı

Bu koşullar tamamlanana kadar paylaşımlar **fikir postu** formatındadır, ürün lansmanı değil.
