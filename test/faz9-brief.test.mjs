// Faz: Active Memory — brief cekirdegi (saf compileBrief + MCP brain_brief).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compileBrief, formatBrief } from "../src/query/brief.mjs";
import { createBrainMcp, TOOLS } from "../src/mcp/server.mjs";

// Sahte obje fabrikasi — loadObjects() ciktisi sekli ({frontmatter, body}).
function obj(fm, body = "") {
  return { frontmatter: fm, body, file_path: `/x/${fm.id}.md` };
}

const NOW = new Date("2026-06-20T12:00:00.000Z").getTime();
const recent = new Date(NOW - 2 * 86400000).toISOString();  // 2 gun once
const old = new Date(NOW - 40 * 86400000).toISOString();    // 40 gun once

const FIXTURE = [
  obj({ id: "bug-1", type: "bug", title: "Critical auth bug", status: "open", priority: "critical", module: "auth", updated_at: recent }),
  obj({ id: "bug-2", type: "bug", title: "Low cosmetic", status: "open", priority: "low", module: "auth", updated_at: recent }),
  obj({ id: "bug-3", type: "bug", title: "Closed bug", status: "done", priority: "high", module: "auth", updated_at: recent }),
  obj({ id: "dec-1", type: "decision", title: "Use RLS", status: "active", module: "infra", updated_at: recent }),
  obj({ id: "dec-2", type: "decision", title: "Parked idea", status: "queued", module: "infra", updated_at: old }),
  obj({ id: "dec-3", type: "decision", title: "Another parked", status: "queued", module: "billing", updated_at: recent }),
  obj({ id: "note-1", type: "note", title: "Old note", status: "open", module: "auth", updated_at: old }),
];

test("brief: aktif kritik/yuksek bug sadece (low ve closed haric)", () => {
  const b = compileBrief(FIXTURE, { now: NOW });
  const ids = b.active_bugs.map((r) => r.id);
  assert.deepEqual(ids, ["bug-1"]); // low (bug-2) ve done (bug-3) elenmis
});

test("brief: aktif kararlar + queued ayrimi", () => {
  const b = compileBrief(FIXTURE, { now: NOW });
  assert.deepEqual(b.active_decisions.map((r) => r.id), ["dec-1"]);
  assert.equal(b.parked.count, 2); // dec-2 + dec-3
});

test("brief: son-dokunulan penceresi (7 gun) eski kalemleri eler", () => {
  const b = compileBrief(FIXTURE, { now: NOW, days: 7 });
  const ids = b.recently_touched.map((r) => r.id);
  assert.ok(ids.includes("bug-1"));      // 2 gun once -> icinde
  assert.ok(!ids.includes("note-1"));    // 40 gun once -> disinda
  assert.ok(!ids.includes("dec-3"));     // recent ama queued -> park bolumunde, recently_touched'ta degil (cift-listeleme yok)
});

test("brief: module filtresi sadece o modulu birakir", () => {
  const b = compileBrief(FIXTURE, { now: NOW, module: "auth" });
  assert.deepEqual(b.active_bugs.map((r) => r.id), ["bug-1"]);
  assert.equal(b.active_decisions.length, 0); // dec-1 infra modulunde
  assert.equal(b.parked.count, 0);            // queued'lar infra/billing
  assert.equal(b.scope, "module:auth");
});

test("brief: git sinyali commit basliklarindan modul cikarir", () => {
  const git = { available: true, changedFiles: new Set(["a.ts", "b.ts"]), commitTitles: "fix auth login\nrefactor infra" };
  const b = compileBrief(FIXTURE, { now: NOW, git });
  assert.equal(b.git.changed_files, 2);
  assert.ok(b.git.modules_in_commits.includes("auth"));
  assert.ok(b.git.modules_in_commits.includes("infra"));
});

test("brief: git null ise git alani null", () => {
  const b = compileBrief(FIXTURE, { now: NOW, git: null });
  assert.equal(b.git, null);
});

test("formatBrief: metin ciktisi bos brain'de patlamaz", () => {
  const b = compileBrief([], { now: NOW });
  const text = formatBrief(b);
  assert.match(text, /Aktif kritik\/yuksek bug \(0\)/);
  assert.match(text, /Park kuyrugu \/ queued \(0\)/);
});

test("MCP: brain_brief araci listede + cagrilabilir", async () => {
  assert.ok(TOOLS.find((t) => t.name === "brain_brief"), "brain_brief TOOLS'ta olmali");
  // brainRoot yok ama loadObjects bos proje listesi doner -> bos brief, hata yok.
  const mcp = createBrainMcp({ brainRoot: "/nonexistent-brain-root" });
  const res = mcp.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "brain_brief", arguments: {} } });
  assert.equal(res.result.isError, undefined);
  const payload = JSON.parse(res.result.content[0].text);
  assert.equal(payload.scope, "global");
  assert.ok(Array.isArray(payload.active_bugs));
});

// ── Hafizaya gecmemis commit bolumu ────────────────────────────────────────
// compileBrief SAF kalir (git'e kendisi bakmaz); sayiyi CLI doldurur.
test("brief — uncaptured verilmezse bolum HIC cikmaz (gurultu yok)", () => {
  const b = compileBrief([], { days: 7 });
  assert.equal(b.uncaptured, null);
  assert.ok(!formatBrief(b).includes("Hafizaya gecmemis"), "veri yokken baslik basilmamali");
});

test("brief — uncaptured verilirse sayi + ilk kayitlar + komut basilir", () => {
  const b = compileBrief([], {
    days: 7,
    uncaptured: { count: 5, days: 14, top: [{ type: "bug", title: "null deref" }] },
  });
  const out = formatBrief(b);
  assert.match(out, /Hafizaya gecmemis commit \(5\)/);
  assert.match(out, /\[bug\] null deref/);
  assert.match(out, /… \+4 daha/);
  assert.match(out, /capture --days 14 --apply/);
});

// ── Sinir: brief her oturuma girer, sinirsiz buyuyemez ─────────────────────
// Bu uc liste SINIRSIZDI; `limit` parametresi vardi ama yalniz iki liste onu
// kullaniyordu. Olcum (5000 kayit): 6.297 token → 180 token.
test("brief — aktif listeler 'limit' ile sinirli, cikti olcekle patlamaz", () => {
  const mk = (i) => ({ frontmatter: {
    id: `bug-x${i}`, type: "bug", title: `Bug ${i}`, status: "open", priority: "critical",
    module: ["core"], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    relations: { files: [] }, tags: [] } });
  const kucuk = formatBrief(compileBrief(Array.from({ length: 10 }, (_, i) => mk(i)), { days: 7 }));
  const buyuk = formatBrief(compileBrief(Array.from({ length: 5000 }, (_, i) => mk(i)), { days: 7 }));
  assert.ok(buyuk.length < kucuk.length * 1.5,
    `5000 kayitta cikti patlamamali (kucuk ${kucuk.length}, buyuk ${buyuk.length})`);
});

test("brief — kirpilan sayi GIZLENMEZ ('+N daha' + nasil gorulecegi)", () => {
  const mk = (i) => ({ frontmatter: {
    id: `bug-y${i}`, type: "bug", title: `Bug ${i}`, status: "open", priority: "critical",
    module: ["core"], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    relations: { files: [] }, tags: [] } });
  const b = compileBrief(Array.from({ length: 50 }, (_, i) => mk(i)), { days: 7, limit: 5 });
  assert.equal(b.totals.bugs, 50, "TOPLAM kaybolmamali");
  assert.equal(b.active_bugs.length, 5);
  const out = formatBrief(b);
  assert.match(out, /Aktif kritik\/yuksek bug \(50\)/, "baslikta gercek sayi durmali");
  assert.match(out, /\+45 daha/, "sessiz kirpma 'hepsi bu' gibi okunur");
  assert.match(out, /serif-brain search/, "nasil gorulecegini soylemeli");
});
