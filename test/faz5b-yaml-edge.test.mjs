// Faz 5 (100-push) — YAML parser/serializer uç durumları. Elle yazılmış parser'ın
// sağlamlığını kanıtlar (sıfır bağımlılık felsefesi korunur).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYaml, serializeYaml } from "../src/markdown/yaml.mjs";

test("tam frontmatter round-trip (id/array/nested/tarih/sayı/bool/null)", () => {
  const obj = {
    id: "decision-x",
    type: "decision",
    priority: "high",
    n: 42,
    ok: true,
    nope: false,
    nothing: null,
    tags: ["a", "b-c", "uç"],
    created_at: "2026-06-18T10:00:00Z",
    relations: { bugs: ["bug-1"], decisions: [] },
    source: { kind: "manual", path: "" },
  };
  const r = parseYaml(serializeYaml(obj));
  assert.equal(r.id, "decision-x");
  assert.equal(r.n, 42);
  assert.equal(r.ok, true);
  assert.equal(r.nope, false);
  assert.equal(r.nothing, null);
  assert.deepEqual(r.tags, ["a", "b-c", "uç"]);
  assert.deepEqual(r.relations.bugs, ["bug-1"]);
  assert.deepEqual(r.relations.decisions, []);
  assert.equal(r.source.kind, "manual");
});

test("özel karakterli string tırnaklanır + geri okunur (: # [ ] { })", () => {
  const obj = { title: "Fix: bug #42 [urgent] {scope}", url: "https://x.co/p?q=1" };
  const r = parseYaml(serializeYaml(obj));
  assert.equal(r.title, "Fix: bug #42 [urgent] {scope}");
  assert.equal(r.url, "https://x.co/p?q=1");
});

test("satır-sonu yorumu değeri bozmaz (key: val # yorum)", () => {
  const r = parseYaml(`engine: sqlite # node:sqlite | jsonl\nport: 3001\n`);
  assert.equal(r.engine, "sqlite");
  assert.equal(r.port, 3001);
});

test("boş array / boş inline object", () => {
  const r = parseYaml(`tags: []\nmeta: {}\n`);
  assert.deepEqual(r.tags, []);
  assert.deepEqual(r.meta, {});
});

test("nested block dict + içinde liste", () => {
  const r = parseYaml(`relations:\n  bugs:\n    - bug-1\n    - bug-2\n  decisions:\n    - decision-1\n`);
  assert.deepEqual(r.relations.bugs, ["bug-1", "bug-2"]);
  assert.deepEqual(r.relations.decisions, ["decision-1"]);
});

test("tek-tırnak + kaçışlı çift-tırnak", () => {
  const r = parseYaml(`a: 'tek tırnak'\nb: "çift \\"içi\\" tırnak"\n`);
  assert.equal(r.a, "tek tırnak");
  assert.equal(r.b, 'çift "içi" tırnak');
});

test("# ile başlayan satır yorumdur (atlanır)", () => {
  const r = parseYaml(`# bu bir yorum\nkey: value\n# son yorum\n`);
  assert.equal(r.key, "value");
  assert.equal(Object.keys(r).length, 1);
});
