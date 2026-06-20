// MCP obje cache'i — hit/miss + mtime/boyut invalidation. Gercek fs (gecici brain).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadObjectsCached, _cacheStats, _clearObjectCache } from "../src/query/object-cache.mjs";

const ROOT = join(tmpdir(), "serif-brain-cache-test");
const BRAIN = join(ROOT, ".serif-brain");
const BUGS = join(BRAIN, "objects", "projects", "testp", "bugs");

function writeBug(id, bodyLen = 1) {
  const fm = `---\nid: ${id}\ntype: bug\nproject: testp\nmodule: infra\ntitle: ${id}\nstatus: open\n---\n${"x".repeat(bodyLen)}\n`;
  writeFileSync(join(BUGS, `${id}.md`), fm);
}

before(() => {
  if (existsSync(ROOT)) rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(BUGS, { recursive: true });
  _clearObjectCache();
});
after(() => { if (existsSync(ROOT)) rmSync(ROOT, { recursive: true, force: true }); });

test("cache: ilk cagri miss, ayni brain ikinci cagri HIT", () => {
  writeBug("bug-1");
  const a = loadObjectsCached(BRAIN);
  assert.equal(a.length, 1);
  assert.equal(_cacheStats().misses, 1);

  const b = loadObjectsCached(BRAIN);
  assert.equal(b.length, 1);
  assert.equal(_cacheStats().hits, 1);   // ikinci cagri cache'ten
  assert.equal(_cacheStats().misses, 1); // yeni miss yok
});

test("cache: yeni dosya eklenince invalidate (count degisir)", () => {
  writeBug("bug-2");
  const r = loadObjectsCached(BRAIN);
  assert.equal(r.length, 2);
  assert.equal(_cacheStats().misses, 2); // imza degisti → yeniden yuklendi
});

test("cache: mevcut dosya degisince invalidate (boyut degisir)", () => {
  const beforeMiss = _cacheStats().misses;
  writeBug("bug-1", 500); // ayni id, farkli boyut → imza degisir
  loadObjectsCached(BRAIN);
  assert.equal(_cacheStats().misses, beforeMiss + 1);
});

test("cache: dosya silinince invalidate", () => {
  rmSync(join(BUGS, "bug-2.md"));
  const beforeMiss = _cacheStats().misses;
  const r = loadObjectsCached(BRAIN);
  assert.equal(r.length, 1);
  assert.equal(_cacheStats().misses, beforeMiss + 1);
});

test("cache: project filtresi cache'li set uzerinde calisir", () => {
  const r = loadObjectsCached(BRAIN, { project: "testp" });
  assert.ok(r.every((o) => o.frontmatter.project === "testp"));
  const none = loadObjectsCached(BRAIN, { project: "yok" });
  assert.equal(none.length, 0);
});
