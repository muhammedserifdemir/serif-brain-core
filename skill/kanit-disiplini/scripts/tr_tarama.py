#!/usr/bin/env python3
"""Türkçe karakter ve jargon taraması.

Kullanım:
    python tr_tarama.py <dosya|dizin> [<dosya|dizin> ...]

İki tür bulgu arar:
  1. ASCII'leşmiş Türkçe kelimeler ("egitim" -> "eğitim" olmalı).
     Kullanıcıya görünen stringlerde bozuk Türkçe gerçek bir bug'dır.
  2. UI stringlerine sızmış iç/pedagojik jargon (Bloom, taksonomi vb.).

Çıkış kodu: bulgu varsa 1, temizse 0.
Not: Script sinyal üretir; nihai karar gözden geçirene aittir
(İngilizce tanımlayıcılar false positive verebilir).
"""
import os
import re
import sys

# ASCII'leşmiş hali -> doğru Türkçe hali.
# Sadece Türkçe karakter içermesi GEREKEN yaygın UI kelimeleri.
ASCII_TURKCE = {
    "egitim": "eğitim",
    "ogretim": "öğretim",
    "ogrenci": "öğrenci",
    "ogrenme": "öğrenme",
    "turu": "türü",
    "turleri": "türleri",
    "icerik": "içerik",
    "icerigi": "içeriği",
    "olustur": "oluştur",
    "olusturuldu": "oluşturuldu",
    "yukle": "yükle",
    "yukleniyor": "yükleniyor",
    "guncelle": "güncelle",
    "guncelleme": "güncelleme",
    "duzenle": "düzenle",
    "duzenleme": "düzenleme",
    "basari": "başarı",
    "basarili": "başarılı",
    "basarisiz": "başarısız",
    "sinav": "sınav",
    "sinavi": "sınavı",
    "dogru": "doğru",
    "yanlis": "yanlış",
    "cikis": "çıkış",
    "giris": "giriş",
    "acik": "açık",
    "kapali": "kapalı",
    "ayrinti": "ayrıntı",
    "aciklama": "açıklama",
    "kullanici": "kullanıcı",
    "sifre": "şifre",
    "gorsel": "görsel",
    "goruntule": "görüntüle",
    "sec": "seç",
    "secim": "seçim",
    "secenek": "seçenek",
    "tamamlandi": "tamamlandı",
    "hazirlaniyor": "hazırlanıyor",
    "bekleyiniz": "bekleyiniz",
    "uyari": "uyarı",
    "onemli": "önemli",
    "gonder": "gönder",
    "duzey": "düzey",
    "sure": "süre",
    "suresi": "süresi",
    "unite": "ünite",
    "bolum": "bölüm",
    "soru sayisi": "soru sayısı",
    "sayisi": "sayısı",
}
# tek başına İngilizce ile çakışabilecekleri ele: "sure", "sec" gibi
INGILIZCE_CAKISAN = {"sure", "sec", "turu", "acik"}

# UI'a sızmaması gereken iç/pedagojik jargon.
JARGON = [
    "bloom",
    "taksonomi",
    "karar matrisi",
    "pedagojik",
    "bilişsel düzey",
    "bilissel duzey",
    "kazanım kodu",
]

UZANTILAR = {".ts", ".tsx", ".js", ".jsx", ".vue", ".html", ".json", ".md"}
ATLA_DIZIN = {"node_modules", ".git", "dist", "build", ".next", "out", "coverage"}

STRING_RE = re.compile(r"""(['"`])((?:\\.|(?!\1).)*)\1""")


def dosyalari_topla(yollar):
    for yol in yollar:
        if os.path.isfile(yol):
            yield yol
        elif os.path.isdir(yol):
            for kok, dizinler, dosyalar in os.walk(yol):
                dizinler[:] = [d for d in dizinler if d not in ATLA_DIZIN]
                for d in dosyalar:
                    if os.path.splitext(d)[1] in UZANTILAR:
                        yield os.path.join(kok, d)


def satiri_tara(satir):
    bulgular = []
    # String literal'lerin içine bak; yoksa satırın tamamına bak (html/md).
    parcalar = [m.group(2) for m in STRING_RE.finditer(satir)] or [satir]
    for parca in parcalar:
        kucuk = parca.lower()
        for ascii_hal, dogru_hal in ASCII_TURKCE.items():
            desen = r"\b" + re.escape(ascii_hal) + r"\b"
            if re.search(desen, kucuk):
                # İngilizce ile çakışan kelimelerde: parçada başka Türkçe
                # ipucu (türkçe karakter ya da başka ascii-türkçe kelime)
                # yoksa atla — false positive azaltma.
                if ascii_hal in INGILIZCE_CAKISAN:
                    turkce_ipucu = re.search(r"[çğıöşüÇĞİÖŞÜ]", parca) or any(
                        re.search(r"\b" + re.escape(k) + r"\b", kucuk)
                        for k in ASCII_TURKCE
                        if k != ascii_hal and k not in INGILIZCE_CAKISAN
                    )
                    if not turkce_ipucu:
                        continue
                bulgular.append(("ascii-turkce", ascii_hal, dogru_hal))
        for j in JARGON:
            if j in kucuk:
                bulgular.append(("jargon", j, "UI'dan kaldır / debug loguna taşı"))
    return bulgular


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    toplam = 0
    for dosya in dosyalari_topla(sys.argv[1:]):
        try:
            with open(dosya, encoding="utf-8", errors="replace") as f:
                for no, satir in enumerate(f, 1):
                    for tur, bulunan, oneri in satiri_tara(satir):
                        toplam += 1
                        etiket = "ASCII-TR" if tur == "ascii-turkce" else "JARGON"
                        print(f"{dosya}:{no}: [{etiket}] '{bulunan}' -> {oneri}")
        except OSError as e:
            print(f"{dosya}: okunamadı ({e})", file=sys.stderr)
    if toplam:
        print(f"\nTOPLAM: {toplam} bulgu")
        return 1
    print("TR tarama: temiz")
    return 0


if __name__ == "__main__":
    sys.exit(main())
