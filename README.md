# serif-brain

[![CI](https://github.com/muhammedserifdemir/serif-brain-core/actions/workflows/ci.yml/badge.svg)](https://github.com/muhammedserifdemir/serif-brain-core/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.5-brightgreen.svg)](package.json)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

**Your AI agent starts from zero every session.** It doesn't know why you made
that decision last month, which bug left a scar in which file, or what was
deliberately built that way. serif-brain writes your project's memory to the
filesystem, links it to the code graph, and turns it into **mechanical gates
that fire at edit time**.

> Advice can be skipped. A gate cannot.

Pure Node.js, **zero npm dependencies** (Node ≥ 22.5 — `node:sqlite` + the
native test runner). 358 tests. The data is plain Markdown: readable with
`git diff`, editable by hand, tied to no service.

🇹🇷 [Türkçe README](README.tr.md) · 📖 [First 15 minutes](docs/BASLANGIC.md) (Turkish)

---

## Why

If a rule is written but the production path never calls it, **the person who
wrote it sees no error at all.** Two examples from this project's own history:

- `.sort((a, b) => pri(a) - pri(b))` — in a list where everything is
  `critical` this always returns `0`; a stable sort then preserves input order,
  so **the oldest record floats to the top**. It looked right. It only failed
  on real data.
- `node.module || ownerOfConfigured(path, config)` — the graph writes
  `"unknown"` for unmatched files, and **`"unknown"` is truthy**, so the
  fallback never ran. Whoever wrote the correct config rule saw no warning.

Both belong to the class *"there was evidence, but the wrong thing was
measured."* serif-brain exists to catch exactly that class: it records the
decision, links it to code, and puts it in front of you **before** you touch
that file again — without you asking.

---

## Does it actually work?

Measured against 20 real projects, 1,179 records, real git history — not
synthetic fixtures. Full method and scope labels in
[`docs/OLCUM.md`](docs/OLCUM.md).

| Question | Result |
|---|---|
| When a bug happened, did memory already hold something about that file? | **80.5%** |
| Same question for a **random** file (control) | **14.3%** |
| **Signal-to-noise** | **5.6×** |
| Files where the gate has something specific to say | 15.6% |
| Files where it stays silent | 78.3% |
| Memory coverage over tracked files | 5.8% |
| Import-graph edges verified against source (3 projects, 25 samples each) | **75/75** |
| Latency added per edit | ~0.4 s |

The honest reading: **the gate is silent most of the time, and that is the
main weakness** — memory only exists where you wrote it. But where it does
speak, the signal is 5.6× above chance. The tool doesn't create value on its
own; it creates value when you link a record to a file.

> Scope label: the 80.5% covers *recorded, file-linked* bugs only. Bugs that
> were never written down are outside this measurement. So "prevents 80% of
> bugs" would be false; "where records exist, memory held the relevant fact
> 80% of the time" is what was measured.

---

## Install

```bash
npm i -g git+https://github.com/muhammedserifdemir/serif-brain-core.git
# or run without installing:
npx github:muhammedserifdemir/serif-brain-core --help
```

In your project:

```bash
serif-brain init     # .serif-brain/ + Claude skills + THE GATE + CLAUDE.md marker
serif-brain doctor   # health: schema, graph, is the gate wired
```

`init` installs three things at once: the memory structure, the working-discipline
skills, and the Claude Code gate. **A gate that isn't installed isn't a gate.**

---

## Daily loop

```bash
serif-brain brief                    # where are we + what changed since I last looked
serif-brain guard src/auth/login.ts  # BEFORE touching: decisions, scars, blast radius, risk
# ... write code ...
serif-brain review                   # before commit: layer violations, cycles, bug signatures
serif-brain add bug --title "..." --files src/auth/login.ts
serif-brain close bug-2026... --note "how it was fixed"
serif-brain capture --days 14        # propose records from commits you never wrote down
```

With the gate installed, `brief` / `guard` / `review` run **by themselves** —
at session start, before and after every edit, and before the agent says "done".

---

## The gate

| Event | What it does | Silence contract |
|---|---|---|
| `SessionStart` | active plan/bugs/decisions + what changed since last look | silent if memory is empty |
| `PreToolUse` (Edit/Write) | that file's decisions, scars, signature hits, blast radius | silent if the file is clean |
| `PostToolUse` | layer violation / cycle / god-file | silent if nothing is wrong |
| `Stop` | findings in changed files + **coverage label** | silent if clean and fully covered |

```bash
serif-brain hooks status          # is it installed / stale
serif-brain hooks test [<file>]   # ACTUALLY fire it: what does it say + error log
serif-brain hooks install --apply
```

`status` answers *"is it installed"*. `test` answers **"is it working"** —
different questions. This gate once stayed silent *precisely when it found
problems*, for months, and nobody could see it: the commands it calls exit
non-zero **when they find something** (they're pre-commit gates), and the
wrapper treated any non-zero exit as failure. It now logs instead of
swallowing (`.serif-brain/.cache/gate.log`), and `doctor` reports it.

Two rules the gate learned the hard way:

- **If there's nothing to say, say nothing.** Fixed text on every edit becomes
  unreadable within a day and zeroes out the gate's value.
- **Don't say the same thing twice.** A Stop hook that repeats itself makes the
  agent respond, try to stop, get the same message… forever. This actually
  happened.

**Coverage labels:** "I found no problem" and "I looked for no problem" are
different statements. A file that couldn't be checked is not a file that was
checked and came out clean. `guard` has three verdicts: `DIKKAT` (something to
know), `TEMIZ` (records exist, no risk here), `KAYIT YOK` (nothing is known
about this file — *not* the same as "no risk").

---

## Language support

The scanner **indexes every language**; but "import graph" doesn't mean the
same thing in every language.

| Language | Status |
|---|---|
| JS/TS, JSX/TSX, Vue, Svelte, Astro | **import graph** — file→file edges |
| Python (`.py`, `.pyi`) | **import graph** — relative (`from .x`) + package paths |
| PHP, Ruby | **import graph** — `require`/`include` paths |
| Swift, C#, Java, Kotlin, Go, Rust, Dart, Obj-C | **indexed, no import graph** |

That last row is deliberate. In Swift/C#/Java, files inside the same module
**don't import each other** — they're all visible. Emitting file-to-file edges
there would be fabrication, and it would produce a dangerous line:
*"leaf file — nobody imports this, safe to change."* Those files still get
module attribution, risk scoring, memory links, and signature scanning; only
blast radius is missing — and `scan code` says so explicitly.

Each ecosystem's dependency directories are excluded (`venv`, `Pods`, `vendor`,
`target`, `node_modules`…). Ambiguous names like `bin`/`obj`/`packages`/`Library`
are skipped **only when there's evidence** of that ecosystem — `packages/` is
source in a JS monorepo, output in .NET.

---

## Commands

**Memory**

| | |
|---|---|
| `init` / `doctor` / `validate` | set up · health · validate against schema |
| `add bug\|decision\|plan\|record` | write a record (`record` is born `done`) |
| `close <id> --note` | close it (no project flag needed when the id is unique) |
| `search` / `related` / `brief` | search · automatic relation discovery · session summary |
| `capture --days N [--apply]` | candidate records from commits |
| `relink [--apply]` | repair links broken by file moves (git renames only, no guessing) |
| `stale` / `prune` / `sync-commits` | scan stale · archive safely · `Brain-Closes:` trailer |

**Code ↔ memory**

| | |
|---|---|
| `guard <file>` | **combined pre-edit briefing** (touch + impact + risk + lint in one call) |
| `touch` / `impact` / `risk` | file memory · blast radius · risk score |
| `hotspot` / `cluster` | churn × centrality danger zones · likely same-root-cause clusters |
| `layers` / `check` / `lint` / `review` | layer violations · graph health · bug signatures · pre-commit gate |
| `scan code` / `graph build\|report\|viewer` | scanner · code graph + 11 architectural findings + HTML viewer |
| `analyze` / `context` | all reports · Claude context |

**Integration**

| | |
|---|---|
| `mcp` | MCP server — 16 tools (14 read + `brain_add` / `brain_close`) |
| `hooks status\|test\|install` | Claude Code gate |
| `skills status\|update` | bundled discipline skills |
| `dashboard` | multi-brain admin panel (live + static HTML) |

---

## Configuration

`.serif-brain/config.yaml` — all optional; `init` derives sensible defaults
from your directory structure:

```yaml
module_paths:            # file path → module (longest prefix wins)
  "src/auth/": auth
layer_rules:             # architectural rule; exit 2 on violation
  - { from: ui, to: db, reason: "use the service layer" }
bug_signatures:          # the shape of past bugs (regex)
  - { name: missing-await, pattern: "(?<!await )db\\.(query|exec)\\(", message: "await missing?" }
capture_reminder: true   # remind about commits not yet in memory
```

---

## Architecture

```
src/
  cli/        command router + each command (thin wrappers)
  markdown/   object model, YAML parser/serializer, schema, write ops
  scanner/    file scan, language definitions, import resolution, module ownership
  graph/      graph build, 11-finding analysis, HTML viewer
  query/      search/guard/impact/risk core (SHARED by CLI and MCP)
  mcp/        MCP server (pure-Node JSON-RPC)
  hooks/      gate installation
  dashboard/  multi-brain panel
```

Canonical data lives in
`.serif-brain/objects/projects/<project>/<type>s/<id>.md` (Markdown + YAML
frontmatter). Indexes, graph and reports are **derived** and not versioned.

Design rule: **the same computation never lives in two places.** CLI and MCP
call the same core — a second copy means silent divergence of the
"it worked in the CLI but wrote something else through MCP" kind.

---

## Docs

- [docs/BASLANGIC.md](docs/BASLANGIC.md) — first 15 minutes (Turkish)
- [docs/OLCUM.md](docs/OLCUM.md) — how the numbers above were measured
- [docs/USAGE.md](docs/USAGE.md) — session loop, multi-agent, command reflexes (Turkish)
- [docs/MCP.md](docs/MCP.md) — `.mcp.json` setup and test recipe (Turkish)
- [docs/WINDOWS.md](docs/WINDOWS.md) — Windows install (Turkish)
- [CONTRIBUTING.md](CONTRIBUTING.md) · [CHANGELOG.md](CHANGELOG.md) · [ROADMAP.md](ROADMAP.md)

Most docs are Turkish today. English translations are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Development

```bash
npm test        # node --test "test/*.test.mjs" — zero dependencies
```

## License

MIT — © 2026 Muhammed Serif Demir. `private: true` in `package.json` is
deliberate: the package is not published to npm, it is installed from git.
