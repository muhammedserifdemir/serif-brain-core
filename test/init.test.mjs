import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { initCommand } from "../src/cli/init.mjs";

function makeTmpProject(prefix) {
  return mkdtempSync(join(tmpdir(), `sb-init-${prefix}-`));
}

// Rastgele tmpdir'in altina 'serif-platform' adinda bir alt klasor kurup
// flagship self-host tespitini (package.json/klasor adi) tetiklemek icin.
function makeFlagshipProject() {
  const parent = mkdtempSync(join(tmpdir(), `sb-init-flagship-parent-`));
  const dir = join(parent, "serif-platform");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function suppressLogs(fn) {
  const orig = console.log;
  console.log = () => {};
  return Promise.resolve(fn()).finally(() => {
    console.log = orig;
  });
}

test("init default (isimsiz) — klasor adindan otomatik custom proje turetilir, serif-platform DEGIL", async () => {
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

    const autoId = basename(tmp).toLowerCase();
    for (const sub of ["bugs", "decisions", "notes", "modules", "sessions", "sprints"]) {
      assert.ok(
        existsSync(join(brainRoot, "objects/projects", autoId, sub)),
        `${autoId}/${sub} yaratılmadı (klasor adindan otomatik turetilen id)`,
      );
    }
    for (const root of ["graph", "reports", "context", "indexes", "archive-index"]) {
      assert.ok(existsSync(join(brainRoot, root)), `${root} yaratılmadı`);
    }

    assert.ok(
      !existsSync(join(brainRoot, "objects/projects/serif-platform")),
      "baska klasorde init serif-platform projesi YARATMAMALI (asil bug)",
    );
    assert.ok(!existsSync(join(brainRoot, "objects/projects/mevzuat-ai")));

    const cfg = readFileSync(join(brainRoot, "config.yaml"), "utf8");
    assert.match(cfg, new RegExp(`id: ${autoId}`));
    assert.doesNotMatch(cfg, /id: serif-platform/);
    assert.doesNotMatch(cfg, /id: mevzuat-ai/);
    assert.doesNotMatch(cfg, /legacy_sources:/);
    assert.doesNotMatch(cfg, /SerifBrainArchive/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("init: 'serif-platform' adli klasor de OZEL muamele GORMEZ", async () => {
  // Eskiden bu ad 4 projeli (serif-platform/mevzuat-ai/serifLms/seriftech-packages)
  // bir onyuklemeyi tetikliyordu — paket yazarinin 2026-04 gocune ait liste, genel
  // amacli bir aracin icinde. Ayni adi tasiyan yabanci bir klasor, hic duymadigi
  // uc proje ile karsilasirdi. Artik her klasor ayni kurala tabi: ad turetilir.
  const dir = makeFlagshipProject();
  const parent = join(dir, "..");
  try {
    const exit = await suppressLogs(() =>
      initCommand({ args: { flags: { project: dir }, _: [] } }),
    );
    assert.equal(exit, 0);

    const brainRoot = join(dir, ".serif-brain");
    const cfg = readFileSync(join(brainRoot, "config.yaml"), "utf8");
    assert.match(cfg, /id: serif-platform/, "klasor adindan turetilen TEK proje");
    assert.doesNotMatch(cfg, /id: mevzuat-ai/, "baska projeler UYDURULMAZ");
    assert.doesNotMatch(cfg, /id: serifLms/);
    assert.doesNotMatch(cfg, /module_normalization/, "urune ozgu normalizasyon yazilmaz");
    assert.ok(!existsSync(join(brainRoot, "objects/projects/mevzuat-ai")));
  } finally {
    rmSync(parent, { recursive: true, force: true });
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
