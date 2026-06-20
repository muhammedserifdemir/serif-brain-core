// Faz: Symbol Graph — katman ihlali (layers) + PostEdit saglik (check).
import { test } from "node:test";
import assert from "node:assert/strict";
import { findLayerViolations, formatLayers } from "../src/query/layers.mjs";
import { checkFile, formatCheck } from "../src/query/check.mjs";

const GRAPH = {
  nodes: [
    { id: "file:ui/page.ts", type: "file", path: "ui/page.ts", module: "ui" },
    { id: "file:db/conn.ts", type: "file", path: "db/conn.ts", module: "db" },
    { id: "file:svc/api.ts", type: "file", path: "svc/api.ts", module: "svc" },
  ],
  edges: [
    { source: "file:ui/page.ts", target: "file:db/conn.ts", type: "imports" }, // IHLAL: ui->db
    { source: "file:ui/page.ts", target: "file:svc/api.ts", type: "imports" }, // ok
    { source: "file:svc/api.ts", target: "file:db/conn.ts", type: "imports" }, // ok
  ],
};
const RULES = [{ from: "ui", to: "db", reason: "UI veriye dogrudan dokunmasin" }];

test("layers: ui->db ihlali yakalanir, ui->svc yakalanmaz", () => {
  const v = findLayerViolations(GRAPH, RULES);
  assert.equal(v.length, 1);
  assert.equal(v[0].from_file, "ui/page.ts");
  assert.equal(v[0].to_file, "db/conn.ts");
  assert.match(v[0].reason, /dokunmasin/);
});

test("layers: joker '*' kaynak/hedef", () => {
  const v = findLayerViolations(GRAPH, [{ from: "*", to: "db" }]);
  // db'yi import eden herkes: ui/page + svc/api
  assert.equal(v.length, 2);
});

test("layers: kural yoksa bos + format yonlendirir", () => {
  assert.deepEqual(findLayerViolations(GRAPH, []), []);
  assert.match(formatLayers([], { ruleCount: 0 }), /layer_rules/);
  assert.match(formatLayers([], { ruleCount: 1 }), /ihlal yok/);
});

test("check: ui/page.ts katman ihlali raporlar", () => {
  const c = checkFile(GRAPH, "file:ui/page.ts", { rules: RULES });
  assert.equal(c.ok, false);
  assert.equal(c.layer_violations.length, 1);
  assert.ok(c.issues.some((i) => /katman/.test(i)));
});

test("check: temiz dosya ok:true", () => {
  const c = checkFile(GRAPH, "file:svc/api.ts", { rules: RULES });
  assert.equal(c.ok, true);
  assert.match(formatCheck(c), /temiz/);
});

test("check: dongu tespiti + yol", () => {
  const cyc = {
    nodes: [
      { id: "file:a.ts", type: "file", path: "a.ts", module: "m" },
      { id: "file:b.ts", type: "file", path: "b.ts", module: "m" },
    ],
    edges: [
      { source: "file:a.ts", target: "file:b.ts", type: "imports" },
      { source: "file:b.ts", target: "file:a.ts", type: "imports" },
    ],
  };
  const c = checkFile(cyc, "file:a.ts");
  assert.equal(c.in_cycle, true);
  assert.ok(Array.isArray(c.cycle_path) && c.cycle_path.length >= 2);
});

test("check: god-file derece esigi", () => {
  const nodes = [{ id: "file:hub.ts", type: "file", path: "hub.ts", module: "m" }];
  const edges = [];
  for (let i = 0; i < 32; i++) {
    nodes.push({ id: `file:x${i}.ts`, type: "file", path: `x${i}.ts`, module: "m" });
    edges.push({ source: `file:x${i}.ts`, target: "file:hub.ts", type: "imports" });
  }
  const c = checkFile({ nodes, edges }, "file:hub.ts", { god_threshold: 30 });
  assert.equal(c.is_god, true);
  assert.ok(c.degree >= 32);
});

test("check: bulunmayan dosya found:false", () => {
  assert.equal(checkFile(GRAPH, "file:yok.ts").found, false);
});
