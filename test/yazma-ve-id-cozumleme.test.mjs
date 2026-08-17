// (1) MCP YAZMA araclari — sunucu uzun sure salt-okunurdu (14 okuma / 0 yazma):
//     oturumda ogrenilen sey ancak insan "kaydet" derse hafizaya geciyordu.
// (2) ID COZUMLEME — `close <id>` objeyi ICERMEYEN bos bir proje dizini
//     yuzunden bile `--project_id` istiyordu. Id benzersiz, disk cevabi
//     biliyor: karar verilebilir durumda karar verilmiyordu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrainMcp } from "../src/mcp/server.mjs";
import { createObject, closeObject } from "../src/markdown/write-ops.mjs";
import { locateObject, typeOfId, targetProject } from "../src/markdown/locate.mjs";

const SUBDIRS = ["bugs", "decisions", "plans", "notes", "sessions", "sprints"];

function mkBrain(projects = ["tek"]) {
  const root = mkdtempSync(join(tmpdir(), "sbc-yazma-"));
  const brainRoot = join(root, ".serif-brain");
  for (const p of projects) {
    for (const d of SUBDIRS) mkdirSync(join(brainRoot, "objects", "projects", p, d), { recursive: true });
  }
  mkdirSync(join(brainRoot, "indexes"), { recursive: true });
  writeFileSync(join(brainRoot, "config.yaml"),
    "projects:\n" + projects.map(p => `  - id: ${p}\n    active: true\n`).join("") +
    "valid_modules:\n  - core\n  - unknown\n" +
    "valid_status:\n  - open\n  - active\n  - done\n  - queued\n  - in_progress\n  - blocked\n  - rejected\n  - archived\n" +
    "valid_priority:\n  - critical\n  - high\n  - medium\n  - low\n" +
    "valid_severity:\n  - critical\n  - high\n  - medium\n  - low\n");
  return { root, brainRoot };
}

const config = (projects) => ({ projects: projects.map(id => ({ id, active: true })) });

// ── write-ops cekirdegi ─────────────────────────────────────────────────────

test("createObject: bug yazar, dosya gercekten olusur", () => {
  const { root, brainRoot } = mkBrain();
  const r = createObject({
    brainRoot, projectRoot: root, config: config(["tek"]),
    type: "bug", title: "null deref girişte", module: "core", files: [],
  });
  assert.equal(r.ok, true);
  assert.ok(existsSync(r.path), "dosya diskte olmali");
  const raw = readFileSync(r.path, "utf8");
  assert.match(raw, /type: bug/);
  assert.match(raw, /status: open/);
  assert.match(raw, /null deref/);
});

test("createObject: ayni baslik ikinci kez → hata + ALTERNATIF id onerir", () => {
  const { root, brainRoot } = mkBrain();
  const opts = { brainRoot, projectRoot: root, config: config(["tek"]), type: "bug", title: "ayni", files: [] };
  assert.equal(createObject(opts).ok, true);
  const r2 = createObject(opts);
  assert.equal(r2.ok, false);
  assert.match(r2.suggestId, /-2$/, "cikmaz sokak degil, kullanilabilir bir id vermeli");
});

test("createObject: record status:done DOGAR (kapatilmayi beklemez)", () => {
  const { root, brainRoot } = mkBrain();
  const r = createObject({ brainRoot, projectRoot: root, config: config(["tek"]), type: "record", title: "is bitti", files: [] });
  assert.equal(r.status, "done");
});

// ── id cozumleme ────────────────────────────────────────────────────────────

test("locateObject: BOS proje dizini belirsizlik SAYILMAZ", () => {
  const { root, brainRoot } = mkBrain(["dolu", "bos"]);
  const r = createObject({
    brainRoot, projectRoot: root, config: config(["dolu"]),
    type: "bug", title: "sadece dolu projede", files: [],
  });
  const loc = locateObject(brainRoot, r.id);
  assert.deepEqual(loc.matches, ["dolu"], "obje dosyasi NEREDE ise orasi");
  assert.equal(loc.projects.length, 2, "iki proje dizini var — ama biri objeyi icermiyor");
  assert.equal(loc.project, "dolu");
});

test("closeObject: coklu projede --project_id OLMADAN kapatir (id benzersiz)", () => {
  const { root, brainRoot } = mkBrain(["dolu", "bos"]);
  const r = createObject({ brainRoot, projectRoot: root, config: config(["dolu"]), type: "bug", title: "kapat beni", files: [] });
  const c = closeObject({ brainRoot, id: r.id, note: "cozuldu" });
  assert.equal(c.ok, true, c.error);
  assert.equal(c.status, "done");
  assert.match(readFileSync(c.path, "utf8"), /## Tamamlanma \(\d{4}-\d{2}-\d{2}\)/);
});

test("closeObject: id GERCEKTEN iki projede varsa belirsizlik bildirilir", () => {
  const { root, brainRoot } = mkBrain(["a", "b"]);
  const sabitId = "bug-20260811-ayni-id";
  for (const p of ["a", "b"]) {
    createObject({ brainRoot, projectRoot: root, config: config([p]), projectId: p, type: "bug", title: "x", id: sabitId, files: [] });
  }
  const c = closeObject({ brainRoot, id: sabitId });
  assert.equal(c.ok, false);
  assert.match(c.error, /birden fazla projede/, "gercek belirsizlikte SORMALI");
  assert.deepEqual(c.matches.sort(), ["a", "b"]);
});

test("closeObject: zaten kapali obje noop (hata degil)", () => {
  const { root, brainRoot } = mkBrain();
  const r = createObject({ brainRoot, projectRoot: root, config: config(["tek"]), type: "record", title: "zaten done", files: [] });
  const c = closeObject({ brainRoot, id: r.id });
  assert.equal(c.ok, true);
  assert.equal(c.noop, true);
});

test("typeOfId / targetProject sozlesmesi", () => {
  assert.equal(typeOfId("bug-x"), "bug");
  assert.equal(typeOfId("plan-x"), "plan");
  assert.equal(typeOfId("saçma"), null);
  const { brainRoot } = mkBrain(["tek"]);
  assert.equal(targetProject(brainRoot, config(["tek"])), "tek");
  assert.equal(targetProject(brainRoot, config(["tek"]), "acik"), "acik", "acik flag her zaman kazanir");
});

// ── MCP yuzeyi ──────────────────────────────────────────────────────────────

function mcpCall(brainRoot, name, args) {
  const { handle } = createBrainMcp({ brainRoot });
  const res = handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
  return res.result;
}

test("MCP brain_add: hafizaya yazar ve sonucu dondurur", () => {
  const { brainRoot } = mkBrain();
  const out = mcpCall(brainRoot, "brain_add", { type: "decision", title: "MCP uzerinden karar", module: "core", files: [] });
  const payload = JSON.parse(out.content[0].text);
  assert.equal(payload.ok, true);
  assert.ok(existsSync(payload.path));
});

test("MCP brain_add: yazilan kayit AYNI oturumda brain_search ile bulunur (cache bayat kalmaz)", () => {
  const { brainRoot } = mkBrain();
  const { handle } = createBrainMcp({ brainRoot });
  const call = (name, args) => JSON.parse(
    handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }).result.content[0].text);

  call("brain_search", { text: "kubbe" }); // cache'i doldur (bos brain)
  call("brain_add", { type: "bug", title: "kubbe cokmesi", module: "core", files: [] });
  const hits = call("brain_search", { text: "kubbe" });
  assert.equal(hits.count, 1, "yazan taraf kendi yazdigini gormeli");
});

test("MCP brain_close: kapatir; olmayan id JSON-RPC HATASI verir (sessiz basari yok)", () => {
  const { brainRoot } = mkBrain();
  const { handle } = createBrainMcp({ brainRoot });
  const added = JSON.parse(handle({
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name: "brain_add", arguments: { type: "bug", title: "kapanacak", files: [] } },
  }).result.content[0].text);

  const closed = JSON.parse(handle({
    jsonrpc: "2.0", id: 2, method: "tools/call",
    params: { name: "brain_close", arguments: { id: added.id, note: "duzeltildi" } },
  }).result.content[0].text);
  assert.equal(closed.status, "done");

  const err = handle({
    jsonrpc: "2.0", id: 3, method: "tools/call",
    params: { name: "brain_close", arguments: { id: "bug-yok-boyle-bir-sey" } },
  });
  assert.ok(err.result?.isError || err.error, "basarisiz yazma sessiz kalmamali");
});

// ── GOVDE YAZMA ─────────────────────────────────────────────────────────────
// Kok neden (2026-08-15): createObject govde parametresi KABUL ETMIYORDU; her
// kayit statik bos sablonla doguyordu. record ayrica 'done' dogdugu icin
// closeObject'in `already` dali onu noop'a dusuruyor, yani record hicbir kod
// yolundan icerik alamiyordu. Olcum: record %61 bos (61/100), decision %10
// (19/183) — 6 katlik fark tam olarak bu iki satirin sonucu.

test("createObject: body verilince govde DISKE yazilir (bos sablon degil)", () => {
  const { root, brainRoot } = mkBrain();
  const r = createObject({
    brainRoot, projectRoot: root, config: config(["tek"]),
    type: "record", title: "gemini default gecisi", module: "core", files: [],
    body: "## Ne yapildi\nTum modullerde default model degistirildi.\n\n## Kanit\nbenchmark 12/12 gecti.",
  });
  assert.equal(r.ok, true);
  const raw = readFileSync(r.path, "utf8");
  assert.match(raw, /benchmark 12\/12 gecti/, "verilen govde diskte olmali");
  assert.doesNotMatch(raw, /## Sonuc \/ Kanit\n- \n/, "bos sablon govdenin yanina yapismamali");
  assert.equal(r.govdesiz, false);
});

test("createObject: body verilmezse ESKI davranis birebir korunur", () => {
  const { root, brainRoot } = mkBrain();
  const r = createObject({
    brainRoot, projectRoot: root, config: config(["tek"]),
    type: "record", title: "govdesiz kayit", module: "core", files: [],
  });
  assert.equal(r.ok, true);
  assert.equal(r.govdesiz, true, "cagirana govdesiz oldugu bildirilmeli");
  assert.match(readFileSync(r.path, "utf8"), /## Ne yapildi/, "sablon eskisi gibi yazilmali");
});

test("closeObject: 'done' DOGAN record'a not eklenebilir (artik noop degil)", () => {
  const { root, brainRoot } = mkBrain();
  const r = createObject({
    brainRoot, projectRoot: root, config: config(["tek"]),
    type: "record", title: "sonradan doldurulacak", module: "core", files: [],
  });
  assert.equal(r.status, "done", "record done dogar — testin dayanagi bu");

  const c = closeObject({ brainRoot, id: r.id, note: "asil icerik buraya" });
  assert.equal(c.noop, false, "not verilmisse noop'a dusmemeli");
  assert.equal(c.appendedToClosed, true);
  const raw = readFileSync(r.path, "utf8");
  assert.match(raw, /asil icerik buraya/, "not gercekten diske yazilmali");
  assert.match(raw, /## Ek Not/, "kapali kayda eklenen not 'Tamamlanma' degildir");
});

test("closeObject: notsuz cagri kapali kayitta HALA noop (close.mjs sozlesmesi)", () => {
  const { root, brainRoot } = mkBrain();
  const r = createObject({
    brainRoot, projectRoot: root, config: config(["tek"]),
    type: "record", title: "dokunulmayacak", module: "core", files: [],
  });
  const c = closeObject({ brainRoot, id: r.id });
  assert.equal(c.noop, true, "eski noop davranisi korunmali");
});

test("closeObject: kapali kayda not eklemek completed_at'i BUGUNE kaydirmaz", () => {
  const { root, brainRoot } = mkBrain();
  const r = createObject({
    brainRoot, projectRoot: root, config: config(["tek"]),
    type: "bug", title: "once kapanan", module: "core", files: [],
  });
  const ilk = closeObject({ brainRoot, id: r.id, note: "kapandi", now: new Date("2026-01-10T10:00:00Z") });
  assert.equal(ilk.completed_at, "2026-01-10");
  const sonra = closeObject({ brainRoot, id: r.id, note: "ek bilgi", now: new Date("2026-08-15T10:00:00Z") });
  assert.equal(sonra.completed_at, "2026-01-10", "is ocakta bitti; agustos notu bunu degistirmemeli");
});

test("MCP brain_add: body parametresi ucdan uca gecer", () => {
  const { brainRoot } = mkBrain();
  const { handle } = createBrainMcp({ brainRoot });
  const added = JSON.parse(handle({
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name: "brain_add", arguments: {
      type: "decision", title: "mcp govde testi", files: [], body: "MCP uzerinden yazilan govde.",
    } },
  }).result.content[0].text);
  assert.equal(added.govdesiz, false);
  assert.match(readFileSync(added.path, "utf8"), /MCP uzerinden yazilan govde/);
});
