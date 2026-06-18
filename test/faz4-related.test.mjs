// Faz 4 testleri — bağlantı çıkarımı (related). Saf fonksiyon, fs yok.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreRelated, findRelated } from "../src/query/related.mjs";

const A = { frontmatter: { id: "decision-a", type: "decision", title: "SCORM oynatıcı tam ekran", module: "scorm", tags: ["scorm", "canli"] }, body: "scorm player fullscreen audio" };
const B = { frontmatter: { id: "decision-b", type: "decision", title: "SCORM ses teşhisi", module: "scorm", tags: ["scorm"] }, body: "scorm audio subtitle diagnosis" };
const C = { frontmatter: { id: "bug-c", type: "bug", title: "Login Safari", module: "auth", tags: ["auth"] }, body: "safari cookie" };

test("scoreRelated: kendine 0", () => {
  assert.equal(scoreRelated(A, A).score, 0);
});

test("scoreRelated: paylaşılan modül + etiket + metin skoru pozitif", () => {
  const r = scoreRelated(A, B);
  assert.ok(r.score > 0);
  assert.ok(r.reasons.some((x) => x.startsWith("modül:")));
  assert.ok(r.reasons.some((x) => x.startsWith("etiket:")));
});

test("scoreRelated: ilgisiz obje düşük/sıfır", () => {
  const r = scoreRelated(A, C);
  assert.ok(r.score < scoreRelated(A, B).score);
});

test("findRelated: en ilişkiliyi başa koyar, kendini hariç tutar", () => {
  const res = findRelated(A, [A, B, C]);
  assert.equal(res[0].id, "decision-b");
  assert.ok(!res.some((r) => r.id === "decision-a"));
  assert.ok(Array.isArray(res[0].reasons));
});

test("findRelated: limit uygulanır", () => {
  const res = findRelated(A, [A, B, C], { limit: 1 });
  assert.equal(res.length, 1);
});
