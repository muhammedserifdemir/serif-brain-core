#!/usr/bin/env bash
# katalog-tara.sh — diff'i kusur kataloğuna (references/kusur-katalogu.md) karşı tarar.
# Kullanım: katalog-tara.sh [taban-ref]   (varsayılan: HEAD → commit'lenmemiş + staged değişiklik)
#           katalog-tara.sh origin/main    (dalın tamamı)
# Yalnız EKLENEN/DEĞİŞEN satırlara bakar. Çıktı: tetiklenen sınıf, isabet sayısı, ilk örnekler.
# Tetiklenmeyen sınıf "temiz" demek değildir; "Her zaman sor" bölümü yine okunur.
# macOS bash 3.2 uyumlu (ilişkisel dizi yok).

set -u
TABAN="${1:-HEAD}"
git rev-parse --git-dir >/dev/null 2>&1 || { echo "git deposu değil"; exit 2; }

GECICI="$(mktemp -d)"; trap 'rm -rf "$GECICI"' EXIT
EKLENEN="$GECICI/eklenen.txt"    # biçim: dosya:satır:içerik
DOSYALAR="$GECICI/dosyalar.txt"

# Eklenen satırları dosya:satır önekiyle çıkar (taban..çalışma ağacı, staged dahil)
git diff -U0 --no-color "$TABAN" -- . ':(exclude)*.lock' ':(exclude)package-lock.json' ':(exclude)*.min.*' ':(exclude)*.map' 2>/dev/null | awk '
  /^\+\+\+ /{ f=substr($0,7); next }
  /^@@/{ match($0,/\+[0-9]+/); n=substr($0,RSTART+1,RLENGTH-1)+0; next }
  /^\+/{ c=substr($0,2); t=c; sub(/^[ \t]+/,"",t)
         # saf yorum satırları taranmaz (gürültü); kod satırının sonundaki yorum taranır
         if (f!="/dev/null" && t !~ /^(\/\/|\/\*|\*|#|<!--|--)/) print f ":" n ":" c; n++ }
' > "$EKLENEN"
git diff --name-only "$TABAN" 2>/dev/null > "$DOSYALAR"
git ls-files --others --exclude-standard >> "$DOSYALAR"

SATIR=$(wc -l < "$EKLENEN" | tr -d ' ')
DOSYA=$(sort -u "$DOSYALAR" | grep -c . )
echo "KATALOG TARAMASI — taban: $TABAN · değişen dosya: $DOSYA · eklenen satır: $SATIR"
echo "Takip edilmeyen yeni dosyaların İÇERİĞİ taranmaz; varsa önce 'git add -N <dosya>'."
echo

TETIK=0
kural() { # kural <id> <açıklama> <egrep-deseni> [dosya-süzgeci]
  local id="$1" ack="$2" desen="$3" suzgec="${4:-.}"
  local isabet
  isabet=$(grep -E "^[^:]*($suzgec)[^:]*:" "$EKLENEN" 2>/dev/null | grep -iE -- "$desen" 2>/dev/null)
  [ -z "$isabet" ] && return
  local say; say=$(printf '%s\n' "$isabet" | wc -l | tr -d ' ')
  TETIK=$((TETIK+1))
  printf '■ %-4s %-58s (%s)\n' "$id" "$ack" "$say"
  printf '%s\n' "$isabet" | head -3 | cut -c1-150 | sed 's/^/      /'
}
dosya_kural() { # dosya_kural <id> <açıklama> <dosya-deseni>
  local isabet; isabet=$(sort -u "$DOSYALAR" | grep -E -- "$3")
  [ -z "$isabet" ] && return
  TETIK=$((TETIK+1))
  printf '■ %-4s %-58s (%s dosya)\n' "$1" "$2" "$(printf '%s\n' "$isabet" | wc -l | tr -d ' ')"
  printf '%s\n' "$isabet" | head -3 | sed 's/^/      /'
}

UI='\.(tsx|jsx|vue|svelte|html|astro)'
KOD='\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|py|php|swift|kt|go|rb|astro)'

# A. Bağlantı
kural K01 "Yeni etkileşim: dinleyici bağlı mı, gerçekten tıklandı mı?" 'onClick|onSubmit|addEventListener|<button|@click|on:click|\.on\(' "$KOD"
kural K02 "Veri alanı/köprü/aktarma: son yüzeye kadar izlendi mi?" 'serialize|toJSON|bridge|köprü|aktar|payload|exportTo|importFrom' "$KOD"
kural K04 "İstemci çağrısı: sunucuda bu uç var mı?" 'fetch\(|axios|\$http|api/' "$KOD"
kural K06 "Önizleme yolu: gerçek çıktıyla aynı veriyi mi kullanıyor?" 'preview|önizle|onizle' "$KOD"
# B. Doğruluk
kural K10 "Başarı mesajı: sonuç gözlendikten SONRA mı?" 'toast|success|başarı|basari|üretildi|kaydedildi|tamamlandı|saved|generated|completed' "$KOD"
kural K11 "Boyut/ölçek sabiti: bağımlı eşikler güncel mi?" '\b(720|1080|1280|1920|2048|2160|3840|4096)\b|resolution|çözünürlük|devicePixelRatio|scale' "$KOD"
kural K12 "Harf dönüşümü: Türkçe i/İ/ı/I" 'toUpperCase|toLowerCase|\.upper\(|\.lower\(|casefold|capitalize' "$KOD"
kural K13 "Sıralama/arama: TR yerel ve ekli kelime" '\.sort\(|localeCompare|order by|\.includes\(|indexOf\(| like ' "$KOD"
kural K14 "Ayna/işaret/eksen" 'mirror|ayna|flip|negate|\*\s*-1|scaleX\(-1' "$KOD"
kural K16 "Para/tarih/saat dilimi" 'toFixed|parseFloat|new Date|Date\.now|timezone|utc|price|fiyat|amount|tutar|currency|kuruş' "$KOD"
kural K17 "Sayaç/hak/durum: yeni döngüde sıfırlanıyor mu?" 'attempt|deneme|retry|count\+\+|\+= 1|hak|counter' "$KOD"
kural K18 "Taslak/yayın/silinmiş durumu" 'draft|taslak|published|yayın|deleted_at|archived' "$KOD"
# C. Sessiz başarısızlık
kural K20 "Yutulan hata: kullanıcı ne görüyor, log nerede?" 'catch|except|\|\| \[\]|\?\? \[\]|\|\| null|\?\? null|ignore' "$KOD"
kural K21 "Kesilme: uzunluk/sınır/token" 'slice\(|substring|substr\(|truncate|max_?tokens|maxOutputTokens|\.limit\(' "$KOD"
kural K22 "Ağ çağrısı: zaman aşımı gerçekten etkili mi?" 'fetch\(|axios|timeout|AbortController|httpOptions' "$KOD"
kural K23 "Varsayılan değer: ayar yokken ne oluyor?" 'default|varsayılan|\?\? (true|false)|\|\| (true|false)' "$KOD"
kural K24 "switch/eşleme: bilinmeyen değer" 'switch\s*\(|case |match ' "$KOD"
# D. Kiracı, yetki, veri
kural K30 "Sorgu: kiracı koşulu nerede?" 'select |insert |update |delete from|findMany|findFirst|\.from\(|knex|\.where\(|prisma\.' "$KOD"
kural K31 "Yetki: sunucuda da kontrol ediliyor mu?" 'role|admin|permission|yetki|isAdmin|authorize|can\(' "$KOD"
kural K32 "Silme: bağlı kayıtlar ve diriliş" 'delete|remove|destroy|\bsil|cascade' "$KOD"
kural K33 "Eşzamanlılık/çift işlem" 'setInterval|cron|schedule|queue|kuyruk|lock|transaction|claim' "$KOD"
kural K34 "SIR SIZINTISI ŞÜPHESİ" '(api[_-]?key|secret|password|parola)\s*[:=]\s*["'"'"'][^"'"'"']{8,}|BEGIN [A-Z ]*PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}'
kural K35 "Demo/test verisi: yan etkiler (e-posta, koltuk)" 'demo|is_test|seed|fixture' "$KOD"
# E. Arayüz
kural K41 "Renk/opaklık: kontrast token'da mı?" 'color:|#[0-9a-f]{3,8}\b|rgba?\(|opacity' '\.(css|scss|tsx|jsx|vue|svelte|html|astro)'
kural K43 "Sabit Türkçe metin UI'da: i18n anahtarı mı olmalı?" '["'"'"'>`][^"'"'"'<`]*[çğıöşüÇĞİÖŞÜ]' "$UI"
kural K45 "Önbellek" 'cache-control|service.?worker|max-age|immutable|stale' "$KOD"
# F. Yapı/yayın
kural K50 "İkiz mantık işareti" 'SYNC_WITH|keep in sync|senkron|ikiz|duplicate of' "$KOD"
kural K53 "Ortam değişkeni: .env.example + canlı + açılış doğrulaması" 'process\.env|import\.meta\.env|os\.environ|getenv|env\(' "$KOD"
dosya_kural K54 "Hayalet kopya dosya ('X 2.ext')" ' [0-9]+\.[a-z0-9]+$'
dosya_kural K56 "CI/derleme/yayın dosyası değişti: SHA ile yayınla, sırayla" '(^|/)(Dockerfile|docker-compose[^/]*|\.github/workflows/.*|nixpacks\.toml|coolify[^/]*)$'
dosya_kural DEP "Bağımlılık değişti: tek ana sürüm, changelog, audit önce/sonra" '(^|/)(package\.json|requirements[^/]*\.txt|pyproject\.toml|Podfile|Package\.swift|composer\.json|go\.mod)$'
dosya_kural K70 "Şema/migration: geri alma + eski kayıtla test" '(migration|migrations|migrate|schema\.prisma|\.sql$)'
# H. Web ve istemci
kural K70 "Kalıcı biçim/JSON: eski kayıt açılıyor mu?" 'JSON\.parse|schemaVersion|version|sürüm|ALTER TABLE|ADD COLUMN' "$KOD"
kural K71 "Doğrulama: sunucu da reddediyor mu?" 'zod|yup|joi|validate|required|pattern=' "$KOD"
kural K72 "Liste/sorgu: sayfalama ve limit" 'findMany|select .* from|offset|pagination|sayfa' "$KOD"
kural K73 "Yönlendirme/URL durumu: F5, geri tuşu, derin bağlantı" 'router|navigate|useSearchParams|history\.|location\.|searchParams' "$KOD"
kural K74 "Asenkron etki: bayat yanıt yarışı" 'useEffect|debounce|then\(' "$UI"
kural K77 "Temizlenmesi gereken kaynak (sızıntı)" 'setInterval|setTimeout|addEventListener|requestAnimationFrame|subscribe|new Worker' "$KOD"
kural K79 "Dosya yükleme sınırları" 'upload|multipart|FormData|maxFileSize|client_max_body_size' "$KOD"
kural K80 "CSV/Excel/indirme adı" 'csv|xlsx|Content-Disposition|download=' "$KOD"
kural K81 "Sayı/tarih gösterim biçimi" 'toFixed|toISOString|toLocaleString|toLocaleDateString|Intl\.' "$KOD"
kural K91 "CSS: kapsayıcı düğme sıfırlaması dolguyu ezer" '[a-z-]+ button\{[^}]*padding:0' "$KOD"
kural K93 "Node: istek.destroyed akışı keser" 'istek\.destroyed|req\.destroyed' "$KOD"
kural K82 "Log: kişisel veri var mı?" 'console\.(log|info|warn|error)|logger\.|log\.(info|warn|error)|print\(' "$KOD"
kural K83 "E-posta: ulaştı mı, test ortamı gerçek adrese gidiyor mu?" 'sendMail|resend|smtp|nodemailer|mailer|e-?posta' "$KOD"
kural K84 "Webhook: idempotent + imza" 'webhook' "$KOD"

echo
if [ "$TETIK" -eq 0 ]; then
  echo "Tetiklenen sınıf yok. 'Her zaman sor' 5 sorusu yine cevaplanır."
else
  echo "$TETIK sınıf tetiklendi. Her biri için: 'yok (neden)' | 'var → düzeltildi (test)' | 'var → PARK'."
  echo "Ardından kusur-katalogu.md → 'Her zaman sor' (5 soru)."
fi
