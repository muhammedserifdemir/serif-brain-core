// Faz: Active Memory — auto-capture cekirdegi (commit -> aday obje).
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCommit, proposeFromCommits, dominantModule, isMemoryOnlyCommit } from "../src/query/capture.mjs";

test("classify: fix commit -> cozulmus bug (done)", () => {
  const c = classifyCommit("fix(auth): null deref on login");
  assert.equal(c.type, "bug");
  assert.equal(c.status, "done");
});

test("classify: TR 'düzelt' bug yakalanir", () => {
  assert.equal(classifyCommit("login hatası düzeltildi").type, "bug");
});

test("classify: karar/adopt -> decision (active)", () => {
  assert.equal(classifyCommit("switch to RLS for tenant isolation").type, "decision");
  assert.equal(classifyCommit("RLS kullanmaya karar verildi").type, "decision");
});

test("classify: merge/release/wip/version -> atla (null)", () => {
  assert.equal(classifyCommit("Merge branch 'main'"), null);
  assert.equal(classifyCommit("v1.2.3"), null);
  assert.equal(classifyCommit("wip"), null);
  assert.equal(classifyCommit("release 2.0"), null);
});

test("classify: notr 'add button' -> atla (yuksek precision)", () => {
  assert.equal(classifyCommit("add new dashboard button"), null);
});

test("propose: prefix temizlenir + evidence + hash", () => {
  const commits = [{ hash: "abcdef1234", subject: "fix(billing): iyzico webhook imza", files: ["packages/billing/iyzico.ts"] }];
  const out = proposeFromCommits(commits, { ownerFor: () => "billing" });
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "iyzico webhook imza"); // "fix(billing): " soyuldu
  assert.equal(out[0].module, "billing");
  assert.match(out[0].evidence, /^git abcdef1/);
});

test("propose: zaten yakalanmis hash atlanir", () => {
  const commits = [{ hash: "abcdef1234567", subject: "fix: x", files: [] }];
  const existingHashes = new Set(["abcdef1"]); // kisa hash
  assert.equal(proposeFromCommits(commits, { existingHashes }).length, 0);
});

test("propose: ayni baslikli mukerrer commit tek say", () => {
  const commits = [
    { hash: "a1", subject: "fix: same thing", files: [] },
    { hash: "b2", subject: "fix: same thing", files: [] },
  ];
  assert.equal(proposeFromCommits(commits, {}).length, 1);
});

test("dominantModule: en cok gecen unknown-disi modul", () => {
  const owner = (f) => (f.startsWith("a/") ? "auth" : f.startsWith("b/") ? "billing" : "unknown");
  const files = ["a/1.ts", "a/2.ts", "b/1.ts", "x/1.ts"];
  assert.equal(dominantModule(files, owner), "auth");
  assert.equal(dominantModule(["x/only.ts"], owner), "unknown");
});

// ── Hafiza HAKKINDA commit'ler ─────────────────────────────────────────────
// "brain: siralama hatasi kaydi" bir bug KAYDI ekler; onu tekrar bug diye
// onermek ayni olayi ikinci kez yazmak olur — kaydi tutan cezalandirilir.
// Metin siniflandirmasi bunu goremez ("hata" kelimesi baslikta); ayrimi
// DOSYALAR yapar.
test("capture — yalniz .serif-brain/ degistiren commit ONERILMEZ", () => {
  const commits = [
    { hash: "aaa1111", subject: "brain: siralama hatasi kaydi", files: [".serif-brain/objects/projects/t/bugs/b.md"] },
    { hash: "bbb2222", subject: "fix: gercek bir hata", files: ["src/a.mjs"] },
  ];
  const p = proposeFromCommits(commits, {});
  assert.equal(p.length, 1, "yalniz gercek kod olayi onerilmeli");
  assert.equal(p[0].hash, "bbb2222");
});

test("capture — hafiza + KOD birlikte degistiyse ONERILIR (kayit yaninda fix var)", () => {
  const p = proposeFromCommits([
    { hash: "ccc3333", subject: "fix: hata + kaydi", files: [".serif-brain/objects/x.md", "src/a.mjs"] },
  ], {});
  assert.equal(p.length, 1, "kod dokunuldugu an olay gercektir");
});

test("capture — dosya bilgisi YOKSA eleme yapilmaz (yanlis susmaktansa oner)", () => {
  const p = proposeFromCommits([{ hash: "ddd4444", subject: "fix: bir sey", files: [] }], {});
  assert.equal(p.length, 1);
});

test("isMemoryOnlyCommit — dogrudan sozlesme", () => {
  assert.equal(isMemoryOnlyCommit([".serif-brain/a.md", ".serif-brain/b.md"]), true);
  assert.equal(isMemoryOnlyCommit([".serif-brain/a.md", "src/x.mjs"]), false);
  assert.equal(isMemoryOnlyCommit([]), false);
  assert.equal(isMemoryOnlyCommit(undefined), false);
});
