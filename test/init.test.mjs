import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initCommand } from "../src/cli/init.mjs";

function makeTmpProject(prefix) {
  return mkdtempSync(join(tmpdir(), `sb-init-${prefix}-`));
}

function suppressLogs(fn) {
  const orig = console.log;
  console.log = () => {};
  return Promise.resolve(fn()).finally(() => {
    console.log = orig;
  });
}

test("init default — serif-platform layout korunur", async () => {
  const tmp = makeTmpProject("default");
  try {
    const exit = await suppressLogs(() =>
      initCommand({ args: { flags: { project: tmp }, _: [] } }),
    );
    assert.equal(exit, 0);

    const brainRoot = join(tmp, ".serif-brain");
    assert.ok(existsSync(brainRoot), "brain root yaratılmadı");
    assert.ok(existsSync(join(brainRoot, "config.yaml")), "config.yaml yok");
    assert.ok(existsSync(join(brainRoot, ".gitignore")), ".gitignore yok");
    assert.ok(existsSync(join(brainRoot, "README.md")), "README.md yok");

    for (const sub of ["bugs", "decisions", "notes", "modules", "sessions", "sprints"]) {
      assert.ok(
        existsSync(join(brainRoot, "objects/projects/serif-platform", sub)),
        `serif-platform/${sub} yaratılmadı`,
      );
    }
    for (const root of ["graph", "reports", "context", "indexes", "archive-index"]) {
      assert.ok(existsSync(join(brainRoot, root)), `${root} yaratılmadı`);
    }

    const cfg = readFileSync(join(brainRoot, "config.yaml"), "utf8");
    assert.match(cfg, /id: serif-platform/);
    assert.match(cfg, /id: mevzuat-ai/);
    assert.match(cfg, /legacy_sources:/);
    assert.match(cfg, /archive_root: "\/Users\/muhammedserifdemir\/SerifBrainArchive/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("init --project_id custom — sadece custom project yaratılır, legacy_sources yok", async () => {
  const tmp = makeTmpProject("custom");
  try {
    const exit = await suppressLogs(() =>
      initCommand({
        args: { flags: { project: tmp, project_id: "serif-agent-bridge" }, _: [] },
      }),
    );
    assert.equal(exit, 0);

    const brainRoot = join(tmp, ".serif-brain");
    for (const sub of ["bugs", "decisions", "notes", "modules", "sessions", "sprints"]) {
      assert.ok(
        existsSync(join(brainRoot, "objects/projects/serif-agent-bridge", sub)),
        `serif-agent-bridge/${sub} yaratılmadı`,
      );
    }

    assert.ok(
      !existsSync(join(brainRoot, "objects/projects/serif-platform")),
      "serif-platform DEĞİL custom project yaratılmalı",
    );
    assert.ok(
      !existsSync(join(brainRoot, "objects/projects/mevzuat-ai")),
      "mevzuat-ai DEĞİL custom project yaratılmalı",
    );

    for (const root of ["graph", "reports", "context", "indexes", "archive-index"]) {
      assert.ok(existsSync(join(brainRoot, root)), `${root} yaratılmadı`);
    }

    const cfg = readFileSync(join(brainRoot, "config.yaml"), "utf8");
    assert.match(cfg, /id: serif-agent-bridge/);
    assert.match(cfg, /active: true/);
    assert.match(cfg, /migrate: false/);
    assert.doesNotMatch(cfg, /id: serif-platform/);
    assert.doesNotMatch(cfg, /id: mevzuat-ai/);
    assert.doesNotMatch(cfg, /legacy_sources:/);
    assert.doesNotMatch(cfg, /SerifBrainArchive/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("init writeIfMissing — varolan config.yaml overwrite edilmez", async () => {
  const tmp = makeTmpProject("idempotent");
  try {
    await suppressLogs(() =>
      initCommand({ args: { flags: { project: tmp }, _: [] } }),
    );
    const cfgPath = join(tmp, ".serif-brain", "config.yaml");
    const original = readFileSync(cfgPath, "utf8");

    await new Promise((r) => setTimeout(r, 5));

    await suppressLogs(() =>
      initCommand({ args: { flags: { project: tmp }, _: [] } }),
    );
    const after = readFileSync(cfgPath, "utf8");

    assert.equal(after, original, "config.yaml yeniden init'te degistirilmemeli");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("init custom + idempotent — tekrar çalıştırılınca custom config korunur", async () => {
  const tmp = makeTmpProject("custom-idempotent");
  try {
    await suppressLogs(() =>
      initCommand({
        args: { flags: { project: tmp, project_id: "demo-project" }, _: [] },
      }),
    );
    const cfgPath = join(tmp, ".serif-brain", "config.yaml");
    const original = readFileSync(cfgPath, "utf8");

    await suppressLogs(() =>
      initCommand({
        args: { flags: { project: tmp, project_id: "demo-project" }, _: [] },
      }),
    );
    const after = readFileSync(cfgPath, "utf8");

    assert.equal(after, original);
    assert.match(after, /id: demo-project/);
    assert.doesNotMatch(after, /id: serif-platform/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
