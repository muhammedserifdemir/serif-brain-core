import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { initCommand } from "../src/cli/init.mjs";
import { doctorCommand } from "../src/doctor/doctor.mjs";

function makeTmpProject(prefix) {
  return mkdtempSync(join(tmpdir(), `sb-doctor-${prefix}-`));
}

function suppressLogs(fn) {
  const orig = console.log;
  console.log = () => {};
  return Promise.resolve(fn()).finally(() => {
    console.log = orig;
  });
}

function captureLogs(fn) {
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(" "));
  return Promise.resolve(fn()).then(
    (result) => {
      console.log = origLog;
      return { result, output: lines.join("\n") };
    },
    (err) => {
      console.log = origLog;
      throw err;
    },
  );
}

function extractSection3(output) {
  const lines = output.split("\n");
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (/^=== 3\. /.test(line)) {
      inside = true;
      out.push(line);
    } else if (inside && /^=== /.test(line)) {
      break;
    } else if (inside) {
      out.push(line);
    }
  }
  return out.join("\n");
}

test("default init: doctor Section 3 reports klasor-turevi proje id'sini, serif-platform DEGIL", async () => {
  const tmp = makeTmpProject("default");
  try {
    await suppressLogs(() =>
      initCommand({ args: { flags: { project: tmp }, _: [] } }),
    );

    const { output } = await captureLogs(() =>
      doctorCommand({ args: { flags: { project: tmp }, _: [] } }),
    );

    const autoId = basename(tmp).toLowerCase();
    const sec3 = extractSection3(output);
    assert.match(sec3, new RegExp(`Active Project — ${autoId}`), "Section 3 header");
    // Doctor MUTLAK yol basar; mutlak yol isletim sisteminin ayracini kullanir
    // (Windows'ta "objects\projects\..."). Iddia ayraca duyarsiz kurulur —
    // aksi halde urun dogru calisirken TEST kirmizi olur.
    assert.match(sec3, new RegExp(`objects[\\\\/]projects[\\\\/]${autoId}`), "project dir mentioned");
    assert.doesNotMatch(sec3, /Active Project — serif-platform/, "yanlislikla serif-platform OLMAMALI");
    assert.doesNotMatch(sec3, /\[!✗\] Project dir/, "no project dir error");
    assert.match(sec3, /bugs\//);
    assert.match(sec3, /decisions\//);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("custom init: doctor Section 3 reports custom project without serif-platform leak", async () => {
  const tmp = makeTmpProject("custom");
  try {
    await suppressLogs(() =>
      initCommand({
        args: { flags: { project: tmp, project_id: "serif-agent-bridge" }, _: [] },
      }),
    );

    const { output } = await captureLogs(() =>
      doctorCommand({ args: { flags: { project: tmp }, _: [] } }),
    );

    const sec3 = extractSection3(output);
    assert.match(sec3, /Active Project — serif-agent-bridge/, "custom header");
    assert.match(sec3, /objects[\\/]projects[\\/]serif-agent-bridge/, "custom path");
    assert.doesNotMatch(sec3, /serif-platform/, "no serif-platform leak in Section 3");
    assert.doesNotMatch(sec3, /\[!✗\] Project dir/, "no project dir error");
    assert.match(sec3, /bugs\//);
    assert.match(sec3, /decisions\//);
    assert.match(sec3, /notes\//);
    assert.match(sec3, /modules\//);
    assert.match(sec3, /sessions\//);
    assert.match(sec3, /sprints\//);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("custom init: doctor only Section 3 isolation — global output may have unrelated paths", async () => {
  const tmp = makeTmpProject("isolation");
  try {
    await suppressLogs(() =>
      initCommand({
        args: { flags: { project: tmp, project_id: "demo-bridge" }, _: [] },
      }),
    );

    const { output } = await captureLogs(() =>
      doctorCommand({ args: { flags: { project: tmp }, _: [] } }),
    );

    const sec3 = extractSection3(output);
    assert.match(sec3, /Active Project — demo-bridge/);

    const sec3StartsAt = output.indexOf("=== 3. ");
    const sec3EndsAt = output.indexOf("=== 3b.");
    assert.ok(sec3StartsAt > 0, "Section 3 header found");
    assert.ok(sec3EndsAt > sec3StartsAt, "Section 3b follows after");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Modul atfi KAPSAMI ──────────────────────────────────────────────────────
// "unknown" bir deger degil, bir BOSLUKTUR: o dosyalarda modul-seviyesi hafiza,
// hotspot'un modul bug yogunlugu ve risk fuzyonunun modul bileseni calismaz —
// ama hicbiri hata vermez, sessizce zayiflar. Kullanicinin bunu OGRENMESI icin
// bir yer olmali; yoksa "doctor temiz" derken arac yari kor calisir.
// Olculdu (11 gercek proje): 5'inde oran %25 ustu, birinde %100.
test("doctor: modul atfi cokukse UYARIR ve nasil duzeltilecegini soyler", async () => {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const dir = makeTmpProject("modul");
  try {
    await suppressLogs(() => initCommand({ args: { flags: { project: dir }, _: [] } }));
    const graf = {
      generated_at: new Date().toISOString(),
      stats: { node_count: 12, edge_count: 0, files_scanned: 12 },
      nodes: Array.from({ length: 12 }, (_, i) => ({
        id: `file:src/d${i}.ts`, type: "file", module: i < 3 ? "cekirdek" : "unknown",
      })),
      edges: [],
    };
    mkdirSync(join(dir, ".serif-brain", "graph"), { recursive: true });
    writeFileSync(join(dir, ".serif-brain", "graph", "graph.json"), JSON.stringify(graf));

    const { output } = await captureLogs(() => doctorCommand({ args: { flags: { project: dir }, _: [] } }));
    assert.match(output, /Module attribution/, "kapsam adlandirilmali");
    assert.match(output, /3\/12/, "kac dosyanin bagli oldugu SAYIYLA soylenmeli");
    assert.match(output, /unknown %75/);
    assert.match(output, /ZAYIF calisir/, "SONUCU soylenmeli, sadece sayi degil");
    assert.match(output, /module_paths/, "duzeltme yolu verilmeli");

    // Atfi duzelt → uyari susmali (kalici alarm uretme yasagi).
    graf.nodes.forEach((n) => { n.module = "cekirdek"; });
    writeFileSync(join(dir, ".serif-brain", "graph", "graph.json"), JSON.stringify(graf));
    const temiz = await captureLogs(() => doctorCommand({ args: { flags: { project: dir }, _: [] } }));
    assert.match(temiz.output, /12\/12/);
    assert.doesNotMatch(temiz.output, /ZAYIF calisir/, "duzelince SUSMALI");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
