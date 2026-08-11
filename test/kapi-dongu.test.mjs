// Stop kapisinin IKI gercek hatasi (2026-08-11, kullanici ekraninda yasandi).
//
// (1) DONGU: Stop hook'u konusunca model yeniden istem alir, bir sey soyler,
//     tekrar durmayi dener — kapi AYNI metni yine uretir. Ekranda
//     "Bekliyorum. Bekliyorum. Bekliyorum..." diye giden bir dongu olustu.
//     Sozlesme "soyleyecek sey yoksa sus" diyordu; eksik kural: SOYLEDIGINI
//     BIR DAHA SOYLEME.
//
// (2) TERS SESSIZLIK: review/lint/check BULGU VARSA exit 2 (ya da 1) verir —
//     pre-commit kapisi olduklari icin bu sozlesme gereklidir. execFileSync
//     sifir-olmayan cikista FIRLATIR; eski kod bunu "komut basarisiz" sayip
//     null donuyordu. Yani kapi TAM DA SORUN BULUNDUGUNDA susuyordu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const GATE = resolve(dirname(fileURLToPath(import.meta.url)), "../hooks/claude-gate.mjs");

function mkRepo() {
  const tmp = mkdtempSync(join(tmpdir(), "sb-dongu-"));
  mkdirSync(join(tmp, ".serif-brain", "graph"), { recursive: true });
  mkdirSync(join(tmp, "src"), { recursive: true });
  writeFileSync(join(tmp, ".serif-brain", "config.yaml"),
    'layer_rules: []\nbug_signatures:\n  - { name: konsol, pattern: "console\\\\.log", message: "Uretimde console.log", severity: high }\n');
  writeFileSync(join(tmp, ".serif-brain", "graph", "graph.json"), '{"nodes":[],"edges":[]}');
  writeFileSync(join(tmp, "src", "a.mjs"), "export const a = 1;\n");
  const git = (...a) => execFileSync("git", ["-C", tmp, ...a], { stdio: "ignore" });
  git("init", "-q"); git("config", "user.email", "t@t.t"); git("config", "user.name", "t");
  git("add", "-A"); git("commit", "-qm", "base");
  return tmp;
}

const stop = (tmp) => execFileSync(process.execPath, [GATE, "stop"], {
  input: JSON.stringify({ cwd: tmp }), encoding: "utf8",
  env: { ...process.env, CLAUDE_PROJECT_DIR: tmp },
}).trim();

test("kapi — SORUN VARKEN konusur (exit 2 'basarisiz' sayilmaz)", () => {
  const tmp = mkRepo();
  try {
    writeFileSync(join(tmp, "src", "a.mjs"), 'console.log("x");\n');
    const out = stop(tmp);
    assert.ok(out, "bulgu varken kapi KONUSMALI — eskiden tam burada susuyordu");
    assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /console\.log/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("kapi — AYNI durumu ikinci kez SOYLEMEZ (dongunun kaynagi)", () => {
  const tmp = mkRepo();
  try {
    writeFileSync(join(tmp, "src", "a.mjs"), 'console.log("x");\n');
    assert.ok(stop(tmp), "ilk cagri konusmali");
    assert.equal(stop(tmp), "", "ikinci cagri SUSMALI");
    assert.equal(stop(tmp), "", "ucuncu cagri da susmali");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("kapi — durum DEGISIRSE yeniden konusur (sinyal kaybolmaz)", () => {
  const tmp = mkRepo();
  try {
    writeFileSync(join(tmp, "src", "a.mjs"), 'console.log("x");\n');
    assert.ok(stop(tmp));
    assert.equal(stop(tmp), "");
    writeFileSync(join(tmp, "src", "b.mjs"), 'console.log("y");\n');  // YENI sorun
    execFileSync("git", ["-C", tmp, "add", "-A"], { stdio: "ignore" });
    assert.ok(stop(tmp), "yeni bulguda tekrar konusmali — susturma kalici degil");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("kapi — DURUM bildirimi Stop'ta YOK (yakalanmamis commit oturum acilisina ait)", () => {
  const tmp = mkRepo();
  try {
    // Temiz calisma agaci + hafizaya gecmemis commit'ler: Stop SUSMALI.
    writeFileSync(join(tmp, "src", "c.mjs"), "export const c = 3;\n");
    const git = (...a) => execFileSync("git", ["-C", tmp, ...a], { stdio: "ignore" });
    git("add", "-A"); git("commit", "-qm", "fix: bir hata duzeltildi");
    assert.equal(stop(tmp), "",
      "durum bildirimi (yakalanmamis commit) Stop'ta olmamali — her durmada tekrar eder ve dongu yapar");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
