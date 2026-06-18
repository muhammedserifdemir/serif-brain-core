// Faz 2 testleri — arama çekirdeği + MCP JSON-RPC protokolü (fs gerektirmez).
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchObjects, toResult } from "../src/query/search.mjs";
import { createBrainMcp, TOOLS } from "../src/mcp/server.mjs";

const OBJS = [
  { frontmatter: { id: "bug-1", type: "bug", title: "Login fails on Safari", status: "open", priority: "high", module: "auth", updated_at: "2026-06-10T00:00:00Z" }, body: "Safari cookie issue" },
  { frontmatter: { id: "decision-1", type: "decision", title: "Use RLS for tenants", status: "active", priority: "critical", module: ["infra"], updated_at: "2026-06-15T00:00:00Z" }, body: "Row level security chosen" },
  { frontmatter: { id: "bug-2", type: "bug", title: "Slow dashboard", status: "done", priority: "low", module: "dashboard", updated_at: "2026-05-01T00:00:00Z" }, body: "perf" },
];

test("searchObjects: metin sorgusu başlık+gövdede arar (AND)", () => {
  const r = searchObjects(OBJS, { text: "safari" });
  assert.equal(r.length, 1);
  assert.equal(r[0].frontmatter.id, "bug-1");
});

test("searchObjects: type filtresi", () => {
  const r = searchObjects(OBJS, { type: "bug" });
  assert.equal(r.length, 2);
  assert.ok(r.every((o) => o.frontmatter.type === "bug"));
});

test("searchObjects: metin yoksa önceliğe göre sıralar (critical önce)", () => {
  const r = searchObjects(OBJS, {});
  assert.equal(r[0].frontmatter.priority, "critical");
});

test("searchObjects: status çoklu filtre + limit", () => {
  const r = searchObjects(OBJS, { status: ["open", "active"], limit: 1 });
  assert.equal(r.length, 1);
});

test("searchObjects: module filtresi (array module dahil)", () => {
  const r = searchObjects(OBJS, { module: "infra" });
  assert.equal(r.length, 1);
  assert.equal(r[0].frontmatter.id, "decision-1");
});

test("toResult: kompakt şekil + snippet", () => {
  const r = toResult(OBJS[0], { snippet: true });
  assert.equal(r.id, "bug-1");
  assert.deepEqual(r.module, ["auth"]);
  assert.equal(r.snippet, "Safari cookie issue");
});

test("MCP: initialize protocolVersion + serverInfo döner", () => {
  const { handle } = createBrainMcp({ brainRoot: "/tmp/x", version: "9.9.9" });
  const res = handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(res.result.serverInfo.name, "serif-brain");
  assert.equal(res.result.serverInfo.version, "9.9.9");
  assert.ok(res.result.protocolVersion);
});

test("MCP: tools/list araçları listeler", () => {
  const { handle } = createBrainMcp({ brainRoot: "/tmp/x" });
  const res = handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const names = res.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["brain_context", "brain_get", "brain_related", "brain_search"]);
  assert.equal(TOOLS.length, 4);
});

test("MCP: notifications/* için yanıt yok (null)", () => {
  const { handle } = createBrainMcp({ brainRoot: "/tmp/x" });
  assert.equal(handle({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
});

test("MCP: bilinmeyen method -32601", () => {
  const { handle } = createBrainMcp({ brainRoot: "/tmp/x" });
  const res = handle({ jsonrpc: "2.0", id: 5, method: "foo/bar" });
  assert.equal(res.error.code, -32601);
});
