// Faz 5 (100-push) testleri — migrate (normalize/classify/dedup), ingest
// (legacy-yaml extractor'ları) ve backlinks. Hepsi saf fonksiyon, fs yok.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStatus, normalizePriority, normalizeModule, normalizeCandidate } from "../src/migrate/normalize.mjs";
import { detectDuplicates, pickRepresentative } from "../src/migrate/dedup.mjs";
import { classifyCandidate } from "../src/migrate/classify.mjs";
import { splitTopLevelRecords, extractField, extractList, extractBody } from "../src/ingest/legacy-yaml.mjs";
import { buildBacklinks } from "../src/markdown/backlinks.mjs";

// ── normalize ──────────────────────────────────────────────────────────────
test("normalizeStatus: legacy → canonical + TOP özel durumu", () => {
  assert.equal(normalizeStatus("completed").value, "done");
  assert.equal(normalizeStatus("planned").value, "queued");
  const top = normalizeStatus("TOP");
  assert.equal(top.value, "active");
  assert.ok(top.warning);
  assert.ok(normalizeStatus("bilinmeyen").warning);
});

test("normalizePriority: TOP → high (uyarılı)", () => {
  assert.equal(normalizePriority("high").value, "high");
  const top = normalizePriority("TOP");
  assert.equal(top.value, "high");
  assert.ok(top.warning);
});

test("normalizeModule: esleme ve gecerli liste CONFIG'ten gelir, sabit degil", () => {
  // Eskiden bu kurallar koda gomuluydu ve paket yazarinin urun modulleriydi.
  // Sonucu isim sizintisindan agirdi: goc eden yabancinin listede olmayan TUM
  // modulleri "unknown"a iniyordu — goc, modul bilgisini yok ediyordu.
  const cfg = {
    valid_modules: ["testx", "animatorx", "contentx"],
    module_normalization: { TestX: "testx", AnimatorX: "animatorx", ContentX: "contentx" },
  };
  assert.equal(normalizeModule("TestX", cfg).value, "testx");
  assert.equal(normalizeModule("AnimatorX", cfg).value, "animatorx");
  assert.equal(normalizeModule("YokModul", cfg).value, "unknown", "listede yoksa unknown");
  assert.deepEqual(normalizeModule(["TestX", "ContentX"], cfg).value, ["testx", "contentx"]);

  // CONFIG YOKSA kisitlama da yoktur: bilmedigimiz bir adi "gecersiz" ilan
  // etmek, veri silmenin kibar halidir.
  assert.equal(normalizeModule("odeme").value, "odeme");
  assert.equal(normalizeModule("Odeme").value, "odeme", "yalniz kucuk harfe iner");
  assert.deepEqual(normalizeModule(["Odeme", "Kargo"]).value, ["odeme", "kargo"]);
});

test("normalizeCandidate: status+priority+module birlikte normalize + changes", () => {
  const c = { proposed: { status: "completed", priority: "TOP", module: "TestX", title: "x" } };
  normalizeCandidate(c);
  assert.equal(c.proposed.status, "done");
  assert.equal(c.proposed.priority, "high");
  assert.equal(c.proposed.module, "testx");
  assert.ok(c.normalizations.length >= 3);
});

// ── legacy-yaml extractors ───────────────────────────────────────────────────
test("splitTopLevelRecords: iki kayıt ayrılır", () => {
  const text = `- date: 2026-01-01\n  title: A\n- date: 2026-01-02\n  title: B\n`;
  const recs = splitTopLevelRecords(text);
  assert.equal(recs.length, 2);
  assert.ok(recs[0].includes("title: A"));
});

test("extractField: quoted/unquoted + block-scalar başlığı null", () => {
  const block = `  title: "Hello: World"\n  status: open\n  body: |`;
  assert.equal(extractField(block, "title"), "Hello: World");
  assert.equal(extractField(block, "status"), "open");
  assert.equal(extractField(block, "body"), null);
});

test("extractList: inline + block", () => {
  assert.deepEqual(extractList(`  tags: [a, b, c]`, "tags"), ["a", "b", "c"]);
  const blk = `  modules:\n    - testx\n    - shared\n  next: x`;
  assert.deepEqual(extractList(blk, "modules"), ["testx", "shared"]);
});

test("extractBody: block scalar gövde", () => {
  const block = `  decision: |\n    İlk satır\n    İkinci satır\n  status: open`;
  assert.equal(extractBody(block, "decision"), "İlk satır\nİkinci satır");
});

// ── dedup ────────────────────────────────────────────────────────────────────
function cand(kind, title, type = "decision", extra = {}) {
  return { source: { kind, path: `${kind}/${title}.md` }, proposed: { title, type, status: "active", created_at: "2026-01-01", module: "shared", ...extra } };
}

test("detectDuplicates: aynı başlık/tip/modül kümelenir", () => {
  const a = cand("obsidian", "Aynı Karar");
  const b = cand("legacy_yaml", "Aynı Karar");
  const c = cand("obsidian", "Farklı");
  const { dup_groups } = detectDuplicates([a, b, c]);
  assert.equal(dup_groups.length, 1);
  assert.equal(dup_groups[0].members.length, 2);
});

test("pickRepresentative: obsidian > legacy_yaml tercih edilir", () => {
  const rep = pickRepresentative([cand("legacy_yaml", "X"), cand("obsidian", "X"), cand("graphify", "X")]);
  assert.equal(rep.source.kind, "obsidian");
});

// ── classify ─────────────────────────────────────────────────────────────────
test("classifyCandidate: kapalı bug → archive, aktif temiz → move", () => {
  const closed = { source: { path: "x" }, proposed: { type: "bug", status: "done", title: "Kapali bug", module: "auth", priority: "high" } };
  classifyCandidate(closed, new Map());
  assert.equal(closed.classification, "archive");

  const active = { source: { path: "x" }, proposed: { type: "decision", status: "active", title: "Gerçek aktif karar", module: "infra", priority: "high" } };
  classifyCandidate(active, new Map());
  assert.equal(active.classification, "move");
});

test("classifyCandidate: daily note → summarize; placeholder → archive", () => {
  const daily = { source: { path: "vault/daily/2026-01-01.md" }, proposed: { type: "note", status: "active", title: "Günlük" } };
  classifyCandidate(daily, new Map());
  assert.equal(daily.classification, "summarize");

  const ph = { source: { path: "x" }, proposed: { type: "bug", status: "open", title: "Bug açıklaması", module: "shared" } };
  classifyCandidate(ph, new Map());
  assert.equal(ph.classification, "archive");
});

// ── backlinks ────────────────────────────────────────────────────────────────
test("buildBacklinks: relations + [[mention]] + broken tespiti", () => {
  const objs = [
    { frontmatter: { id: "decision-a", relations: { bugs: ["bug-x"] } }, body: "bkz [[decision-b]]" },
    { frontmatter: { id: "decision-b" }, body: "" },
    { frontmatter: { id: "bug-x" }, body: "" },
  ];
  const { backlinks, broken } = buildBacklinks(objs);
  assert.ok(backlinks.get("bug-x").some((b) => b.source === "decision-a"));
  assert.ok(backlinks.get("decision-b").some((b) => b.kind === "mention"));
  assert.equal(broken.length, 0);

  const withBroken = buildBacklinks([{ frontmatter: { id: "decision-c", relations: { decisions: ["decision-yok"] } }, body: "" }]);
  assert.equal(withBroken.broken.length, 1);
});
