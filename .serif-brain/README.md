# .serif-brain — Serif Brain Core canonical store

Bu klasor proje hafizasinin TEK gercek kaynagidir. Eski Obsidian/Graphify/eski
`.claude/brain` YAML sistemine runtime bagimliligi YOKTUR.

## Yapi

- `config.yaml` — sema versiyonu, gecerli modul/status/priority listeleri
- `objects/projects/<project>/` — canonical Markdown object dosyalari
  - `bugs/`, `decisions/`, `notes/`, `modules/`, `sessions/`, `sprints/`
- `brain.db` — SQLite (veya `objects-jsonl/` JSONL fallback)
- `graph/` — derived: `graph.json`, `graph.dot`
- `reports/` — derived: health/bugs/decisions/architecture/context-pollution/...
- `context/` — derived: Claude context dosyalari
- `indexes/` — derived: project/module/bug/decision/tag/backlink indexleri
- `archive-index/` — legacy migration manifest ve audit raporu

## Komutlar

```
serif-brain doctor              # sistem sagligi
serif-brain ingest legacy --dry-run
serif-brain migrate --dry-run
serif-brain scan code
serif-brain analyze
serif-brain context
```

## Notlar

- Derived veri (`graph/`, `reports/`, `context/`, `indexes/`) silinebilir;
  `serif-brain analyze` ile yeniden uretilir.
- `done`, `rejected`, `archived` kayitlar Claude aktif context'ine girmez.
- Eski Obsidian vault sadece migration kaynagidir — runtime'da okunmaz.
