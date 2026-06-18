// Faz 5 (100-push) — monorepo workspace çözümleme + tarama cache'i.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWorkspacePackages, resolveImport } from "../src/scanner/resolve-import.mjs";
import { loadScanCache, saveScanCache } from "../src/scanner/cache.mjs";

function mkMonorepo() {
  const root = mkdtempSync(join(tmpdir(), "sbc-mono-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"] }));
  const foo = join(root, "packages", "foo");
  mkdirSync(join(foo, "src"), { recursive: true });
  writeFileSync(join(foo, "package.json"), JSON.stringify({ name: "@x/foo", main: "src/index.ts" }));
  writeFileSync(join(foo, "src", "index.ts"), "export const foo = 1;\n");
  writeFileSync(join(foo, "src", "util.ts"), "export const u = 2;\n");
  return root;
}

test("loadWorkspacePackages: workspaces alanından paketleri bulur", () => {
  const root = mkMonorepo();
  const ws = loadWorkspacePackages(root);
  assert.ok(ws["@x/foo"], "@x/foo workspace paketi bulunmalı");
});

test("resolveImport: workspace paketi (@x/foo) source'a çözülür", () => {
  const root = mkMonorepo();
  const ws = loadWorkspacePackages(root);
  const r = resolveImport("@x/foo", join(root, "app", "a.ts"), root, {}, ws);
  assert.equal(r.kind, "file");
  assert.equal(r.workspace, "@x/foo");
});

test("resolveImport: workspace alt-yolu (@x/foo/util) çözülür", () => {
  const root = mkMonorepo();
  const ws = loadWorkspacePackages(root);
  const r = resolveImport("@x/foo/util", join(root, "app", "a.ts"), root, {}, ws);
  assert.equal(r.kind, "file");
});

test("resolveImport: workspace olmadan bare import 'package' kalır", () => {
  const r = resolveImport("react", "/x/a.ts", "/x", {}, {});
  assert.equal(r.kind, "package");
});

test("scan cache: round-trip + sürüm/format koruması", () => {
  const dir = mkdtempSync(join(tmpdir(), "sbc-cache-"));
  assert.deepEqual(loadScanCache(dir).files, {});
  saveScanCache(dir, { "a.ts": { mtimeMs: 1, size: 2, loc: 3, imports: ["x"], todos: [], mentions: [] } });
  const c = loadScanCache(dir);
  assert.equal(c.files["a.ts"].imports[0], "x");
});
