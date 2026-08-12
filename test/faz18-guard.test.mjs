// guard — edit-oncesi birlesik brifing (composeGuard SAF besteci).
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeGuard, formatGuard } from "../src/query/guard.mjs";

const baseMemory = { module_decisions: [], module_bugs: [], file_hits: [] };

// "TEMIZ" ile "KAYIT YOK" AYRI SEYLERDIR (2026-08-12'de ayrildi).
// Olcum: kapi degisen dosyalarin %78'inde susuyor ve sebebi risk olmamasi
// DEGIL, hafiza kapsaminin %5,8 olmasi. Ikisini ayni etiketle raporlamak
// "sorun bulamadim" ile "sorun aramadim"i ayni gostermektir — kullanici
// olmayan bir guvence alir.
test("guard: HIC kayit yoksa verdict 'KAYIT YOK' (yanlis guvence verilmez)", () => {
  const g = composeGuard({ file: "a.ts", module: "m", risk: { level: "low", score: 0 }, memory: baseMemory, impact: null, signatures: [] });
  assert.equal(g.verdict, "KAYIT YOK");
  assert.equal(g.hafiza_var, false, "makine tuketicileri metne bakmak zorunda kalmasin");
  const metin = formatGuard(g);
  assert.match(metin, /HIC kayit yok/);
  assert.match(metin, /serif-brain add/, "eyleme donusen komut vermeli");
});

test("guard: KAYIT VAR ama risk yoksa verdict TEMIZ (gercek guvence)", () => {
  // NOT: guard `closed` BAYRAGINA bakar (status'a degil) — compileTouch onu uretir.
  const memory = { module_decisions: [], module_bugs: [{ id: "b1", title: "eski bug", closed: true }], file_hits: [] };
  const g = composeGuard({ file: "a.ts", module: "m", risk: { level: "low", score: 0 }, memory, impact: null, signatures: [] });
  assert.equal(g.verdict, "TEMIZ");
  assert.equal(g.hafiza_var, true);
  assert.match(formatGuard(g), /Bilinen kisit\/risk yok/);
});

test("guard: aktif karar -> DIKKAT + must_not_violate", () => {
  const memory = {
    module_decisions: [{ id: "d1", title: "RLS zorunlu", status: "active" }, { id: "d2", title: "eski", status: "rejected" }],
    module_bugs: [],
    file_hits: [],
  };
  const g = composeGuard({ file: "a.ts", module: "auth", risk: { level: "low", score: 1 }, memory });
  assert.equal(g.verdict, "DIKKAT");
  assert.equal(g.must_not_violate.length, 1); // sadece active
  assert.equal(g.must_not_violate[0].id, "d1");
});

test("guard: acik bug vs yara izi ayrimi", () => {
  const memory = {
    module_decisions: [],
    module_bugs: [
      { id: "b1", title: "acik", priority: "high", closed: false },
      { id: "b2", title: "cozulmus", priority: "critical", closed: true },
    ],
    file_hits: [],
  };
  const g = composeGuard({ file: "a.ts", module: "m", risk: { level: "medium", score: 8 }, memory });
  assert.equal(g.open_bugs.length, 1);
  assert.equal(g.scars.length, 1);
  assert.equal(g.open_bugs[0].id, "b1");
  assert.equal(g.scars[0].id, "b2");
});

test("guard: blast-radius >=10 flag + impact ozeti", () => {
  const impact = { direct_dependents: ["x", "y"], transitive_dependent_count: 17, affected_modules: ["ui", "core"], is_leaf: false };
  const g = composeGuard({ file: "hub.ts", module: "core", risk: { level: "low", score: 2 }, memory: baseMemory, impact, signatures: [] });
  assert.equal(g.verdict, "DIKKAT");
  assert.equal(g.blast_radius.transitive, 17);
  assert.ok(g.flags.some((f) => /17 dosya/.test(f)));
});

test("guard: yaprak dosya format", () => {
  const impact = { direct_dependents: [], transitive_dependent_count: 0, affected_modules: [], is_leaf: true };
  const g = composeGuard({ file: "leaf.ts", module: "m", risk: { level: "low", score: 0 }, memory: baseMemory, impact });
  assert.equal(g.blast_radius.is_leaf, true);
  assert.match(formatGuard(g), /Yaprak/);
});

test("guard: imza eslesmesi DIKKAT'e katkida bulunur", () => {
  const sigs = [{ name: "rls-eksik", severity: "high", line: 12, message: "RLS?" }];
  const g = composeGuard({ file: "a.ts", module: "m", risk: { level: "low", score: 0 }, memory: baseMemory, signatures: sigs });
  assert.equal(g.verdict, "DIKKAT");
  assert.equal(g.signature_hits.length, 1);
  assert.match(formatGuard(g), /rls-eksik/);
});

test("guard: high risk tek basina DIKKAT", () => {
  const g = composeGuard({ file: "a.ts", module: "m", risk: { level: "high", score: 22 }, memory: baseMemory });
  assert.equal(g.verdict, "DIKKAT");
  assert.ok(g.flags.some((f) => /risk:high/.test(f)));
});
