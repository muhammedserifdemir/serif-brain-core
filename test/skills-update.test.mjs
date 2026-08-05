import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { skillsCommand } from "../src/cli/skills.mjs";
import { planSkillSync, listPackageSkills, SKILLS_SRC } from "../src/skills/sync.mjs";

function makeTmpProject(prefix) {
  return mkdtempSync(join(tmpdir(), `sb-skillsupd-${prefix}-`));
}

// Konsolu yutar ama satirlari da doner — cikti sozlesmesini test edebilmek icin
function captureLogs(fn) {
  const orig = console.log;
  const origErr = console.error;
  const lines = [];
  console.log = (...a) => lines.push(a.join(" "));
  console.error = (...a) => lines.push(a.join(" "));
  return Promise.resolve(fn())
    .then(exit => ({ exit, out: lines.join("\n") }))
    .finally(() => { console.log = orig; console.error = origErr; });
}

const run = (tmp, sub, flags = {}) =>
  captureLogs(() => skillsCommand({ args: { flags: { project: tmp, ...flags }, _: [] }, subcommand: sub ? [sub] : [] }));

// Paketteki bir skill'in ilk dosyasini bulur (isim sabitine baglanmadan)
function firstPackageFile() {
  const name = listPackageSkills()[0];
  const probe = mkdtempSync(join(tmpdir(), "sb-probe-"));
  try {
    const skill = planSkillSync(probe).skills.find(s => s.name === name);
    return { name, rel: skill.files[0].rel, src: join(SKILLS_SRC, name, ...skill.files[0].rel.split("/")) };
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
}

test("skills update --apply — bos projeye tum paket skill'leri kurulur", async () => {
  const tmp = makeTmpProject("fresh");
  try {
    const { exit } = await run(tmp, "update", { apply: true });
    assert.equal(exit, 0);
    const plan = planSkillSync(tmp);
    const stale = plan.skills.flatMap(s => s.files).filter(f => f.status !== "same");
    assert.deepEqual(stale, [], "apply sonrasi hicbir dosya 'missing/differs' kalmamali");
    assert.equal(plan.skills.length, listPackageSkills().length);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("skills update — BAYAT dosyayi gunceller (init'in yapamadigi is)", async () => {
  const tmp = makeTmpProject("stale");
  try {
    const { name, rel, src } = firstPackageFile();
    const dst = join(tmp, ".claude", "skills", name, ...rel.split("/"));
    mkdirSync(join(dst, ".."), { recursive: true });
    writeFileSync(dst, "ESKI SURUM\n");

    await run(tmp, "update", { apply: true });

    assert.equal(
      readFileSync(dst, "utf8"),
      readFileSync(src, "utf8"),
      "bayat dosya paket surumuyle guncellenmeliydi",
    );
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("skills update — DRY-RUN varsayilan: --apply yoksa diske YAZMAZ", async () => {
  const tmp = makeTmpProject("dryrun");
  try {
    const { name, rel } = firstPackageFile();
    const dst = join(tmp, ".claude", "skills", name, ...rel.split("/"));
    mkdirSync(join(dst, ".."), { recursive: true });
    writeFileSync(dst, "ESKI SURUM\n");

    const { exit, out } = await run(tmp, "update");
    assert.equal(exit, 0);
    assert.match(out, /DRY-RUN/);
    assert.equal(readFileSync(dst, "utf8"), "ESKI SURUM\n", "dry-run diske yazmamaliydi");
    // Kurulacak olanlar da yazilmamali
    const other = listPackageSkills().find(n => n !== name);
    assert.ok(!existsSync(join(tmp, ".claude", "skills", other)), "dry-run eksik skill'i de kurmamali");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("skills status — guncel/bayat/eksik ayrimini dogru yapar", async () => {
  const tmp = makeTmpProject("status");
  try {
    await run(tmp, "update", { apply: true });
    const { name, rel } = firstPackageFile();
    const dst = join(tmp, ".claude", "skills", name, ...rel.split("/"));
    writeFileSync(dst, "YEREL DEGISIKLIK\n");

    const plan = planSkillSync(tmp);
    const target = plan.skills.find(s => s.name === name).files.find(f => f.rel === rel);
    assert.equal(target.status, "differs");
    const others = plan.skills.flatMap(s => s.files).filter(f => f !== target);
    assert.ok(others.every(f => f.status === "same"), "digerleri 'same' kalmali");

    const { out } = await run(tmp, "status");
    assert.match(out, /BAYAT\/FARKLI/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("skills update — zaten guncelse hicbir sey yapmaz (idempotent)", async () => {
  const tmp = makeTmpProject("idem");
  try {
    await run(tmp, "update", { apply: true });
    const { exit, out } = await run(tmp, "update", { apply: true });
    assert.equal(exit, 0);
    assert.match(out, /zaten guncel/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("skills list — paketteki skill adlarini dondurur", async () => {
  const tmp = makeTmpProject("list");
  try {
    const { exit, out } = await run(tmp, "list", { json: true });
    assert.equal(exit, 0);
    assert.deepEqual(JSON.parse(out).skills, listPackageSkills());
    assert.ok(!existsSync(join(tmp, ".claude")), "list salt-okunur olmali");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("skills — bilinmeyen alt komut exit 1", async () => {
  const tmp = makeTmpProject("bad");
  try {
    const { exit } = await run(tmp, "kurcala");
    assert.equal(exit, 1);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
