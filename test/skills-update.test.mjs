import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { skillsCommand } from "../src/cli/skills.mjs";
import { planSkillSync, listPackageSkills, SKILLS_SRC, MANIFEST_NAME } from "../src/skills/sync.mjs";

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

// "Eski bir paket surumu kurulmus" durumunu DURUSTCE taklit eder: dosya diskte
// eski icerikle durur VE manifest o eski icerigin ozetini tasir (yani kurulumdan
// sonra kimse elle dokunmamistir). Elle yazilmis, manifestte izi olmayan dosya
// bu DEGILDIR — o "yerel duzenleme"dir ve ayri test edilir.
function fakeOldInstall(tmp, name, rel, content) {
  const skillsDir = join(tmp, ".claude", "skills");
  const dst = join(skillsDir, name, ...rel.split("/"));
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, content);
  const mf = join(skillsDir, MANIFEST_NAME);
  const cur = existsSync(mf) ? JSON.parse(readFileSync(mf, "utf8")) : { schema: 1, installed: {} };
  cur.installed[`${name}/${rel}`] = createHash("sha256").update(content).digest("hex");
  writeFileSync(mf, JSON.stringify(cur, null, 2));
  return dst;
}

test("skills update — BAYAT dosyayi gunceller (init'in yapamadigi is)", async () => {
  const tmp = makeTmpProject("stale");
  try {
    const { name, rel, src } = firstPackageFile();
    const dst = fakeOldInstall(tmp, name, rel, "ESKI PAKET SURUMU\n");

    await run(tmp, "update", { apply: true });

    assert.equal(
      readFileSync(dst, "utf8"),
      readFileSync(src, "utf8"),
      "bayat dosya (dokunulmamis, paket yenilenmis) --force olmadan guncellenmeliydi",
    );
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("skills update — YEREL DUZENLEME --force olmadan EZILMEZ", async () => {
  const tmp = makeTmpProject("edited");
  try {
    const { name, rel } = firstPackageFile();
    // once duzgun kur (manifest olusur), sonra kullanici elle degistirsin
    await run(tmp, "update", { apply: true });
    const dst = join(tmp, ".claude", "skills", name, ...rel.split("/"));
    const emek = "---\nname: x\n---\n\nBENIM DUZENLEMEM — KAYBOLMAMALI\n";
    writeFileSync(dst, emek);

    const { out } = await run(tmp, "update", { apply: true });
    assert.equal(readFileSync(dst, "utf8"), emek, "yerel duzenleme --force olmadan ezilmemeli");
    assert.match(out, /korun/i, "korundugu acikca soylenmeli (sessizce atlanmamali)");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("skills update --force — yerel duzenlemeyi ezer ve bunu SOYLER", async () => {
  const tmp = makeTmpProject("force");
  try {
    const { name, rel, src } = firstPackageFile();
    await run(tmp, "update", { apply: true });
    const dst = join(tmp, ".claude", "skills", name, ...rel.split("/"));
    writeFileSync(dst, "BENIM DUZENLEMEM\n");

    const { out } = await run(tmp, "update", { apply: true, force: true });
    assert.equal(readFileSync(dst, "utf8"), readFileSync(src, "utf8"), "--force ile paket surumu yazilmali");
    assert.match(out, /EZILDI/, "ezme islemi sessiz olmamali");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("manifest — kurulumdan sonra koken izi yazilir, bayat/duzenlenmis ayrilir", async () => {
  const tmp = makeTmpProject("manifest");
  try {
    await run(tmp, "update", { apply: true });
    const mf = join(tmp, ".claude", "skills", MANIFEST_NAME);
    assert.ok(existsSync(mf), "kurulumdan sonra manifest yazilmali");

    const { name, rel } = firstPackageFile();
    // (a) dokunulmamis ama paket degismis → stale
    fakeOldInstall(tmp, name, rel, "ESKI PAKET\n");
    let f = planSkillSync(tmp).skills.find(s => s.name === name).files.find(x => x.rel === rel);
    assert.equal(f.status, "stale");

    // (b) manifest'e uymayan icerik → edited
    writeFileSync(join(tmp, ".claude", "skills", name, ...rel.split("/")), "ELLE DEGISTIRDIM\n");
    f = planSkillSync(tmp).skills.find(s => s.name === name).files.find(x => x.rel === rel);
    assert.equal(f.status, "edited");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("manifest — manifestsiz ESKI kurulum farki YEREL DUZENLEME sayilir (emek korunur)", async () => {
  const tmp = makeTmpProject("nomanifest");
  try {
    const { name, rel } = firstPackageFile();
    const dst = join(tmp, ".claude", "skills", name, ...rel.split("/"));
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, "KOKENI BILINMEYEN ICERIK\n"); // manifest YOK

    const plan = planSkillSync(tmp);
    assert.equal(plan.has_manifest, false);
    const f = plan.skills.find(s => s.name === name).files.find(x => x.rel === rel);
    assert.equal(f.status, "edited", "koken bilinmiyorsa guvenli taraf: kullanicinin emegi");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("manifest — pakete BIREBIR esit dosyada koken izi kendini onarir", async () => {
  const tmp = makeTmpProject("selfheal");
  try {
    const { name, rel, src } = firstPackageFile();
    // manifestsiz ama icerigi pakete birebir esit kurulum (bugunku 4 projenin hali)
    const dst = join(tmp, ".claude", "skills", name, ...rel.split("/"));
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, readFileSync(src));

    await run(tmp, "update", { apply: true });

    const mf = JSON.parse(readFileSync(join(tmp, ".claude", "skills", MANIFEST_NAME), "utf8"));
    assert.ok(mf.installed[`${name}/${rel}`], "esit icerikte koken kesindir, manifest'e yazilmali");
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

test("skills status — guncel/duzenlenmis/eksik ayrimini dogru yapar", async () => {
  const tmp = makeTmpProject("status");
  try {
    await run(tmp, "update", { apply: true });
    const { name, rel } = firstPackageFile();
    const dst = join(tmp, ".claude", "skills", name, ...rel.split("/"));
    writeFileSync(dst, "YEREL DEGISIKLIK\n");

    const plan = planSkillSync(tmp);
    const target = plan.skills.find(s => s.name === name).files.find(f => f.rel === rel);
    assert.equal(target.status, "edited", "manifest'e uymayan icerik yerel duzenlemedir");
    const others = plan.skills.flatMap(s => s.files).filter(f => f !== target);
    assert.ok(others.every(f => f.status === "same"), "digerleri 'same' kalmali");

    const { out } = await run(tmp, "status");
    assert.match(out, /YEREL DUZENLEME/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("skills update — zaten guncelse hicbir sey yapmaz (idempotent)", async () => {
  const tmp = makeTmpProject("idem");
  try {
    await run(tmp, "update", { apply: true });
    const { exit, out } = await run(tmp, "update", { apply: true });
    assert.equal(exit, 0);
    assert.match(out, /Yapilacak is yok/);
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

test("skills update --apply — YAPILACAK IS YOKKEN de koken izi onarilir", async () => {
  const tmp = makeTmpProject("heal-noop");
  try {
    // Pakete birebir esit ama manifestsiz kurulum: yazilacak dosya YOK.
    // Erken donen bir akis burada manifest'i hic yazmaz — yani onarim tam da
    // ona ihtiyaci olan projede calismaz.
    for (const skill of planSkillSync(tmp).skills) {
      for (const f of skill.files) {
        mkdirSync(dirname(f.dst), { recursive: true });
        writeFileSync(f.dst, readFileSync(f.src));
      }
    }
    assert.equal(planSkillSync(tmp).has_manifest, false);

    const { out } = await run(tmp, "update", { apply: true });
    assert.match(out, /Yapilacak is yok/);
    assert.match(out, /Koken izi yazildi/, "is olmasa bile manifest onarilmali");
    assert.equal(planSkillSync(tmp).has_manifest, true);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("skills update — DRY-RUN koken izini de YAZMAZ", async () => {
  const tmp = makeTmpProject("heal-dry");
  try {
    for (const skill of planSkillSync(tmp).skills) {
      for (const f of skill.files) {
        mkdirSync(dirname(f.dst), { recursive: true });
        writeFileSync(f.dst, readFileSync(f.src));
      }
    }
    await run(tmp, "update");
    assert.equal(planSkillSync(tmp).has_manifest, false, "dry-run hicbir sey yazmamali");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
