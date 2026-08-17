// prune — hijyen otomasyonu. Bu dosya once BOSTU: prune hic test edilmemisti ve
// tam da bu yuzden iki hatasi uretimde ortaya cikti (2026-08-15, serif-platform):
//   1. `standing` yokken 83 adayin 30'u YURURLUKTEKI KURALDI ("silmek YASAK"
//      diyen politika arsive tasinacakti),
//   2. adaylarin 5'i ACIK BUG'di — biri kullaniciya dokunan lisans hatasi.
// Ikisi de "yas" olcutunun tur ayrimi yapmamasindan cikiyor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pruneCommand } from "../src/cli/prune.mjs";

const GUN = 86400000;
const eskiTarih = (gun) => new Date(Date.now() - gun * GUN).toISOString();

function mkBrain(objeler) {
  const root = mkdtempSync(join(tmpdir(), "sbc-prune-"));
  const brainRoot = join(root, ".serif-brain");
  for (const d of ["bugs", "decisions", "plans", "notes", "sessions", "sprints"]) {
    mkdirSync(join(brainRoot, "objects", "projects", "tek", d), { recursive: true });
  }
  mkdirSync(join(brainRoot, "indexes"), { recursive: true });
  writeFileSync(join(brainRoot, "config.yaml"),
    "projects:\n  - id: tek\n    active: true\n" +
    "valid_modules:\n  - core\n  - unknown\n" +
    "valid_status:\n  - queued\n  - open\n  - active\n  - in_progress\n  - blocked\n  - done\n  - rejected\n  - archived\n  - standing\n" +
    "valid_priority:\n  - critical\n  - high\n  - medium\n  - low\n" +
    "valid_severity:\n  - critical\n  - high\n  - medium\n  - low\n" +
    "context_excluded_status:\n  - done\n  - rejected\n  - archived\n" +
    "automation_id_patterns:\n  - \"-bridge-\"\n");

  for (const o of objeler) {
    const dir = o.type === "bug" ? "bugs" : o.type === "note" ? "notes" : "decisions";
    const t = o.yas !== undefined ? eskiTarih(o.yas) : eskiTarih(1);
    writeFileSync(join(brainRoot, "objects", "projects", "tek", dir, `${o.id}.md`),
      `---\nid: ${o.id}\ntype: ${o.type}\nproject: tek\nmodule: core\n` +
      `title: "${o.title}"\nstatus: ${o.status}\npriority: medium\n` +
      (o.type === "bug" ? `severity: medium\nowner: ""\n` : ``) +
      `created_at: "${t}"\nupdated_at: "${t}"\n` +
      `source:\n  kind: manual\n  path: ""\n` +
      `relations:\n  files: []\n  decisions: []\n  bugs: []\n  modules: [core]\n` +
      `tags: []\n---\n\n# ${o.title}\n\ngovde\n`);
  }
  return { root, brainRoot };
}

const arsivlenenler = (brainRoot) => {
  const dir = join(brainRoot, "archive");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).filter(f => String(f).endsWith(".md")).map(String);
};

test("prune: `standing` kayit BAYAT OLSA DA aday degildir (kural yaslanmaz)", async () => {
  const { root, brainRoot } = mkBrain([
    { id: "decision-kural", type: "decision", status: "standing", yas: 400,
      title: "Legacy cleanup policy — silmek YASAK" },
    { id: "decision-bayat", type: "decision", status: "active", yas: 400,
      title: "unutulmus is" },
  ]);
  await pruneCommand({ args: { flags: { project: root, days: 60, apply: true } } });

  const ars = arsivlenenler(brainRoot).join("\n");
  assert.doesNotMatch(ars, /decision-kural/, "yururlukteki kural arsivlenmemeli");
  assert.match(ars, /decision-bayat/, "gercek bayat is arsivlenmeli");
  assert.ok(existsSync(join(brainRoot, "objects/projects/tek/decisions/decision-kural.md")),
    "kural dosyasi yerinde durmali");
});

test("prune: bayat BUG yasa gore arsivlenmez (duzeltilmemis problem, unutulmus not degil)", async () => {
  const { root, brainRoot } = mkBrain([
    { id: "bug-lisans", type: "bug", status: "open", yas: 200,
      title: "Lisans girildikten 1-2 gun sonra degisiyor" },
    { id: "decision-bayat", type: "decision", status: "active", yas: 200, title: "eski plan" },
  ]);
  await pruneCommand({ args: { flags: { project: root, days: 60, apply: true } } });

  const ars = arsivlenenler(brainRoot).join("\n");
  assert.doesNotMatch(ars, /bug-lisans/, "acik bug zamanasimiyla kaybolmamali");
  assert.match(ars, /decision-bayat/, "bug disi bayat kayit yine arsivlenmeli");
  assert.ok(existsSync(join(brainRoot, "objects/projects/tek/bugs/bug-lisans.md")));
});

test("prune --include-bugs: bilerek istenirse bug da arsivlenir", async () => {
  const { root, brainRoot } = mkBrain([
    { id: "bug-eski", type: "bug", status: "open", yas: 200, title: "gercekten birakilacak" },
  ]);
  await pruneCommand({ args: { flags: { project: root, days: 60, apply: true, "include-bugs": true } } });
  assert.match(arsivlenenler(brainRoot).join("\n"), /bug-eski/);
});

test("prune: KAPALI kayit (done) hicbir kosulda aday degil", async () => {
  const { root, brainRoot } = mkBrain([
    { id: "decision-kapali", type: "decision", status: "done", yas: 400, title: "coktan bitti" },
  ]);
  await pruneCommand({ args: { flags: { project: root, days: 60, apply: true } } });
  assert.deepEqual(arsivlenenler(brainRoot), [], "kapali kayit zaten context disinda; tasinmasi gereksiz");
});

test("prune: DRY-RUN varsayilandir — dosyaya dokunmaz", async () => {
  const { root, brainRoot } = mkBrain([
    { id: "decision-bayat", type: "decision", status: "active", yas: 400, title: "bayat" },
  ]);
  await pruneCommand({ args: { flags: { project: root, days: 60 } } });
  assert.deepEqual(arsivlenenler(brainRoot), [], "apply verilmeden hicbir sey tasinmamali");
  assert.ok(existsSync(join(brainRoot, "objects/projects/tek/decisions/decision-bayat.md")));
});

// Bayatlik tespiti de tur ayrimi yapmali. Olcum (2026-08-15, serif-platform):
// `standing` eklendikten sonra stale-report 48 yururlukteki kurali "bayat" diye
// listeliyordu — cunku "aktif" tanimi `!isContextExcluded` idi ve standing
// context'te BILEREK kalir. "Kapali degil" ile "acik is" ayni sey degildir.
import { detectHealth } from "../src/markdown/health.mjs";

test("health: `standing` kayit bayat sayilmaz (kural yaslanmaz)", () => {
  const obj = (id, status, gun) => ({
    frontmatter: { id, type: "decision", status, updated_at: eskiTarih(gun) },
  });
  const h = detectHealth(
    [obj("decision-kural", "standing", 400), obj("decision-is", "active", 400)],
    new Map(),
  );
  const idler = h.stale.map(s => s.id);
  assert.deepEqual(idler, ["decision-is"], "yalniz acik is bayatlar");
});
