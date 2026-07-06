---
name: serif-brain-core
description: |
  Bagimsiz proje hafiza, bilgi ag ve graf analiz sistemi. Obsidian, Graphify ve eski
  `.claude/brain` YAML sistemine RUNTIME bagimliligi YOKTUR. `serif-brain` CLI ile
  proje hafizasi yonetilir, kararlar/buglar Markdown object dosyalari olarak tutulur,
  kod grafi ve raporlar derived ciktilar olarak `.serif-brain/` altinda uretilir.

  Trigger: "brain", "context", "ne karar vermistik", "bug kaydet", "karar kaydet",
  "kod grafi", "rapor uret", "saglik kontrolu", "serif-brain"
when_to_use: |
  - Session basinda proje bagliami yuklemek icin: serif-brain context
  - Yeni bug/karar kaydetmek icin: serif-brain add bug | add decision
  - Kod tabanini analiz etmek icin: serif-brain scan code, serif-brain graph build
  - Tum raporlari uretmek icin: serif-brain analyze
  - Sistem sagligini kontrol icin: serif-brain doctor
---

# serif-brain-core

Bu skill **yeni** Serif Brain Core sistemine bagli calisir. Eski `sherif-brain-claude`
skill'i ve eski `.claude/brain/` YAML sistemi runtime'da KULLANILMAZ.

## Mutlak Sinirlar

- ❌ Obsidian vault'a dokunma (sadece migration sirasinda OKUNUR)
- ❌ Graphify output'a dokunma (sadece referans)
- ❌ Eski `.claude/brain/*.yaml` dosyalarina dokunma (Faz 8'e kadar SerifBrainArchive'da)
- ❌ Eski `sherif-brain-claude/` skill'ine dokunma
- ❌ `.claude/settings.json` hooklarini elle degistirme (Faz 8 plan + onayli apply)
- ✅ TEK referans nokta: `.serif-brain/` ve `serif-brain` CLI ciktisi

## Session Basinda

```bash
serif-brain context --project <proje-yolu>
```

Bu komut su 3 dosyayi gunceller (5 saniyenin altinda):

- `.serif-brain/context/CLAUDE.generated.md` — kisa, gorev odakli bagliam
- `.serif-brain/context/compact.json` — makine-okur ozeti
- `.serif-brain/context/active-work.md` — su anki odak listesi

Module bazli dar bagliam:

```bash
serif-brain context --module presentx
```

## Yeni Karar / Bug Kaydetme

```bash
serif-brain add bug \
  --project <path> \
  --title "PresentX seed inconsistency" \
  --module presentx \
  --priority high

serif-brain add decision \
  --project <path> \
  --title "ContentX-PresentX seed unification" \
  --module contentx,presentx \
  --status active \
  --priority critical
```

Default davranis: ID zaten varsa **HATA** verir, alternatif ID onerir.
Overwrite icin `--force` (dikkatli kullan).

## Soru: "Ne karar vermistik?"

```bash
# Tum kararlar
serif-brain analyze
cat .serif-brain/reports/decisions.md

# Tek modul
serif-brain context --module presentx
cat .serif-brain/context/CLAUDE.generated-presentx.md
```

## Kod Tabani Analiz

```bash
serif-brain scan code        # quick walk + ozet
serif-brain graph build      # full graph.json + graph.dot
serif-brain graph report     # 11 mimari analiz
```

Ciktilar:
- `.serif-brain/graph/graph.json`
- `.serif-brain/graph/graph.dot` (GraphViz)
- `.serif-brain/reports/graph-analysis.md`
- `.serif-brain/reports/architecture.md`

## Raporlar (Faz 6)

```bash
serif-brain analyze   # 7 rapor uretir:
```

- `health.md` — sistem sagligi (en ust seviye ozet)
- `bugs.md` — canonical + dry-run preview bugs
- `decisions.md` — canonical + preview decisions
- `architecture.md` — module map + god files + cycles
- `stale-items.md` — 30+ gun aktif kayitlar
- `duplicates.md` — dedup kume detaylari
- `migration-readiness.md` — apply oncesi karar listesi

## Saglik Kontrolu

```bash
serif-brain doctor
```

7 bolum:
1. Runtime & Store Engine (node:sqlite check)
2. Canonical Layout
3. Active Project (object counts)
3b. Object Schema Health (parse / validation / backlinks)
3c. Graph Engine
4. Migration Readiness (archive presence)
5. Legacy Sources (untouched check)
6. Legacy Hooks (Faz 8 input)

## Migration (Henuz Apply Yok)

```bash
serif-brain migrate --dry-run    # SADECE rapor uretir, hicbir sey yazmaz
```

`--apply` Faz 5 onayindan sonra etkin olacak. Su an sadece dry-run.

## Mimari Ilkeler

1. **Canonical:** SQLite (`brain.db`) + Markdown object dosyalari
2. **Derived:** graph/, reports/, context/, indexes/ — silinebilir, regenerate edilir
3. **Frozen archive:** eski 5 sistem `~/SerifBrainArchive/legacy-2026-04-29-230615/` altinda, sadece okunur
4. **Status filtreleri:** `done|closed|completed|rejected|archived` aktif context'e GIRMEZ
5. **Module standardi:** `testlms→testx`, `PresentX→presentx` vb. (config.yaml normalization)
6. **Native:** Obsidian/Graphify yok — bilgi agi ve grafi kendi engine'larimizla

## Hangi Komut Ne Yapar — Hizli Bakis

| Soru | Komut |
|---|---|
| "Aktif bugs?" | `serif-brain context` → CLAUDE.generated.md |
| "Kararlari listele" | `cat .serif-brain/indexes/decision-index.md` |
| "Kod istatistigi" | `serif-brain scan code` |
| "Modul X riskleri" | `serif-brain context --module X` |
| "Apply oncesi durum" | `cat .serif-brain/reports/migration-readiness.md` |
| "Sistem saglikli mi?" | `serif-brain doctor` |

## Asla Yapilmamasi Gerekenler

- Eski `.claude/brain/*.yaml` dosyalarini guncelleme. Faz 5 apply'dan sonra bunlar
  kullanim disi olacak (silinmez, sadece referans).
- Obsidian'a karar/bug yazma. Yeni canonical: `.serif-brain/objects/`.
- `.claude/settings.json` SessionStart hook'unu elle degistirme. Faz 8 ile
  `serif-brain hooks plan` + `apply` ile yapilir.
- Graphify cache'i regenerate etme. Faz 4 native graph engine yeterli.
