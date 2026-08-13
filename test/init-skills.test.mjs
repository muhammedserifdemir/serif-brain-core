import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initCommand } from "../src/cli/init.mjs";

function makeTmpProject(prefix) {
  return mkdtempSync(join(tmpdir(), `sb-skills-${prefix}-`));
}

function suppressLogs(fn) {
  const orig = console.log;
  console.log = () => {};
  return Promise.resolve(fn()).finally(() => {
    console.log = orig;
  });
}

test("init — paket skill'leri .claude/skills/ altina kurulur", async () => {
  const tmp = makeTmpProject("install");
  try {
    const exit = await suppressLogs(() =>
      initCommand({ args: { flags: { project: tmp }, _: [] } }),
    );
    assert.equal(exit, 0);

    const skills = join(tmp, ".claude", "skills");
    assert.ok(existsSync(join(skills, "cerrahi-plan", "SKILL.md")), "cerrahi-plan/SKILL.md kurulmadi");
    assert.ok(existsSync(join(skills, "kanit-disiplini", "SKILL.md")), "kanit-disiplini/SKILL.md kurulmadi");
    assert.ok(
      existsSync(join(skills, "kanit-disiplini", "scripts", "tr_tarama.py")),
      "kanit-disiplini/scripts/tr_tarama.py kurulmadi (alt dizinler de kopyalanmali)",
    );
    assert.ok(existsSync(join(skills, "serif-brain-core", "SKILL.md")), "serif-brain-core/SKILL.md kurulmadi");

    // Frontmatter saglam mi (name alani dogru skill'e ait mi)
    const kanit = readFileSync(join(skills, "kanit-disiplini", "SKILL.md"), "utf8");
    assert.match(kanit, /^---\r?\n/);   // Windows checkout'unda CRLF gelir
    assert.match(kanit, /name: kanit-disiplini/);
    const cerrahi = readFileSync(join(skills, "cerrahi-plan", "SKILL.md"), "utf8");
    assert.match(cerrahi, /name: cerrahi-plan/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("init — mevcut skill dosyasi overwrite edilmez (yerel duzenleme korunur)", async () => {
  const tmp = makeTmpProject("preserve");
  try {
    const skillDir = join(tmp, ".claude", "skills", "kanit-disiplini");
    mkdirSync(skillDir, { recursive: true });
    const custom = "---\nname: kanit-disiplini\ndescription: KULLANICI OZEL SURUMU\n---\n";
    writeFileSync(join(skillDir, "SKILL.md"), custom);

    await suppressLogs(() =>
      initCommand({ args: { flags: { project: tmp }, _: [] } }),
    );

    const after = readFileSync(join(skillDir, "SKILL.md"), "utf8");
    assert.equal(after, custom, "kullanicinin duzenledigi SKILL.md ezilmemeli");
    // Ayni skill'in eksik dosyalari yine de tamamlanmali
    assert.ok(
      existsSync(join(skillDir, "scripts", "tr_tarama.py")),
      "var olan SKILL.md korunurken eksik script yine de kurulmali",
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("init — ikinci calistirma idempotent (skill'ler tekrar yazilmaz, hata vermez)", async () => {
  const tmp = makeTmpProject("idempotent");
  try {
    await suppressLogs(() => initCommand({ args: { flags: { project: tmp }, _: [] } }));
    const p = join(tmp, ".claude", "skills", "cerrahi-plan", "SKILL.md");
    const first = readFileSync(p, "utf8");

    const exit = await suppressLogs(() =>
      initCommand({ args: { flags: { project: tmp }, _: [] } }),
    );
    assert.equal(exit, 0);
    assert.equal(readFileSync(p, "utf8"), first);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
