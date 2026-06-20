// Faz: Active Memory — touch cekirdegi (PreEdit fisiltisi) + config-farkinda modul cozumu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compileTouch, formatTouch } from "../src/query/touch.mjs";
import { ownerOfConfigured, ownerOf } from "../src/scanner/module-owner.mjs";
import { createBrainMcp, TOOLS } from "../src/mcp/server.mjs";

function obj(fm, body = "") {
  return { frontmatter: fm, body, file_path: `/x/${fm.id}.md` };
}

const FIXTURE = [
  obj({ id: "bug-open", type: "bug", title: "Null deref auth", status: "open", priority: "high", module: "auth",
        relations: { files: ["src/auth/login.ts"] } }),
  obj({ id: "bug-closed", type: "bug", title: "Eski RLS bug", status: "done", priority: "critical", module: "auth" }),
  obj({ id: "dec-active", type: "decision", title: "RLS zorunlu", status: "active", module: "auth" }),
  obj({ id: "dec-rejected", type: "decision", title: "Reddedilen", status: "rejected", module: "auth" }),
  obj({ id: "bug-other", type: "bug", title: "Billing bug", status: "open", priority: "high", module: "billing" }),
];

test("touch: relations.files dogrudan dosya bagi yakalanir", () => {
  const t = compileTouch(FIXTURE, { relPath: "src/auth/login.ts", module: "auth" });
  assert.ok(t.file_hits.find((r) => r.id === "bug-open"), "login.ts'e bagli bug file_hits'te");
  // file_hit olan bug, module_bugs'ta tekrar gelmemeli (dedup)
  assert.ok(!t.module_bugs.find((r) => r.id === "bug-open"));
});

test("touch: kapali bug 'yara izi' olarak modulde gelir + acik once siralanir", () => {
  const t = compileTouch(FIXTURE, { relPath: "src/auth/other.ts", module: "auth" });
  const ids = t.module_bugs.map((r) => r.id);
  assert.deepEqual(ids, ["bug-open", "bug-closed"]); // acik once, kapali sonra
  assert.equal(t.module_bugs.find((r) => r.id === "bug-closed").closed, true);
});

test("touch: reddedilen/arsiv kararlar listelenmez", () => {
  const t = compileTouch(FIXTURE, { module: "auth" });
  const ids = t.module_decisions.map((r) => r.id);
  assert.ok(ids.includes("dec-active"));
  assert.ok(!ids.includes("dec-rejected"));
});

test("touch: baska modulun kayitlari sizmaz", () => {
  const t = compileTouch(FIXTURE, { module: "auth" });
  assert.ok(!t.module_bugs.find((r) => r.id === "bug-other"));
});

test("touch: ilgisiz dosya -> empty + temiz mesaj", () => {
  const t = compileTouch(FIXTURE, { relPath: "src/unknown/x.ts", module: "shared" });
  assert.equal(t.empty, true);
  assert.match(formatTouch(t), /temiz/);
});

test("ownerOfConfigured: config.module_paths once, en uzun prefix kazanir", () => {
  const config = { module_paths: { "packages/": "shared", "packages/billing/": "billing" } };
  assert.equal(ownerOfConfigured("packages/billing/iyzico.ts", config), "billing");
  assert.equal(ownerOfConfigured("packages/util.ts", config), "shared");
});

test("ownerOfConfigured: config yoksa hardcoded ownerOf'a duser", () => {
  assert.equal(ownerOfConfigured("shared/x.ts", null), ownerOf("shared/x.ts"));
  assert.equal(ownerOfConfigured("shared/x.ts", null), "shared");
});

test("MCP: brain_touch listede + cagrilabilir", () => {
  assert.ok(TOOLS.find((t) => t.name === "brain_touch"));
  const mcp = createBrainMcp({ brainRoot: "/nonexistent" });
  const res = mcp.handle({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "brain_touch", arguments: { module: "auth" } } });
  assert.equal(res.result.isError, undefined);
  const payload = JSON.parse(res.result.content[0].text);
  assert.equal(payload.empty, true); // brain yok -> bos
});
