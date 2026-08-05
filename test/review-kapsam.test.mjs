// Kapsam etiketi testleri — "sorun bulamadim" ile "sorun aramadim" ayrimi.
// Bu ayrim kaybolursa kapi YANLIS GUVEN uretir: kullanici yesil isiga bakip
// commit eder, oysa degisen dosyalar hic denetlenmemistir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { reviewCommand } from "../src/cli/review.mjs";

function makeRepo(files, graph) {
  const tmp = mkdtempSync(join(tmpdir(), "sb-review-"));
  mkdirSync(join(tmp, ".serif-brain", "graph"), { recursive: true });
  mkdirSync(join(tmp, "src"), { recursive: true });
  writeFileSync(join(tmp, ".serif-brain", "config.yaml"), "layer_rules: []\nbug_signatures: []\n");
  for (const [rel, body] of Object.entries(files)) writeFileSync(join(tmp, rel), body);
  if (graph) writeFileSync(join(tmp, ".serif-brain", "graph", "graph.json"), JSON.stringify(graph));
  const git = (...a) => execFileSync("git", ["-C", tmp, ...a], { stdio: "ignore" });
  git("init", "-q");
  git("config", "user.email", "t@t.t");
  git("config", "user.name", "t");
  git("add", "-A");
  git("commit", "-qm", "base");
  return tmp;
}

function capture(fn) {
  const orig = console.log;
  const lines = [];
  console.log = (...a) => lines.push(a.join(" "));
  return Promise.resolve(fn())
    .then(exit => ({ exit, out: lines.join("\n") }))
    .finally(() => { console.log = orig; });
}

const review = (tmp, flags = {}) => capture(() => reviewCommand({ args: { flags: { project: tmp, ...flags }, _: [] } }));

// Grafta OLAN tek dosyalik minimal graf
const graphWith = (rel) => ({
  nodes: [{ id: `file:${rel}`, type: "file", path: rel, label: rel }],
  edges: [],
});

test("review — degisen dosya grafta yoksa KAPSAM uyarisi verir", async () => {
  const tmp = makeRepo({ "src/a.mjs": "export const a = 1;\n" }, graphWith("src/a.mjs"));
  try {
    // grafta olmayan YENI dosya ekle
    writeFileSync(join(tmp, "src", "yeni.mjs"), "export const b = 2;\n");

    const { out } = await review(tmp);
    assert.match(out, /KAPSAM/, "kapsam etiketi basilmali");
    assert.match(out, /grafta YOK/);
    assert.match(out, /src\/yeni\.mjs/, "denetlenemeyen dosya ADIYLA sayilmali");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("review --json — coverage alani denetlenen/denetlenemeyeni ayirir", async () => {
  const tmp = makeRepo({ "src/a.mjs": "export const a = 1;\n" }, graphWith("src/a.mjs"));
  try {
    writeFileSync(join(tmp, "src", "a.mjs"), "export const a = 99;\n"); // grafta VAR
    writeFileSync(join(tmp, "src", "yeni.mjs"), "export const b = 2;\n"); // grafta YOK

    const { out } = await review(tmp, { json: true });
    const j = JSON.parse(out);
    assert.equal(j.changed, 2);
    assert.equal(j.coverage.checked, 1, "grafta olan 1 dosya denetlenmis olmali");
    assert.equal(j.coverage.uncovered, 1);
    assert.deepEqual(j.coverage.uncovered_files, ["src/yeni.mjs"]);
    assert.equal(j.coverage.graph_missing, false);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("review — graf hic yoksa 'yapisal denetim CALISMADI' der, ✓ ile susmaz", async () => {
  const tmp = makeRepo({ "src/a.mjs": "export const a = 1;\n" }, null);
  try {
    writeFileSync(join(tmp, "src", "a.mjs"), "export const a = 42;\n");

    const { exit, out } = await review(tmp);
    assert.equal(exit, 0, "kapsam eksikligi kapiyi BLOKLAMAZ (hook-dostu)");
    assert.match(out, /CALISMADI/, "yapisal denetimin hic calismadigi acikca yazilmali");
    assert.match(out, /graph\.json yok/);
    assert.doesNotMatch(out, /yapisal\/imza sorunu yok/, "denetlenmemisken 'yapisal sorun yok' IDDIA EDILMEMELI");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("review — bayat graf (7 gunden eski) kapsam uyarisi verir", async () => {
  const tmp = makeRepo({ "src/a.mjs": "export const a = 1;\n" }, graphWith("src/a.mjs"));
  try {
    writeFileSync(join(tmp, "src", "a.mjs"), "export const a = 7;\n");
    const gp = join(tmp, ".serif-brain", "graph", "graph.json");
    const old = Date.now() / 1000 - 40 * 24 * 3600; // 40 gun once
    utimesSync(gp, old, old);

    const { out } = await review(tmp);
    assert.match(out, /gun eski/, "bayat graf raporlanmali");
    assert.match(out, /40 gun eski/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("review — her sey guncel ve grafta ise gurultu YAPMAZ", async () => {
  const tmp = makeRepo({ "src/a.mjs": "export const a = 1;\n" }, graphWith("src/a.mjs"));
  try {
    writeFileSync(join(tmp, "src", "a.mjs"), "export const a = 5;\n");

    const { exit, out } = await review(tmp);
    assert.equal(exit, 0);
    assert.match(out, /yapisal\/imza sorunu yok/);
    assert.doesNotMatch(out, /KAPSAM/, "kapsam tamsa uyari basilmamali (yalanci alarm olmasin)");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
