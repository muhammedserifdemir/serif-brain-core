#!/usr/bin/env python3
"""
TR tarama — kullanıcıya görünen metinlerde iki sorunu arar.

NEDEN: Türkçe karakter bozulması kozmetik değil, gerçek bir bug'dır — kullanıcı
"egitim turu" gören bir ekranı ciddiye almaz. İç jargon (Bloom, taksonomi, IR,
variant) ise debug log'unda kalmalı; kullanıcıya görünen metin sıcak ve jargonsuz
olmalı.

BU SCRIPT SİNYAL ÜRETİR, KARAR SENİNDİR. İngilizce kod tanımlayıcıları ve teknik
dosyalar yanlış-pozitif verebilir — bulguyu değerlendir, körlemesine düzeltme.

Kullanım:
    python3 tr_tarama.py <dosya|dizin> [<dosya|dizin> ...]
    python3 tr_tarama.py --jargon-off <dosya>     # yalnız karakter taraması

Çıkış kodu: bulgu varsa 1, temizse 0.
"""
import os
import re
import sys

# ── 1. Mojibake: UTF-8 metnin latin-1 gibi okunmasından doğan imzalar ──────────
# 'ğ' → 'Ä\x9f', 'ş' → 'Å\x9f', 'ı' → 'Ä±', 'ü' → 'Ã¼' ...
MOJIBAKE = re.compile(r'Ã[\x80-\xbf¤§©«¬±¶º»¼½¾]|Å[\x9f\x9e\xb0\xb1]|Ä[±°\x9f\x9e]|â€™|â€œ|â€\x9d')

# ── 2. ASCII'leşmiş Türkçe: diakritiği düşmüş yüksek-frekanslı kelimeler ──────
# Yalnız diakritiksiz hali ANLAMSIZ veya yanlış olan kelimeler listelenir.
# (ör. "kar" meşru bir kelime, listeye girmez; "egitim" değildir.)
ASCII_TR = {
    'egitim': 'eğitim', 'ogrenci': 'öğrenci', 'ogretmen': 'öğretmen',
    'ogrenme': 'öğrenme', 'icerik': 'içerik', 'baslik': 'başlık',
    'aciklama': 'açıklama', 'secenek': 'seçenek', 'soru': None,
    'yanlis': 'yanlış', 'dogru': 'doğru', 'basari': 'başarı',
    'kullanici': 'kullanıcı', 'ayarlar': None, 'guncelle': 'güncelle',
    'sil': None, 'duzenle': 'düzenle', 'olustur': 'oluştur',
    'kaydet': None, 'yukle': 'yükle', 'indir': None, 'goruntule': 'görüntüle',
    'sunum': None, 'slayt': None, 'turu': 'türü', 'tur': None,
    'sure': 'süre', 'gunluk': 'günlük', 'ozet': 'özet', 'rapor': None,
    'bolum': 'bölüm', 'onizleme': 'önizleme', 'cikti': 'çıktı',
    'gorsel': 'görsel', 'metin': None, 'duzen': 'düzen', 'sablon': 'şablon',
    'calisma': 'çalışma', 'degerlendirme': 'değerlendirme', 'olcut': 'ölçüt',
    'gecerli': 'geçerli', 'gecersiz': 'geçersiz', 'zorunlu': None,
    'sifre': 'şifre', 'giris': 'giriş', 'cikis': 'çıkış', 'hesap': None,
    'baglanti': 'bağlantı', 'yukleniyor': 'yükleniyor', 'bekleyin': None,
    'tamamlandi': 'tamamlandı', 'basarili': 'başarılı', 'basarisiz': 'başarısız',
}
ASCII_TR = {k: v for k, v in ASCII_TR.items() if v}  # düzeltmesi olanlar

# ── 3. UI'a sızmaması gereken iç/pedagojik jargon ─────────────────────────────
# Uzun terimler: büyük/küçük harf duyarsız, kelime sınırıyla.
JARGON = [
    'bloom', 'taksonomi', 'taxonomy', 'karar matrisi', 'heuristic', 'heuristik',
    'variant', 'varyant', 'compiler', 'pipeline', 'payload', 'schema',
    'contract', 'fallback', 'deprecated', 'legacy', 'refactor', 'mutasyon',
    'idempotent', 'seed', 'hash', 'token', 'prompt',
]
# Kısa BÜYÜK HARF kısaltmalar: harf duyarlı olmalı, yoksa Türkçe kelime
# sonlarına takılır ("içerir" içinde "ir", "yoluna" içinde "ir" gibi).
JARGON_KISALTMA = ['IR', 'IPC', 'DTO', 'ORM', 'AST', 'CTA']

# Kullanıcıya görünen metin adayları: tırnak içi, 3+ karakter, en az bir boşluk
# veya Türkçe harf içeren. (Tek kelimelik İngilizce tanımlayıcıları eler.)
STRING_RE = re.compile(r'''(['"`])((?:(?!\1)[^\\]|\\.){3,}?)\1''')

SKIP_DIRS = {'node_modules', '.git', 'dist', 'build', '__pycache__', '.next',
             'coverage', '.serif-brain', 'backups', 'worktrees'}
SCAN_EXT = {'.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.html', '.json', '.md'}


def dosyalari_topla(hedefler):
    for h in hedefler:
        if os.path.isfile(h):
            yield h
        elif os.path.isdir(h):
            for kok, dizinler, dosyalar in os.walk(h):
                dizinler[:] = [d for d in dizinler if d not in SKIP_DIRS]
                for d in dosyalar:
                    if os.path.splitext(d)[1] in SCAN_EXT:
                        yield os.path.join(kok, d)


def tara(yol, jargon_ac=True):
    bulgular = []
    try:
        with open(yol, 'r', encoding='utf-8', errors='replace') as f:
            satirlar = f.readlines()
    except OSError:
        return bulgular

    for no, satir in enumerate(satirlar, 1):
        if MOJIBAKE.search(satir):
            bulgular.append((no, 'MOJIBAKE', satir.strip()[:100]))

        for _, icerik in STRING_RE.findall(satir):
            # Kullanıcıya görünme ihtimali düşük olanları ele: yol, url, import
            if '/' in icerik or '://' in icerik or icerik.startswith('@'):
                continue
            dusuk = icerik.lower()

            for ascii_kelime, dogrusu in ASCII_TR.items():
                if re.search(r'\b' + ascii_kelime + r'\b', dusuk):
                    # Aynı string'de diakritikli hali de varsa muhtemelen kasıtlı
                    if dogrusu.lower() in dusuk:
                        continue
                    bulgular.append((no, 'ASCII-TR',
                                     f'"{icerik[:60]}" → "{ascii_kelime}" yerine "{dogrusu}"?'))
                    break

            if jargon_ac and (' ' in icerik or len(icerik) > 12):
                vuruldu = None
                for j in JARGON:
                    if re.search(r'\b' + re.escape(j) + r'\b', dusuk):
                        vuruldu = j
                        break
                if not vuruldu:
                    for k in JARGON_KISALTMA:
                        # harf duyarlı + kelime sınırı: "IR" evet, "içerir" hayır
                        if re.search(r'\b' + re.escape(k) + r'\b', icerik):
                            vuruldu = k
                            break
                if vuruldu:
                    bulgular.append((no, 'JARGON', f'"{icerik[:60]}" içinde "{vuruldu}"'))
    return bulgular


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    jargon_ac = '--jargon-off' not in sys.argv
    if not args:
        print(__doc__)
        return 0

    toplam = 0
    for yol in dosyalari_topla(args):
        bulgular = tara(yol, jargon_ac)
        if bulgular:
            print(f'\n{yol}')
            for no, tur, mesaj in bulgular:
                print(f'  {no}: [{tur}] {mesaj}')
            toplam += len(bulgular)

    if toplam:
        print(f'\n{toplam} sinyal. Bunlar SİNYALDİR, hüküm değil — '
              f'İngilizce tanımlayıcılar ve teknik metinler yanlış-pozitif olabilir. '
              f'Gerçek bulguysa düzelt ve doğrulama zincirini 2. adımdan tekrar işlet.')
        return 1

    print('TR tarama: temiz')
    return 0


if __name__ == '__main__':
    sys.exit(main())
