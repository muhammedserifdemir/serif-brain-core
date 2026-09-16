// `close <id>`: DOSYA ADI ≠ frontmatter `id` olan kaydi bulamiyordu.
//
// Olcum (2026-09-16, mevzuat-ai brain'i): 2 karar dosyasi elle/eski aracla
// "decision-20260427-hetzner-coolify-cloudflare.md" diye adlandirilmis,
// icindeki id "decision-20260427-hosting". `serif-brain close decision-20260427-hosting`
// → "obje bulunamadi" — kayit DISKTE DURUYORKEN. Kullanici frontmatter'i
// elle duzenlemek zorunda kaldi (aracin var olma sebebi olan is).
//
// Kural: id kaynagi FRONTMATTER'dir, dosya adi degil. Dosya adi ile bulunamazsa
// tip dizini taranir; bulunan dosya YERINDE guncellenir (id yoluna ikinci bir
// kopya yazilmaz — o da veri kopyasi/ayrismasi olurdu).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createObject, closeObject } from "../src/markdown/write-ops.mjs";
import { locateObject } from "../src/markdown/locate.mjs";

const SUBDIRS = ["bugs", "decisions", "plans", "notes", "sessions", "sprints"];
function mkBrain(projects = ["tek"]) {
  const root = mkdtempSync(join(tmpdir(), "sbc-close-ad-"));
  const brainRoot = join(root, ".serif-brain");
  for (const p of projects) for (const d of SUBDIRS) mkdirSync(join(brainRoot, "objects", "projects", p, d), { recursive: true });
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

/** Kaydi olusturup dosyasini FARKLI bir ada tasir (mevzuat-ai'deki durum). */
function uyumsuzKayit(projects = ["tek"]) {
  const { root, brainRoot } = mkBrain(projects);
  const r = createObject({ brainRoot, projectRoot: root, config: config(projects),
    type: "decision", title: "Hosting: Hetzner + Coolify", module: "core", files: [], body: "karar govdesi" });
  assert.equal(r.ok, true);
  const yeniYol = join(dirname(r.path), "decision-20260427-hetzner-coolify-cloudflare.md");
  renameSync(r.path, yeniYol);
  return { root, brainRoot, id: r.id, idYolu: r.path, dosyaYolu: yeniYol };
}

test("KALIBRASYON: dosya adi = id ise close bulur (eski davranis korunur)", () => {
  const { root, brainRoot } = mkBrain();
  const r = createObject({ brainRoot, projectRoot: root, config: config(["tek"]),
    type: "decision", title: "normal", module: "core", files: [], body: "x" });
  const k = closeObject({ brainRoot, id: r.id, note: "bitti" });
  assert.equal(k.ok, true);
  assert.match(readFileSync(r.path, "utf8"), /status: done/);
});

test("locateObject: dosya adi ≠ id olan kaydi FRONTMATTER id'siyle bulur", () => {
  const { brainRoot, id, dosyaYolu } = uyumsuzKayit();
  const loc = locateObject(brainRoot, id);
  assert.deepEqual(loc.matches, ["tek"], "kayit diskte, tek projede");
  assert.equal(loc.path, dosyaYolu, "bulunan yol TASINMIS dosya olmali");
});

test("closeObject: uyumsuz adli kaydi YERINDE kapatir; id yoluna ikinci kopya YAZMAZ", () => {
  const { brainRoot, id, idYolu, dosyaYolu } = uyumsuzKayit();
  const k = closeObject({ brainRoot, id, note: "arsiv", commit: "abc1234" });
  assert.equal(k.ok, true, JSON.stringify(k));
  assert.equal(k.path, dosyaYolu);
  const raw = readFileSync(dosyaYolu, "utf8");
  assert.match(raw, /status: done/);
  assert.match(raw, /completed_at:/);
  assert.match(raw, /## Tamamlanma/);
  assert.equal(existsSync(idYolu), false, "id adli ikinci dosya OLUSMAMALI (kopya = ayrisma)");
  const dosyalar = readdirSync(dirname(dosyaYolu)).filter(f => f.endsWith(".md"));
  assert.equal(dosyalar.length, 1, `tip dizininde tek dosya kalmali: ${dosyalar.join(",")}`);
});

test("closeObject: --project_id verildiginde de uyumsuz adli kayit bulunur", () => {
  const { brainRoot, id, dosyaYolu } = uyumsuzKayit(["tek", "iki"]);
  const k = closeObject({ brainRoot, id, projectId: "tek", note: "n" });
  assert.equal(k.ok, true, JSON.stringify(k));
  assert.equal(k.path, dosyaYolu);
});
