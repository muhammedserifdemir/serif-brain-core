import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { initCommand } from "../src/cli/init.mjs";
import { buildCompactJson, writeContext } from "../src/context/compile.mjs";

function makeTmpProject(prefix) {
  return mkdtempSync(join(tmpdir(), `sb-context-${prefix}-`));
}

function suppressLogs(fn) {
  const orig = console.log;
  console.log = () => {};
  return Promise.resolve(fn()).finally(() => {
    console.log = orig;
  });
}

const EMPTY_DATA = {
  brainRoot: "<placeholder>",
  canonical: { objects: [], by_project: {}, errors: [] },
  graph: null,
  dry_run: null,
  migrated: null,
  migration_status: "none",
  backlinks: null,
  backlinks_broken: [],
  health: null,
  timestamps: {},
};

test("buildCompactJson default — proje bilinmiyorsa BASKA bir projenin adi dusmez", () => {
  // Eskiden varsayilan "serif-platform"du: paket yazarinin urunu. Yapilandirma
  // yapmamis bir kullanicinin ciktisinda hic duymadigi bir proje adi belirirdi.
  // "unknown" bilgi kaybi degil, DURUST bir cevaptir.
  const json = buildCompactJson(EMPTY_DATA, {});
  assert.equal(json.project, "unknown");
});

test("buildCompactJson explicit primary — passed argument used", () => {
  const json = buildCompactJson(EMPTY_DATA, {}, "custom-project-id");
  assert.equal(json.project, "custom-project-id");
});

test("writeContext with default init — compact.json project = klasor adindan otomatik turetilen id", async () => {
  const tmp = makeTmpProject("write-default");
  try {
    await suppressLogs(() =>
      initCommand({ args: { flags: { project: tmp }, _: [] } }),
    );
    const brainRoot = join(tmp, ".serif-brain");
    const data = { ...EMPTY_DATA, brainRoot };
    writeContext({ brainRoot, data, opts: {} });
    const compact = JSON.parse(
      readFileSync(join(brainRoot, "context", "compact.json"), "utf8"),
    );
    assert.equal(compact.project, basename(tmp).toLowerCase());
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("writeContext with custom init — compact.json project = custom id (no leak)", async () => {
  const tmp = makeTmpProject("write-custom");
  try {
    await suppressLogs(() =>
      initCommand({
        args: { flags: { project: tmp, project_id: "serif-agent-bridge" }, _: [] },
      }),
    );
    const brainRoot = join(tmp, ".serif-brain");
    const data = { ...EMPTY_DATA, brainRoot };
    writeContext({ brainRoot, data, opts: {} });
    const compact = JSON.parse(
      readFileSync(join(brainRoot, "context", "compact.json"), "utf8"),
    );
    assert.equal(compact.project, "serif-agent-bridge");
    assert.notEqual(compact.project, "serif-platform");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("writeContext nested canonical/preview shape preserved (Bridge contract)", async () => {
  const tmp = makeTmpProject("nested-shape");
  try {
    await suppressLogs(() =>
      initCommand({ args: { flags: { project: tmp }, _: [] } }),
    );
    const brainRoot = join(tmp, ".serif-brain");
    const data = { ...EMPTY_DATA, brainRoot };
    writeContext({ brainRoot, data, opts: {} });
    const compact = JSON.parse(
      readFileSync(join(brainRoot, "context", "compact.json"), "utf8"),
    );
    assert.ok(compact.canonical, "canonical key");
    assert.ok(Array.isArray(compact.canonical.bugs), "canonical.bugs array");
    assert.ok(Array.isArray(compact.canonical.decisions), "canonical.decisions array");
    assert.ok(compact.preview, "preview key");
    assert.ok(Array.isArray(compact.preview.bugs), "preview.bugs array");
    assert.ok(Array.isArray(compact.preview.decisions), "preview.decisions array");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
