// Faz: Symbol Graph (ilk dilim) — canli blast-radius (computeImpact).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeImpact, resolveFileNode, formatImpact } from "../src/query/impact.mjs";

// Graf: a <- b <- c  (c imports b, b imports a). a degisirse b+c kirilir.
//       d bagimsiz (yaprak degil; kimse import etmiyor -> leaf).
const GRAPH = {
  nodes: [
    { id: "file:a.ts", type: "file", path: "a.ts", module: "core" },
    { id: "file:b.ts", type: "file", path: "b.ts", module: "core" },
    { id: "file:c.ts", type: "file", path: "c.ts", module: "ui" },
    { id: "file:d.ts", type: "file", path: "d.ts", module: "ui" },
  ],
  edges: [
    { source: "file:b.ts", target: "file:a.ts", type: "imports" },
    { source: "file:c.ts", target: "file:b.ts", type: "imports" },
    { source: "file:d.ts", target: "file:a.ts", type: "imports" },
  ],
};

test("impact: a.ts degisirse gecisli bagimlilar b,c,d", () => {
  const im = computeImpact(GRAPH, "file:a.ts");
  assert.equal(im.found, true);
  assert.deepEqual(im.direct_dependents, ["b.ts", "d.ts"]); // a'yi dogrudan import edenler
  assert.equal(im.transitive_dependent_count, 3);           // b, c (b uzerinden), d
  assert.deepEqual(im.transitive_dependents, ["b.ts", "c.ts", "d.ts"]);
});

test("impact: etkilenen moduller toplanir", () => {
  const im = computeImpact(GRAPH, "file:a.ts");
  assert.deepEqual(im.affected_modules, ["core", "ui"]);
});

test("impact: c.ts yaprak (kimse import etmiyor)", () => {
  const im = computeImpact(GRAPH, "file:c.ts");
  assert.equal(im.is_leaf, true);
  assert.equal(im.transitive_dependent_count, 0);
  assert.deepEqual(im.dependencies, ["b.ts"]); // c, b'yi import eder
});

test("impact: dongu sonsuz donmez (a<->b cycle)", () => {
  const cyc = {
    nodes: [
      { id: "file:x.ts", type: "file", path: "x.ts" },
      { id: "file:y.ts", type: "file", path: "y.ts" },
    ],
    edges: [
      { source: "file:x.ts", target: "file:y.ts", type: "imports" },
      { source: "file:y.ts", target: "file:x.ts", type: "imports" },
    ],
  };
  const im = computeImpact(cyc, "file:x.ts");
  assert.equal(im.transitive_dependent_count, 1); // sadece y (x kendini saymaz)
});

test("impact: bulunmayan node found:false", () => {
  assert.equal(computeImpact(GRAPH, "file:yok.ts").found, false);
});

test("resolveFileNode: path / id-suffix / basename ile esler", () => {
  assert.equal(resolveFileNode(GRAPH, "a.ts").id, "file:a.ts");
  assert.equal(resolveFileNode(GRAPH, "src/deep/c.ts")?.id, "file:c.ts"); // basename fallback
  assert.equal(resolveFileNode(GRAPH, "nope.ts"), null);
});

test("formatImpact: bulunamayinca yonlendirir, yaprakta guvenli der", () => {
  assert.match(formatImpact({ found: false, target: "z.ts" }), /graph build/);
  assert.match(formatImpact(computeImpact(GRAPH, "file:c.ts")), /Yaprak/);
});
