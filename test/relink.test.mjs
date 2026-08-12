// KOPUK HAFIZA BAGLANTILARI.
//
// Kopuk referans "olu baglanti" degildir: kapinin o dosyada SUSMASI demektir.
// Olcum (20 gercek brain): 82+237 kirik referans. animatorx'teki 237'nin
// HICBIRI silinmis dosya degildi — hepsi TABAN HATASIYDI (brain alt-dizinde,
// git repo koküne gore yol donduruyor).
//
// Kritik sozlesme: TAHMIN YOK. Benzer isimli dosyayi "herhalde budur" diye
// baglamak, olculen 5,6x sinyal/gurultu oranini bozar. Yalniz git'in R
// kayitlari ve ispatlanabilir onek kirpmasi kullanilir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { planRelink, renameHaritasi, onekDuzeltmesi } from "../src/cli/relink.mjs";
import { loadConfig } from "../src/markdown/schema.mjs";

function mkRepo({ altDizin = null } = {}) {
  const gitKok = mkdtempSync(join(tmpdir(), "sbc-relink-"));
  const proje = altDizin ? join(gitKok, altDizin) : gitKok;
  mkdirSync(join(proje, "src"), { recursive: true });
  writeFileSync(join(proje, "src", "eski.mjs"), "export const a = 1;\n");
  const git = (...a) => execFileSync("git", ["-C", gitKok, ...a], { stdio: "ignore" });
  git("init", "-q"); git("config", "user.email", "t@t.t"); git("config", "user.name", "t");
  git("add", "-A"); git("commit", "-qm", "ilk");
  return { gitKok, proje, git };
}

function mkBrain(proje, dosyalar) {
  const brainRoot = join(proje, ".serif-brain");
  mkdirSync(join(brainRoot, "objects", "projects", "p", "bugs"), { recursive: true });
  writeFileSync(join(brainRoot, "config.yaml"),
    "projects:\n  - id: p\n    active: true\nvalid_modules:\n  - core\n  - unknown\n" +
    "valid_status:\n  - open\n  - done\nvalid_priority:\n  - high\n  - medium\n  - low\n" +
    "valid_severity:\n  - high\n  - medium\n  - low\n");
  writeFileSync(join(brainRoot, "objects", "projects", "p", "bugs", "bug-20260101-x.md"),
`---
id: bug-20260101-x
type: bug
project: p
module: core
title: "Bir bug"
status: open
priority: medium
severity: medium
created_at: "2026-01-01T00:00:00.000Z"
updated_at: "2026-01-01T00:00:00.000Z"
relations:
  files:
${dosyalar.map(f => `    - ${f}`).join("\n")}
  decisions: []
  bugs: []
  modules: [core]
tags: []
summary: "Bir bug"
---
# Bir bug
`);
  loadConfig(brainRoot);
  return brainRoot;
}

test("rename: git'in R kaydi takip edilir", () => {
  const { gitKok, proje, git } = mkRepo();
  const brainRoot = mkBrain(proje, ["src/eski.mjs"]);
  renameSync(join(proje, "src", "eski.mjs"), join(proje, "src", "yeni.mjs"));
  git("add", "-A"); git("commit", "-qm", "tasindi");

  const plan = planRelink(proje, brainRoot);
  assert.equal(plan.onarilabilir, 1);
  assert.deepEqual(plan.objeler[0].degisim, [["src/eski.mjs", "src/yeni.mjs"]]);
});

test("rename ZINCIRI: a→b→c ise a'nin karsiligi c", () => {
  const { proje, git } = mkRepo();
  const brainRoot = mkBrain(proje, ["src/eski.mjs"]);
  renameSync(join(proje, "src", "eski.mjs"), join(proje, "src", "orta.mjs"));
  git("add", "-A"); git("commit", "-qm", "1");
  renameSync(join(proje, "src", "orta.mjs"), join(proje, "src", "son.mjs"));
  git("add", "-A"); git("commit", "-qm", "2");

  assert.equal(renameHaritasi(proje).get("src/eski.mjs"), "src/son.mjs");
  assert.deepEqual(planRelink(proje, brainRoot).objeler[0].degisim, [["src/eski.mjs", "src/son.mjs"]]);
});

test("TABAN HATASI: alt-dizindeki brain'de repo-koku oneki kirpilir", () => {
  // animatorx senaryosu: brain apps/animatorx/ altinda, kayitlar
  // "apps/animatorx/src/eski.mjs" diyor — proje koku zaten orasi.
  const { proje } = mkRepo({ altDizin: "apps/animatorx" });
  const brainRoot = mkBrain(proje, ["apps/animatorx/src/eski.mjs"]);

  assert.equal(onekDuzeltmesi(proje), "apps/animatorx/");
  const plan = planRelink(proje, brainRoot);
  assert.equal(plan.onarilabilir, 1);
  assert.deepEqual(plan.objeler[0].degisim, [["apps/animatorx/src/eski.mjs", "src/eski.mjs"]]);
});

test("TAHMIN YOK: silinmis dosya icin benzer isim ONERILMEZ", () => {
  const { proje, git } = mkRepo();
  const brainRoot = mkBrain(proje, ["src/eski.mjs"]);
  // rename DEGIL: sil + benzer isimli yeni dosya yarat
  execFileSync("git", ["-C", proje, "rm", "-q", "src/eski.mjs"], { stdio: "ignore" });
  mkdirSync(join(proje, "src"), { recursive: true });  // git rm son dosyayla birlikte dizini de siler
  writeFileSync(join(proje, "src", "eski-yeni.mjs"), "export const b = 2;\nexport const c = 3;\n");
  git("add", "-A"); git("commit", "-qm", "silindi ve baskasi eklendi");

  const plan = planRelink(proje, brainRoot);
  assert.equal(plan.onarilabilir, 0, "benzer isim TAHMIN edilmemeli");
  assert.equal(plan.kalanKirik, 1, "kirik oldugu DURUSTCE bildirilmeli");
});

test("saglam referanslar rapora girmez (gurultu yok)", () => {
  const { proje } = mkRepo();
  const brainRoot = mkBrain(proje, ["src/eski.mjs"]);
  assert.equal(planRelink(proje, brainRoot).objeler.length, 0);
});

test("onekDuzeltmesi: repo kokundeki brain icin null", () => {
  const { proje } = mkRepo();
  assert.equal(onekDuzeltmesi(proje), null, "kok dizinde kirpilacak onek yok");
});
