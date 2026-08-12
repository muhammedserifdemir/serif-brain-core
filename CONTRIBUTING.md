# Contributing

Thanks for looking. This project has a few unusual rules — they exist because
each one was learned the expensive way.

🇹🇷 Türkçe konuşuyorsanız Türkçe issue/PR açabilirsiniz, sorun değil.

## Setup

```bash
git clone https://github.com/muhammedserifdemir/serif-brain-core.git
cd serif-brain-core
npm test          # no install step — zero dependencies
```

Requires Node ≥ 22.5 (`node:sqlite` + native test runner). There is no build
step, no bundler, no transpiler.

## The rules that matter

**1. Zero dependencies.** Not "few". Zero. A memory tool that breaks because a
transitive dependency changed is worse than no memory tool. If you need a
parser, write the 60 lines.

**2. A number without a method is not a number.** If your PR claims something is
faster/better/more accurate, include the command and its output. See
[`docs/OLCUM.md`](docs/OLCUM.md) for the standard: what data, which production
call path, what criterion, and the **scope label** of the result.

**3. Test the silence, not just the speech.** Every gate has two failure modes:
speaking when it shouldn't (noise) and staying silent when it should speak
(false safety). The second is worse and much harder to notice — this project
shipped a gate that stayed silent *precisely when it found problems*, for
months. If you add a gate, test both directions in the same PR.

**4. Don't fabricate.** If a language's imports can't be resolved to files
(Swift, C#, Java…), we index the files and emit **no edges** — and say so.
A plausible-looking wrong edge produces "nobody imports this, safe to change",
which is worse than no answer.

**5. One computation, one place.** CLI and MCP call the same core. A second
copy means silent divergence of the "worked in the CLI, wrote something else
through MCP" kind.

**6. Fail loud, but never break the session.** The Claude Code gate always
exits 0 — it must never break someone's session. But it logs its errors to
`.serif-brain/.cache/gate.log` instead of swallowing them. "Don't break" and
"erase the error" are not the same instruction.

## Pull requests

- One concern per PR. Fixing something else "while we're here" makes the change
  unreviewable.
- Tests are not optional for behaviour changes. `npm test` must be green.
- Commit messages: say **what changed and why**, and include the evidence
  (measurement output, before/after). Look at `git log` for the house style —
  they're long on purpose.
- Turkish or English, both fine. Code comments in the repo are Turkish today;
  match the file you're editing.

## Good first issues

- **English translations** of `docs/USAGE.md`, `docs/MCP.md`, `docs/BASLANGIC.md`
- **Language support**: `src/scanner/languages.mjs` is the single source. Adding
  a language means one entry + an import parser + that ecosystem's dependency
  directories. Tests in `test/cok-dil.test.mjs` show the shape.
- **Windows verification**: the code was fixed for path separators but no real
  Windows run has been confirmed yet. Running the suite on Windows and reporting
  what breaks is genuinely useful.

## What this project is not looking for

- Adding a dependency to save 50 lines
- Cloud sync, accounts, telemetry. The data is plain Markdown in your repo and
  stays there.
- Auto-writing records without human approval. This was tried; the noise made
  the memory unreadable and it was reverted. See the `capture` command for the
  approved shape: propose, never write.
