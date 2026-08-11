<!-- serif-brain:begin — bu blok 'serif-brain context --claude-md' ile uretilir -->
## Proje hafizasi (serif-brain)

Bu projede kararlarin/bug'larin kaydi `.serif-brain/` altinda tutulur ve kod
grafina baglidir. Once hafizaya bak, sonra kod yaz.

```bash
serif-brain brief                 # neredeyiz: aktif plan/bug/karar + yakalanmamis commit
serif-brain guard <dosya>         # DOKUNMADAN ONCE: o dosyanin kararlari, yara izleri, blast
serif-brain add bug --title "..." --module <X>    # yasanan hata
serif-brain add decision --title "..."            # verilen karar (ihlal edilmeyecek)
serif-brain close <id> --note "nasil cozuldu"
serif-brain capture --days 14     # commit'lerden hafizaya gecmemisleri oner
```

Kurulu ise kapi bunlari kendiliginden yapar (`serif-brain hooks status`).
Aktif isin LISTESI buraya yazilmaz — bayatlar; oturum acilisinda taze gelir.
<!-- serif-brain:end -->
