import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketOf, isTaskType } from "../src/dashboard/normalize.mjs";
import { computeMetrics } from "../src/dashboard/metrics.mjs";
import { upsertBrain, findBrain, brainRootOf } from "../src/dashboard/registry.mjs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("normalize: status kovalari", () => {
  assert.equal(bucketOf("done"), "done");
  assert.equal(bucketOf("completed"), "done");
  assert.equal(bucketOf("resolved"), "done");
  assert.equal(bucketOf("in-progress"), "open");
  assert.equal(bucketOf("active"), "open");
  assert.equal(bucketOf("blocked"), "blocked");
  assert.equal(bucketOf("archived"), "dropped");
  assert.equal(bucketOf("rejected"), "dropped");
  assert.equal(bucketOf(undefined), "open"); // muhafazakar
  assert.equal(bucketOf("bilinmeyen"), "open");
});

test("normalize: sadece bug+decision is sayilir", () => {
  assert.ok(isTaskType("bug"));
  assert.ok(isTaskType("decision"));
  assert.ok(!isTaskType("note"));
  assert.ok(!isTaskType("session"));
});

test("metrics: yuzde + biten + kritik", () => {
  const objs = [
    { type: "decision", frontmatter: { status: "done", title: "A", completed_at: "2026-06-01" } },
    { type: "decision", frontmatter: { status: "done", title: "B", updated_at: "2026-06-02" } },
    { type: "bug", frontmatter: { status: "open", title: "C", priority: "critical" } },
    { type: "bug", frontmatter: { status: "blocked", title: "D", priority: "high" } },
    { type: "note", frontmatter: { status: "active", title: "not" } }, // sayilmaz
  ];
  const m = computeMetrics(objs);
  assert.equal(m.done, 2);
  assert.equal(m.open, 1);
  assert.equal(m.blocked, 1);
  assert.equal(m.percent, 50); // 2 / (2+1+1)
  assert.equal(m.criticalOpen, 1);
  assert.equal(m.doneItems.length, 2);
  assert.equal(m.critItems.length, 2); // critical + high (acik/blocked)
  assert.equal(m.critItems[0].priority, "critical"); // oncelik sirali
});

test("metrics: bos veri -> percent null", () => {
  const m = computeMetrics([{ type: "note", frontmatter: { status: "active" } }]);
  assert.equal(m.percent, null);
});

test("metrics: hepsi active -> status saglik uyarisi", () => {
  const objs = Array.from({ length: 9 }, (_, i) => ({ type: "decision", frontmatter: { status: "active", title: "x" + i } }));
  const m = computeMetrics(objs);
  assert.equal(m.percent, 0);
  assert.ok(m.statusHealthWarn);
});

test("registry: upsert ekler, ikinci cagri gunceller (override merge)", () => {
  const reg = { schema: 1, brains: [] };
  upsertBrain(reg, { repo: "/tmp/proj-x", name: "X", override: { port: "3001" } });
  assert.equal(reg.brains.length, 1);
  upsertBrain(reg, { repo: "/tmp/proj-x", override: { run: "next dev" } });
  assert.equal(reg.brains.length, 1); // duplicate degil
  assert.equal(reg.brains[0].override.port, "3001"); // korundu
  assert.equal(reg.brains[0].override.run, "next dev"); // eklendi
  assert.equal(reg.brains[0].name, "X"); // korundu
});

test("registry: findBrain isim/yol ile bulur", () => {
  const reg = { schema: 1, brains: [] };
  upsertBrain(reg, { repo: "/tmp/edux", name: "Seriftech LMS" });
  assert.ok(findBrain(reg, "Seriftech LMS"));
  assert.ok(findBrain(reg, "edux")); // basename
  assert.ok(!findBrain(reg, "yok"));
});

test("registry: brainRootOf hem repo hem .serif-brain kabul eder", () => {
  // Iddia isletim sisteminin ayracina gore kurulur: brainRootOf join() dondurur,
  // Windows'ta "\" gelir. Sabit "/" yazmak urunu degil TESTI Windows'ta kirar.
  const repo = join(tmpdir(), "proj");
  assert.ok(brainRootOf(repo).endsWith(join("proj", ".serif-brain")));
  const dogrudan = join(repo, ".serif-brain");
  assert.equal(brainRootOf(dogrudan), dogrudan);
});
