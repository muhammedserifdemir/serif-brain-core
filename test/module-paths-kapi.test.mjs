// KAPI: config.yaml'daki `module_paths` gercekten modul atifina donusuyor mu?
//
// Neden bu test var: bug-20260803'te `ownerOfConfigured` yazilmisti ama graph
// build / scan code onu HIC cagirmiyordu — yani config'e kural yazmak grafi
// degistirmiyordu ve yazan kisi hicbir hata gormuyordu. Duzeltildi (9475233),
// ama hardcoded haritayi dogrulayan bir test hic olmadigi icin ayni sessiz
// regresyon her an geri gelebilirdi. Bu dosya o bosluktur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGraph } from "../src/graph/build.mjs";
import { resolveModule, ownerOfConfigured, isKnownModule, UNKNOWN_MODULE } from "../src/scanner/module-owner.mjs";

// Kural yazilan yol SerifX360 hardcoded listesinde YOK — yani modul dogru
// cikiyorsa bunun tek kaynagi config olabilir (tesadufi eslesme yok).
const MODULE_PATHS = { "paketler/oyunlar/": "oyunlar", "paketler/oyunlar/motor/": "motor" };

function mkProject() {
  const root = mkdtempSync(join(tmpdir(), "sbc-modpath-"));
  mkdirSync(join(root, "paketler", "oyunlar", "motor"), { recursive: true });
  mkdirSync(join(root, ".serif-brain", "objects"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "modpath" }));
  writeFileSync(join(root, "paketler", "oyunlar", "a.mjs"), 'import { b } from "./b.mjs";\nexport const a = b;\n');
  writeFileSync(join(root, "paketler", "oyunlar", "b.mjs"), "export const b = 1;\n");
  writeFileSync(join(root, "paketler", "oyunlar", "motor", "c.mjs"), "export const c = 3;\n");
  return root;
}

async function buildWith(config) {
  const root = mkProject();
  const graph = await buildGraph({
    projectRoot: root,
    brainRoot: join(root, ".serif-brain"),
    projectId: "modpath",
    config,
  });
  const fileNodes = graph.nodes.filter((n) => n.type === "file");
  const moduleNodes = graph.nodes.filter((n) => n.type === "module").map((n) => n.label).sort();
  const moduleOf = (rel) => fileNodes.find((n) => n.path === rel)?.module;
  return { graph, moduleNodes, moduleOf };
}

test("graph build: config'teki module_paths dosya dugumune yansir", async () => {
  const { moduleOf } = await buildWith({ module_paths: MODULE_PATHS });
  assert.equal(moduleOf("paketler/oyunlar/a.mjs"), "oyunlar");
  assert.equal(moduleOf("paketler/oyunlar/b.mjs"), "oyunlar");
});

test("graph build: modul dugumleri config'teki modul kumesiyle eslesir", async () => {
  const { moduleNodes } = await buildWith({ module_paths: MODULE_PATHS });
  assert.deepEqual(moduleNodes, ["motor", "oyunlar"], "unknown kalmamali, config'teki iki modul dogmali");
});

test("graph build: daha uzun (spesifik) prefix kazanir", async () => {
  const { moduleOf } = await buildWith({ module_paths: MODULE_PATHS });
  assert.equal(moduleOf("paketler/oyunlar/motor/c.mjs"), "motor");
});

test("REGRESYON: config yoksa davranis degismez (unknown)", async () => {
  const { moduleNodes, moduleOf } = await buildWith({});
  assert.equal(moduleOf("paketler/oyunlar/a.mjs"), UNKNOWN_MODULE);
  assert.deepEqual(moduleNodes, [UNKNOWN_MODULE], "kuralsiz projede eski hardcoded davranis korunur");
});

// ─── resolveModule: bug'in 2. maddesi ───

test("resolveModule: graf 'unknown' derse config kazanir (eski kod burada kaliyordu)", () => {
  const cfg = { module_paths: MODULE_PATHS };
  const rel = "paketler/oyunlar/a.mjs";
  // Eski ifade — bayat graf senaryosu: kural graf kurulduktan SONRA eklendi.
  const eski = UNKNOWN_MODULE || ownerOfConfigured(rel, cfg);
  assert.equal(eski, UNKNOWN_MODULE, "eski ifadenin gercekten bozuk oldugunun kaniti");
  assert.equal(resolveModule(UNKNOWN_MODULE, rel, cfg), "oyunlar");
});

test("resolveModule: graf BILINEN modul soyluyorsa graf kazanir", () => {
  assert.equal(resolveModule("motor", "paketler/oyunlar/a.mjs", { module_paths: MODULE_PATHS }), "motor");
});

test("resolveModule: bos/undefined modul de config'e duser", () => {
  const cfg = { module_paths: MODULE_PATHS };
  assert.equal(resolveModule(undefined, "paketler/oyunlar/b.mjs", cfg), "oyunlar");
  assert.equal(resolveModule("", "paketler/oyunlar/b.mjs", cfg), "oyunlar");
});

test("resolveModule: ne graf ne config biliyorsa unknown kalir (yalan uretmez)", () => {
  assert.equal(resolveModule(UNKNOWN_MODULE, "baska/yer/x.mjs", { module_paths: MODULE_PATHS }), UNKNOWN_MODULE);
});

// ─── Uctan uca: kullanicinin GORDUGU satir ───
// resolveModule dogru cevabi uretse bile ekrana computeImpact'in HAM degeri
// basiliyordu (ilk duzeltme bunu kacirdi). Bu test o yuzeyi kilitler.
test("impact CLI: bayat grafta bile ekran/JSON config'teki modulu gosterir", async () => {
  const root = mkProject();
  const brainRoot = join(root, ".serif-brain");
  mkdirSync(join(brainRoot, "graph"), { recursive: true });
  // Graf, module_paths YOKKEN kuruldu → dugumler "unknown" tasiyor.
  const graph = await buildGraph({ projectRoot: root, brainRoot, projectId: "modpath", config: {} });
  writeFileSync(join(brainRoot, "graph", "graph.json"), JSON.stringify(graph));
  // Kural SONRADAN eklendi (gercek senaryo).
  writeFileSync(join(brainRoot, "config.yaml"), 'module_paths:\n  "paketler/oyunlar/": oyunlar\n');

  const { impactCommand } = await import("../src/cli/impact.mjs");
  const orig = console.log;
  const lines = [];
  console.log = (...a) => lines.push(a.join(" "));
  try {
    await impactCommand({
      args: { flags: { project: root, json: true }, _: [] },
      subcommand: ["paketler/oyunlar/b.mjs"],
    });
  } finally {
    console.log = orig;
  }
  const out = JSON.parse(lines.join("\n"));
  assert.equal(out.module, "oyunlar", "graf 'unknown' dese de config kazanmali");
});

test("isKnownModule: unknown/bos bilinen sayilmaz", () => {
  assert.equal(isKnownModule("oyunlar"), true);
  assert.equal(isKnownModule(UNKNOWN_MODULE), false);
  assert.equal(isKnownModule(""), false);
  assert.equal(isKnownModule(undefined), false);
});
