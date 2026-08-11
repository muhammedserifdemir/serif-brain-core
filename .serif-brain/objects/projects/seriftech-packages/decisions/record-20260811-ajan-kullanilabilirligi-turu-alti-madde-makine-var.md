---
id: record-20260811-ajan-kullanilabilirligi-turu-alti-madde-makine-var
type: record
project: seriftech-packages
module: infra
title: "Ajan-kullanilabilirligi turu: alti madde, makine vardi tetikleyicisi yoktu"
status: done
priority: low
created_at: "2026-08-11T18:57:37.704Z"
updated_at: "2026-08-11T18:57:37.704Z"
source:
  kind: manual
  path: ""
relations:
  files: []
  decisions: []
  bugs: []
  modules: [infra]
tags: []
---
# Ajan-kullanilabilirligi turu: alti madde, makine vardi tetikleyicisi yoktu

## Ne yapildi

Alti maddelik tur — hepsinin kok nedeni ayni: **makine vardi, tetikleyicisi yoktu.**

1. Kapi KURULUYOR (`hooks status|install`, init otomatik, doctor raporlar)
2. Hafizaya gecmemis commit'ler GORUNUYOR (brief + Stop kapisi) — bkz.
   [[decision-20260811-kapi-yazmaz-atlanani-gorunur-kilar-otomatik-churn-]]
3. MCP YAZIYOR: brain_add + brain_close (14 okuma -> 16 arac)
4. `close <id>` bos proje dizini yuzunden proje sormuyor artik
5. Oturum acilisi SessionStart hook'undan (dosya bayatlamaz) + kok CLAUDE.md isareti
6. "Son bakisimdan beri" (.cache/last-seen.json, yalniz --stamp ile ilerler)

## Neden

Arac kendi vaadini karsilamiyordu: `claude-gate.mjs` paketteydi ama hicbir sey
onu settings.json'a baglamiyordu — KENDI reposunda bile. Kurulmayan kapi kapi
degildir; ajan `guard` calistirmayi hatirlamak zorunda kalir ve hatirlamaya
dayali disiplin disiplin degildir.

Ayni desen dort ayri yerde tekrarladi: capture (tetikleyicisiz), MCP yazma
(hic yok), CLAUDE.generated.md (ureteni var okuyani yok), last-seen (hic yok).

## Sonuc / Kanit

- Test: 259 -> 281 (yeni: kapi-kurulum 14, yazma-ve-id-cozumleme 11,
  son-bakistan-beri 7, module-paths-kapi 10)
- doctor: HEALTHY (0 hata, 0 uyari); Kapi (Session/Pre/Post/Stop) 4/4 kurulu
- Hafiza: 8 -> 17 obje. `touch src/cli/review.mjs` oncesinde BOS donerken artik
  3 yara izi gosteriyor.
- Kendi grafinda `unknown` modul 131 -> 0 (config projenin kendi yapisina gore
  yeniden yazildi; eskiden SerifX360'in config'inin kopyasiydi)
- Yazarken cikan 3 gercek bug (tahminle degil, test yazilirken): MCP'de config
  yuklenmeden yazma cokmesi, obje cache'inin yazani gormemesi, `record-` id
  onekinin hicbir yerde tanimli olmamasi.

## Acik kalan

- `schema.mjs` validateObject: config'te `valid_status` yoksa TypeError atiyor
  (eksik anahtar anlamli hata yerine cokme uretiyor)
