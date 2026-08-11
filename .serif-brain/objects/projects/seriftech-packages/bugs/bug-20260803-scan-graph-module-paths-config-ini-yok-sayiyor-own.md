---
id: bug-20260803-scan-graph-module-paths-config-ini-yok-sayiyor-own
type: bug
project: seriftech-packages
module: infra
title: "scan/graph module_paths config'ini yok sayiyor; ownerOf hardcoded"
status: done
priority: high
severity: high
owner: ""
created_at: "2026-08-03T06:05:17.153Z"
updated_at: "2026-08-11T18:23:11.507Z"
source:
  kind: manual
  path: ""
relations:
  files: [src/scanner/module-owner.mjs, src/graph/build.mjs, src/cli/scan-code.mjs]
  decisions: []
  bugs: []
  modules: [infra]
tags: []
summary: "scan code ve graph build config'teki module_paths'i okumuyor; her projede modul atifi 'unknown'a dusuyor"
completed_at: "2026-08-11"
---
# scan/graph module_paths config'ini yok sayiyor; ownerOf hardcoded

## Etki

`src/scanner/module-owner.mjs` iki fonksiyon sunuyor:

- `ownerOf(relPath)` — HARDCODED kural listesi (satir 4-37). Liste
  SerifX360'in klasor duzenine ozel: `apps/contentx/`, `apps/presentx/`,
  `apps/animation-studio/` ...
- `ownerOfConfigured(relPath, config)` — once `config.module_paths`'e bakar,
  bulamazsa `ownerOf`'a duser (satir 55-66)

Ama iki ana uretim yolu YANLIS olani cagiriyor:

    src/graph/build.mjs:49   modules.add(ownerOf(f.rel_path))
    src/graph/build.mjs:91   module: ownerOf(f.rel_path)
    src/graph/build.mjs:99   addEdge(nid("module", ownerOf(...)), ...)
    src/cli/scan-code.mjs:24 moduleStats(files)   -> icinde ownerOf

`moduleStats` (module-owner.mjs:68-78) da `ownerOf` kullaniyor.

Sonuc: SerifX360 disindaki HER projede `module_paths` yazilsa bile grafta
her dosya `unknown` modulune baglaniyor. Modul dugumu, `owns` kenari ve
"Etkilenen moduller" ciktisi anlamsizlasiyor.

Daha kotusu, hata config-farkinda araclara da siziyor: `src/cli/impact.mjs:41`
`node.module || ownerOfConfigured(relPath, config)` yaziyor. `node.module`
graftan gelir ve `"unknown"` degeri TRUTHY oldugu icin fallback hic
calismaz — config dogru olsa bile impact "modul:unknown" der.

## Reproduce

GameX brain'inde (`~/Documents/GameX/.serif-brain`) dogrulandi:

1. `config.yaml` -> `module_paths` icine `"packages/games/": games` eklendi.
2. `serif-brain scan code` -> "Module breakdown: unknown 95, infra 7".
   Eklenen esleme hic gorunmedi.
3. `serif-brain graph build` sonrasi graf dugumu:
   `file:packages/games/balloon-hunt/builder.mjs -> module: unknown`
4. Graf modul dugumleri: build, docs, engine, infra, lms, model, studio,
   unknown — config'teki `games`/`dashboard`/`generator`/`library` YOK.
5. `serif-brain impact packages/games/balloon-hunt/builder.mjs`
   -> "modul:unknown", "Etkilenen moduller: infra"

`scripts/` yolu `infra` cikiyor cunku o, hardcoded listede var (satir 35) —
config'ten degil, tesadufen.

## Beklenen

`graph build` ve `scan code`, brain'in kendi `config.yaml`'indaki
`module_paths` eslemesini kullanmali. GameX icin beklenen dagilim:
games / dashboard / generator / library / player-ui / studio / model /
compiler / build / docs.

## Gozlemlenen

Her ikisi de hardcoded SerifX360 haritasini kullaniyor; config yok sayiliyor.
`ownerOfConfigured` yalniz touch/impact/risk/guard/capture/mcp yollarinda
cagriliyor — ve impact'te de `node.module` onceligi yuzunden etkisiz kaliyor.

## Hipotez / Analiz

Yorum satiri bunu zaten itiraf ediyor (module-owner.mjs:52):
"(yorumda vaat edilmis ama implement edilmemisti)". Yani `ownerOfConfigured`
sonradan eklenmis, mevcut cagri yerleri gecirilmemis. Yorum "Mevcut ownerOf'a
dokunmaz (graph build aynen calisir)" diyor — o an bilincli bir geri-uyumluluk
karariymis, ama graph build'in DOGRU sonuc uretmesi gerektigi gozden kacmis.

Bu, kendi kaydimizdaki desenin tekrari: tek kaynak olmasi gereken bir karar
iki yerde yasiyor. Bkz. [[decision-20260730-siralama-esitlikte-karar-verilmiyordu]]
(`src/util/rank.mjs` tek kaynak yapilmisti).

## Ek gozlem — bu kaydin kendisi

`serif-brain add bug` bu objeyi once `objects/projects/serif-platform/` altina
yazdi, cunku config'te `projects[0].id = serif-platform` (paket kendi brain'ini
SerifX360 config'inden kopyalamis). Elle `seriftech-packages/` altina tasindi.
`--module scanner` de "unknown module" uyarisi verdi; `infra` yapildi.

Yani `add` komutu aktif proje secimini ve modul dogrulamasini config'ten
aliyor ama YANLIS varsayilanla — ayri, kucuk bir kayit konusu.

## Next Action

1. `graph/build.mjs` ve `cli/scan-code.mjs` -> `ownerOfConfigured(path, config)`;
   `moduleStats` config parametresi almali.
2. `impact.mjs:41` -> `node.module` "unknown" ise fallback'e dussun
   (`node.module && node.module !== "unknown" ? ... : ownerOfConfigured(...)`)
   ya da graf dogru uretildikten sonra bu satir zaten sadelesir.
3. Kapi: module_paths tanimli bir fixture brain'de `graph build` sonrasi
   modul dugum kumesi config'teki modullerle ESLESMELI. Bugun boyle bir test
   yok — hardcoded harita hic dogrulanmiyor.
4. Hardcoded RULES tamamen silinmemeli (config'siz eski brain'ler icin
   fallback), ama artik SON care olmali.

## Cozum (2026-08-11 — kapandi)

Uc maddenin ucu de kapandi; kayit 8 gun boyunca `open` durdugu icin `brief`
her oturumda BU kaydi "tek aktif yuksek bug" diye gosteriyordu — birinci
maddesi 4 Agustos'ta zaten duzelmisti. Kayit bayat kaldigi surece yeni oturum
yanlis ise bakar; kapanis da duzeltmenin parcasidir.

1. **(9475233, 4 Agustos)** `graph/build.mjs` icinde config-farkinda yerel
   `ownerOf` sarmalayicisi; `cli/scan-code.mjs` + `moduleStats(files, config)`
   ayni sekilde. `markdown/yaml.mjs` tirnakli anahtarin tirnagini soyuyor
   (anahtari VERI olan haritalarda sessiz hataydi).

2. **(bu tur)** `impact` + MCP `brain_impact` -> yeni
   `resolveModule(nodeModule, relPath, config)` (`scanner/module-owner.mjs`).
   Kural: graf yalnizca BILINEN bir modul soyluyorsa kazanir. Ek olarak,
   ekranda gorunen `modul:` satiri `computeImpact`'in HAM degerinden geliyordu
   — ilk duzeltme yalnizca hafiza aramasini duzeltmisti, kullanicinin gordugu
   satir hala "unknown" diyordu. Birlestirme artik CLI/MCP katmaninda;
   `query/impact.mjs` saf kaldi.

3. **(bu tur)** Kapi: `test/module-paths-kapi.test.mjs` (10 test) —
   `buildGraph` config'teki `module_paths`'i graf dugumune yansitiyor mu,
   uzun prefix kazaniyor mu, configsiz projede eski davranis duruyor mu,
   bayat grafta `impact --json` config'teki modulu donduruyor mu.

**Ek gozlemin karsiligi:** kaydin "bu kaydin kendisi" bolumu, `add`'in objeyi
yanlis projeye yazdigini soyluyordu. Kok neden bulundu ve duzeltildi: bu
paketin KENDI `.serif-brain/config.yaml`'i 2026-05-08'de init'in eski
surumuyle kurulmustu — `projects[0].id = serif-platform` (0 obje, `active:true`)
iken 8 objenin hepsi `seriftech-packages` altindaydi; `valid_modules` da
SerifX360'in uygulama isimleriydi (contentx/presentx/...), bu yuzden 8 objenin
hepsi `infra`ya dusmustu. Config projenin kendi yapisina gore yeniden yazildi
+ `module_paths` eklendi. Olcum: kendi grafinda `unknown` modul **131 -> 0**,
13 gercek modul dogdu.

Ders (tekrarlayan desen, ucuncu kez): **bir kural yaziliyor ama uretim yolu onu
cagirmiyorsa, yazan kisi hicbir hata gormez.** Bkz.
[[decision-20260730-siralama-esitlikte-karar-verilmiyordu]] — orada da dogru
karsilastirici vardi, 7 cagri yerinden 2'si kullaniyordu.

## Tamamlanma (2026-08-11)

module_paths uc maddede de kapandi: uretim yollari config'i okuyor + resolveModule tek karar noktasi + module-paths-kapi.test.mjs (10 test). Paketin kendi config'i de duzeltildi: unknown modul 131->0
