// Faz 3 testleri — YAML round-trip, scanner sınıflandırma/import parse, analyze
// entry-point + otomasyon mantığı. Hepsi saf fonksiyon (fs fixture yok).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYaml, serializeYaml } from "../src/markdown/yaml.mjs";
import { classifyFile } from "../src/scanner/scan-files.mjs";
import { parseImports } from "../src/scanner/parse-imports.mjs";
import { analyzeGraph } from "../src/graph/analyze.mjs";

test("YAML: round-trip (# ve : içeren string tırnaklanır, geri okunur)", () => {
  const obj = { title: "Release 2.0 (fix #123)", url: "https://x.co/a", tags: ["a", "b"], n: 3 };
  const round = parseYaml(serializeYaml(obj));
  assert.equal(round.title, "Release 2.0 (fix #123)");
  assert.equal(round.url, "https://x.co/a");
  assert.deepEqual(round.tags, ["a", "b"]);
  assert.equal(round.n, 3);
});

test("YAML: nested block + array round-trip", () => {
  const obj = { relations: { bugs: ["bug-1"], decisions: [] }, source: { kind: "manual" } };
  const round = parseYaml(serializeYaml(obj));
  assert.deepEqual(round.relations.bugs, ["bug-1"]);
  assert.equal(round.source.kind, "manual");
});

test("scanner: classifyFile route/test/component/source", () => {
  assert.equal(classifyFile("app/dashboard/page.tsx"), "route");
  assert.equal(classifyFile("app/x/route.ts"), "route");
  assert.equal(classifyFile("lib/foo.test.ts"), "test");
  assert.equal(classifyFile("app/components/Button.tsx"), "component");
  assert.equal(classifyFile("lib/util.ts"), "source");
});

test("scanner: parseImports — es6/dynamic/require + yorum farkındalığı", () => {
  const code = `
    import a from "@/lib/a";
    import { b } from './b';
    const c = require("c");
    const d = await import("d");
    // import x from "ignored-comment";
    export * from "@/lib/e";
  `;
  const set = new Set(parseImports(code));
  assert.ok(set.has("@/lib/a"));
  assert.ok(set.has("./b"));
  assert.ok(set.has("c"));
  assert.ok(set.has("d"));
  assert.ok(set.has("@/lib/e"));
  assert.ok(!set.has("ignored-comment"), "yorumdaki import sayılmamalı");
});

function mkGraph(nodes, edges = []) {
  return { nodes, edges, stats: {} };
}

test("analyze: entry-point dosyalar orphan SAYILMAZ (genişletilmiş)", () => {
  const nodes = [
    { id: "file:app/page.tsx", type: "route", path: "app/page.tsx", label: "page.tsx" },
    { id: "file:instrumentation.ts", type: "file", path: "instrumentation.ts", label: "instrumentation.ts" },
    { id: "file:app/global-error.tsx", type: "file", path: "app/global-error.tsx", label: "global-error.tsx" },
    { id: "file:lib/queue.worker.ts", type: "file", path: "lib/queue.worker.ts", label: "queue.worker.ts" },
    { id: "file:lib/dead.ts", type: "file", path: "lib/dead.ts", label: "dead.ts" },
  ];
  const a = analyzeGraph(mkGraph(nodes));
  const orphanPaths = a.orphan_files.map((o) => o.path);
  assert.ok(!orphanPaths.includes("instrumentation.ts"), "instrumentation entry-point");
  assert.ok(!orphanPaths.includes("app/global-error.tsx"), "global-error entry-point");
  assert.ok(!orphanPaths.includes("lib/queue.worker.ts"), "worker entry-point");
  assert.ok(orphanPaths.includes("lib/dead.ts"), "gerçek orphan kalmalı");
});

test("analyze: config entrypoint_patterns ek muafiyet ekler", () => {
  const nodes = [{ id: "file:config/monitoring.ts", type: "file", path: "config/monitoring.ts", label: "monitoring.ts" }];
  const without = analyzeGraph(mkGraph(nodes));
  assert.ok(without.orphan_files.some((o) => o.path === "config/monitoring.ts"));
  const withCfg = analyzeGraph(mkGraph(nodes), { entrypoint_patterns: ["^config/"] });
  assert.ok(!withCfg.orphan_files.some((o) => o.path === "config/monitoring.ts"));
});

test("analyze: otomasyon objeleri stale sinyalinden dışlanır + sayılır", () => {
  const old = "2020-01-01T00:00:00Z";
  const nodes = [
    { id: "decision:decision-bridge-claude-fix-x", type: "decision", status: "active", updated_at: old, label: "churn" },
    { id: "decision:decision-real-1", type: "decision", status: "active", updated_at: old, label: "real" },
  ];
  const a = analyzeGraph(mkGraph(nodes));
  const staleIds = a.stale_active_decisions.map((d) => d.id);
  assert.ok(!staleIds.includes("decision-bridge-claude-fix-x"), "otomasyon stale'den hariç");
  assert.ok(staleIds.includes("decision-real-1"), "gerçek karar stale'de");
  assert.equal(a.automation_objects, 1);
});
