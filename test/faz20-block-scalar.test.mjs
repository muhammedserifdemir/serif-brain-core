// Block scalar (| literal, > folded) okuma + cok-satirli string serialize round-trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYaml, serializeYaml } from "../src/markdown/yaml.mjs";
import { parseFrontmatter, serializeFrontmatter } from "../src/markdown/frontmatter.mjs";

test("block |: literal — newline'lar korunur", () => {
  const y = ["desc: |", "  satir bir", "  satir iki", "  satir uc"].join("\n");
  assert.equal(parseYaml(y).desc, "satir bir\nsatir iki\nsatir uc");
});

test("block >: folded — satirlar bosluga katlanir, bos satir paragraf", () => {
  const y = ["desc: >", "  bir iki", "  uc dort", "", "  yeni paragraf"].join("\n");
  assert.equal(parseYaml(y).desc, "bir iki uc dort\nyeni paragraf");
});

test("block: diger anahtarlarla birlikte (sinir dogru)", () => {
  const y = ["title: X", "desc: |", "  cok", "  satir", "status: open"].join("\n");
  const r = parseYaml(y);
  assert.equal(r.title, "X");
  assert.equal(r.desc, "cok\nsatir");
  assert.equal(r.status, "open");
});

test("block: nested anahtar altinda calisir", () => {
  const y = ["meta:", "  note: |", "    ic satir 1", "    ic satir 2", "  tag: x"].join("\n");
  const r = parseYaml(y);
  assert.equal(r.meta.note, "ic satir 1\nic satir 2");
  assert.equal(r.meta.tag, "x");
});

test("block: icindeki # YORUM DEGIL (literal korunur)", () => {
  const y = ["code: |", "  line # not-a-comment", "  next"].join("\n");
  assert.equal(parseYaml(y).code, "line # not-a-comment\nnext");
});

test("block chomp: |- (clip/strip) vs |+ (keep trailing newline)", () => {
  const minus = ["d: |-", "  a", "  b", ""].join("\n");
  assert.equal(parseYaml(minus).d, "a\nb");
  const plus = ["d: |+", "  a", "  b", "", ""].join("\n");
  assert.equal(parseYaml(plus).d, "a\nb\n");
});

test("serialize: cok-satirli string artik tirnaklanir + round-trip", () => {
  const o = { desc: "satir1\nsatir2\nsatir3" };
  const r = parseYaml(serializeYaml(o));
  assert.deepEqual(r, o); // eskiden bozuluyordu (cok-satir tirnaksizdi)
});

test("frontmatter: block scalar gercek dosyada round-trip okunur", () => {
  const text = ["---", "id: note-1", "type: note", "body_note: |", "  uzun", "  aciklama", "---", "", "# govde"].join("\n");
  const p = parseFrontmatter(text);
  assert.equal(p.frontmatter.body_note, "uzun\naciklama");
  assert.equal(p.frontmatter.id, "note-1");
});

test("block: tek-satir inline > deger block-scalar SAYILMAZ (regresyon koruma)", () => {
  // 'key: >text' block header degil; > inline deger gibi parse edilmeli (string).
  const r = parseYaml("k: >deger");
  assert.equal(typeof r.k, "string");
});
