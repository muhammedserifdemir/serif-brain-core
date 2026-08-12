# Security Policy

## Scope

serif-brain runs locally. It reads your source files and git history, writes
Markdown into `.serif-brain/`, and (optionally) registers hooks in
`.claude/settings.json`. It makes **no network calls** and has **no
dependencies**.

Things worth knowing:

- `.serif-brain/` is normally committed to your repository. Anything you write
  into a record is as public as your repo. Don't paste secrets into records.
- The gate installer edits `.claude/settings.json`. It backs the file up first,
  never touches hook entries it didn't write, and refuses to write if the file
  is not valid JSON.
- `serif-brain dashboard serve` starts a **local** HTTP server. Don't expose it.

## Reporting a vulnerability

Open a GitHub issue for anything low-risk. For something you'd rather not post
publicly, use GitHub's private vulnerability reporting on this repository.

Please include the command you ran, what you expected, and what happened.
