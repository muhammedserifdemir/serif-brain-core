# Windows Kurulumu

Amac: kodu Windows'ta duzenlemeden, `serif-brain` CLI'yi ve Claude Code skill'ini
kullanmak. Kaynak dogrulugu her zaman GitHub'daki private repo'dur; gelistirme
Mac'te yapilir, Windows sadece ceker.

## On Kosullar

- **Node.js >= 22.5** (store engine `node:sqlite` kullanir; LTS 22 veya 24 uygun)
- **Git for Windows** (`git` PATH'te olmali — `git-activity` sorgulari icin de gerekli)
- GitHub hesabinda oturum: `gh auth login` veya `git` credential manager
  (repo private oldugu icin clone/pull kimlik dogrulamasi ister)

## Kurulum (klonsuz, onerilen)

```powershell
npm i -g git+https://github.com/muhammedserifdemir/serif-brain-core.git
serif-brain doctor
```

`npm i -g` calistiginda `serif-brain` komutu global PATH'e girer (npm .cmd shim
uretir), tam yol yazmaya gerek kalmaz.

## Guncelleme

> ### ⚠ OTOMATIK GUNCELLEME YOKTUR
>
> `npm i -g git+...` bir **kopya** cikarir. Mac'te yapilan degisiklikler bu
> kopyaya KENDILIGINDEN gecmez; bildirim de gelmez.
>
> Gercek olay (2026-08-12): sahibi Mac'te `--version` calistirip guncel surumu
> gordu ve "otomatik gidiyor" sandi — oysa kendi KAYNAK dizinini okuyordu.
> Windows'taki kopya iki ay (41 commit) geride duruyordu ve o surumde
> **Windows'ta modul eslemesi tamamen bozuktu** (her dosya `unknown` moduline
> dusuyordu, hicbir hata vermeden).
>
> Hangi kopyayi calistirdigini gormek icin:
> ```powershell
> serif-brain --version    # surum + KURULUM TURU + guncelleme komutu basar
> ```

Mac'te `git push` yapildiktan sonra Windows'ta ayni komutu tekrar calistir:

```powershell
npm i -g git+https://github.com/muhammedserifdemir/serif-brain-core.git
serif-brain --version   # yeni surumu gormeli
serif-brain doctor      # "0. Calisan Kopya" bolumu hangi kopya oldugunu yazar
```

npm bazen onbellekten kurar; surum degismediyse:
```powershell
npm cache clean --force
npm i -g git+https://github.com/muhammedserifdemir/serif-brain-core.git
```

## Claude Code Skill

Skill dosyasi repoda `skill/serif-brain-core/SKILL.md` olarak durur.
Windows'ta su konuma kopyala:

```powershell
mkdir $env:USERPROFILE\.claude\skills\serif-brain-core -Force
npm root -g   # global node_modules yolunu gosterir
copy <global-node_modules>\serif-brain-core\skill\serif-brain-core\SKILL.md $env:USERPROFILE\.claude\skills\serif-brain-core\SKILL.md
```

(Yol tek satirda: `copy "$(npm root -g)\serif-brain-core\skill\serif-brain-core\SKILL.md" "$env:USERPROFILE\.claude\skills\serif-brain-core\SKILL.md"`)

## Bilinen Windows Notlari

- `serif-brain doctor` icindeki goc bolumleri (eski sistemden aktarim) artik
  YALNIZCA config'inde `legacy_sources` bulunan brain'lerde gosterilir. Yeni
  kurulan bir projede o bolumler hic cikmaz — eskiden paket yazarinin Mac
  yollarini denetleyip yabanci makinede kirmizi ✗ uretiyordu.
- Proje hafizalari (`.serif-brain/` klasorleri) bu paketin PARCASI DEGILDIR;
  her projenin kendi reposuyla gelir. Windows'ta yeni proje icin `serif-brain init`.
- Dashboard ciktisi varsayilan olarak `%USERPROFILE%\Desktop\serif-brain-dashboard.html`
  konumuna yazilir (`SERIF_BRAIN_DASHBOARD_OUT` env ile degistirilebilir).
