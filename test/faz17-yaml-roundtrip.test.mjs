// YAML parser saglamlik probu — #1 risk: sessiz veri kaybi.
// serialize → parse round-trip ve frontmatter butunlugu. Davranis DEGISTIRMEZ;
// latent bug varsa yakalar (yakalananlar ayrica fix edilir).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYaml, serializeYaml } from "../src/markdown/yaml.mjs";
import { parseFrontmatter, serializeFrontmatter } from "../src/markdown/frontmatter.mjs";

function roundtrip(obj) {
  return parseYaml(serializeYaml(obj));
}

test("round-trip: skaler tipler korunur", () => {
  const o = { s: "merhaba", n: 42, f: 3.14, b: true, x: false, z: null };
  assert.deepEqual(roundtrip(o), o);
});

test("round-trip: ozel karakterli string (: # [ ] { } ,) tirnaklanip geri okunur", () => {
  const o = { title: "fix: auth [billing] {x} #1, done", note: "a: b # c" };
  assert.deepEqual(roundtrip(o), o);
});

test("round-trip: sayi/bool gibi GORUNEN string, string kalir", () => {
  const o = { ver: "007", semver: "1.2.3", word: "true", nope: "no" };
  const r = roundtrip(o);
  assert.equal(typeof r.ver, "string");
  assert.equal(r.ver, "007");
  assert.equal(r.semver, "1.2.3");
  assert.equal(r.word, "true");   // string "true", boolean degil
  assert.equal(r.nope, "no");
});

test("round-trip: inline + bos array", () => {
  assert.deepEqual(roundtrip({ tags: ["a", "b", "c"] }), { tags: ["a", "b", "c"] });
  assert.deepEqual(roundtrip({ tags: [] }), { tags: [] });
});

test("round-trip: nested object (relations gibi)", () => {
  const o = { relations: { files: ["a.ts"], decisions: [], bugs: ["bug-1"], modules: ["auth"] } };
  assert.deepEqual(roundtrip(o), o);
});

test("round-trip: inline object (source: {kind, path})", () => {
  const o = { source: { kind: "git", path: "abc123" } };
  assert.deepEqual(roundtrip(o), o);
});

test("round-trip: Turkce/unicode korunur", () => {
  const o = { title: "İçerik üretimi: şğüöçı", desc: "düzeltildi" };
  assert.deepEqual(roundtrip(o), o);
});

test("round-trip: bos string ve sondaki bosluk", () => {
  const o = { empty: "", spaced: "x " };
  const r = roundtrip(o);
  assert.equal(r.empty, "");
  assert.equal(r.spaced, "x ");
});

test("frontmatter: gercek obje semasi tam round-trip", () => {
  const fm = {
    id: "bug-20260620-test",
    type: "bug",
    project: "seriftech-packages",
    module: "infra",
    title: "fix: graf [impact] hesabi #1",
    status: "open",
    priority: "high",
    severity: "high",
    owner: "",
    created_at: "2026-06-20T07:23:49.921Z",
    updated_at: "2026-06-20T07:23:49.921Z",
    source: { kind: "manual", path: "" },
    relations: { files: ["src/a.ts"], decisions: [], bugs: [], modules: ["infra"] },
    tags: ["auto-capture", "graf"],
    summary: "fix: graf [impact] hesabi #1",
  };
  const text = serializeFrontmatter(fm, "\n# govde\n");
  const parsed = parseFrontmatter(text);
  assert.equal(parsed.has_frontmatter, true);
  assert.deepEqual(parsed.frontmatter, fm);
});

test("EDGE: 4-bosluk girintili blok liste (sessiz veri kaybi riski)", () => {
  // Elle yazilmis, 4-bosluk girintili bir frontmatter. Parser bunu kaybetmemeli.
  const yaml = [
    "tags:",
    "    - alpha",
    "    - beta",
  ].join("\n");
  const r = parseYaml(yaml);
  assert.deepEqual(r.tags, ["alpha", "beta"], "4-bosluk blok liste tam okunmali");
});

test("EDGE: liste-ogesi coklu anahtar (- k: v\\n  k2: v2)", () => {
  const yaml = [
    "items:",
    "  - name: foo",
    "    kind: a",
    "  - name: bar",
    "    kind: b",
  ].join("\n");
  const r = parseYaml(yaml);
  assert.deepEqual(r.items, [{ name: "foo", kind: "a" }, { name: "bar", kind: "b" }]);
});

// ── GUVENLIK GARANTISI: desteklenmeyen girdi SESLI hata verir, SESSIZCE KAYBETMEZ ──
// Bu testler "fail-loud" sozlesmesini kilitler; gelecekte biri sessiz-kayba donerse kirilir.

test("GARANTI: liste-ogesi icinde nested object → serialize THROW (sessiz degil)", () => {
  assert.throws(() => serializeYaml({ items: [{ name: "x", rel: { f: ["a"] } }] }), /nested object inline/);
});

test("GARANTI: tab girinti (gecersiz YAML) → parse THROW (sessiz degil)", () => {
  assert.throws(() => parseYaml("tags:\n\t- a\n\t- b"), /expected key:value|indent/);
});

test("round-trip: 3-seviye nesting (yorum 'max 2' diyordu — aslinda calisiyor)", () => {
  const o = { a: { b: { c: "deep" } } };
  assert.deepEqual(roundtrip(o), o);
});
