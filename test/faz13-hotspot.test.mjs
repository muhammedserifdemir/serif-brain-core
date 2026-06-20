// Faz: Symbol Graph — hotspot fuzyonu (churn × merkezilik + bug).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHotspots, formatHotspots } from "../src/query/hotspot.mjs";

// a <- b, a <- c  => a'nin dependents=2. d kimse import etmiyor.
const GRAPH = {
  nodes: [
    { id: "file:a.ts", type: "file", path: "a.ts", module: "core" },
    { id: "file:b.ts", type: "file", path: "b.ts", module: "ui" },
    { id: "file:c.ts", type: "file", path: "c.ts", module: "ui" },
    { id: "file:d.ts", type: "file", path: "d.ts", module: "ui" },
  ],
  edges: [
    { source: "file:b.ts", target: "file:a.ts", type: "imports" },
    { source: "file:c.ts", target: "file:a.ts", type: "imports" },
  ],
};

test("hotspot: churn × (1+dependents) — merkezi+sik degisen ust sirada", () => {
  const churn = new Map([["a.ts", 3], ["d.ts", 3]]);
  const rows = computeHotspots(GRAPH, { churn });
  // a: 3*(1+2)=9 ; d: 3*(1+0)=3  → a once
  assert.equal(rows[0].path, "a.ts");
  assert.equal(rows[0].score, 9);
  assert.equal(rows[0].dependents, 2);
  assert.equal(rows[1].path, "d.ts");
  assert.equal(rows[1].score, 3);
});

test("hotspot: modul bug yogunlugu skora eklenir (BUG_W=2)", () => {
  const churn = new Map([["a.ts", 1]]); // a: 1*(1+2)=3
  const openBugsByModule = new Map([["core", 4]]); // +2*4=8 → 11
  const rows = computeHotspots(GRAPH, { churn, openBugsByModule });
  const a = rows.find((r) => r.path === "a.ts");
  assert.equal(a.open_module_bugs, 4);
  assert.equal(a.score, 11);
});

test("hotspot: churn=0 ve bug=0 olan dosya elenir", () => {
  const churn = new Map([["a.ts", 1]]);
  const rows = computeHotspots(GRAPH, { churn });
  assert.ok(!rows.find((r) => r.path === "b.ts")); // b: churn yok, modul bug yok
  assert.ok(!rows.find((r) => r.path === "d.ts"));
});

test("hotspot: sadece bug var (churn 0) ise yine listelenir", () => {
  const openBugsByModule = new Map([["ui", 3]]);
  const rows = computeHotspots(GRAPH, { openBugsByModule });
  // ui modulundeki b,c,d (churn 0 ama bug>0) gelir; a (core) gelmez
  assert.ok(rows.every((r) => r.module === "ui"));
  assert.ok(rows.length >= 1);
});

test("hotspot: limit uygulanir + format bos durumu yonetir", () => {
  const churn = new Map([["a.ts", 1], ["d.ts", 1]]);
  assert.equal(computeHotspots(GRAPH, { churn, limit: 1 }).length, 1);
  assert.match(formatHotspots([], { days: 30 }), /temiz/);
  assert.match(formatHotspots(computeHotspots(GRAPH, { churn }), { days: 30 }), /tehlike bolgesi/);
});
