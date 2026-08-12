// CLI KATMANI. Kapsam olcumu %10-30 gosteriyordu: `add`/`close` gibi komutlar
// yalniz CEKIRDEK uzerinden test ediliyordu, kullanicinin gercekte calistirdigi
// yol (bayrak ayristirma, cikis kodu, hata metni) hic denenmiyordu.
//
// Burada onemli olan "satir kapsami" degil SOZLESME: dogru cikis kodu, hatanin
// eyleme donusen bir metinle bildirilmesi, ve --json ciktisinin ayristirilabilir
// olmasi (kapi ve MCP bunlara guveniyor).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), "../bin/serif-brain.mjs");

function mkProje() {
  const root = mkdtempSync(join(tmpdir(), "sbc-cli-"));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "package.json"), '{"name":"cli-deneme"}');
  writeFileSync(join(root, "src", "a.mjs"), "export const a = 1;\n");
  const git = (...a) => execFileSync("git", ["-C", root, ...a], { stdio: "ignore" });
  git("init", "-q"); git("config", "user.email", "t@t.t"); git("config", "user.name", "t");
  git("add", "-A"); git("commit", "-qm", "base");
  sb(root, ["init", "--no-panel"]);
  return root;
}

/** @returns {{code:number, out:string, err:string}} */
function sb(root, args) {
  try {
    const out = execFileSync(process.execPath, [BIN, ...args, "--project", root],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out, err: "" };
  } catch (e) {
    return { code: e.status ?? 1, out: e.stdout || "", err: e.stderr || "" };
  }
}

test("add: --title olmadan exit 1 + NE yapilacagini soyler", () => {
  const r = sb(mkProje(), ["add", "bug"]);
  assert.equal(r.code, 1);
  assert.match(r.err, /--title/, "hata mesaji eksik olani adiyla soylemeli");
});

test("add: bilinmeyen tip exit 1 + gecerli tipleri listeler", () => {
  const r = sb(mkProje(), ["add", "sacmalik", "--title", "x"]);
  assert.equal(r.code, 1);
  assert.match(r.err, /bug\|decision\|plan\|record/);
});

test("add → search → close: uctan uca CLI dongusu", () => {
  const root = mkProje();
  const ekle = sb(root, ["add", "bug", "--title", "CLI uzerinden bug", "--module", "core"]);
  assert.equal(ekle.code, 0, ekle.err);
  const id = ekle.out.match(/id: (\S+)/)?.[1];
  assert.ok(id, "add ciktisi id vermeli");

  const ara = sb(root, ["search", "CLI uzerinden", "--json"]);
  assert.equal(ara.code, 0);
  assert.equal(JSON.parse(ara.out).results[0].id, id);

  const kapat = sb(root, ["close", id, "--note", "cozuldu"]);
  assert.equal(kapat.code, 0, kapat.err);
  assert.match(kapat.out, /status: open → done/);
});

test("add: AYNI baslik ikinci kez exit 1 + kullanilabilir alternatif id verir", () => {
  const root = mkProje();
  sb(root, ["add", "bug", "--title", "ayni baslik"]);
  const r = sb(root, ["add", "bug", "--title", "ayni baslik"]);
  assert.equal(r.code, 1);
  assert.match(r.err, /--id \S+-2/, "cikmaz sokak degil, kopyalanabilir cozum vermeli");
});

test("close: olmayan id exit 1 (sessiz basari YOK)", () => {
  const r = sb(mkProje(), ["close", "bug-20260101-olmayan"]);
  assert.equal(r.code, 1);
  assert.match(r.err, /bulunamadi/);
});

test("close: tanimsiz onekli id exit 1", () => {
  const r = sb(mkProje(), ["close", "sacma-id"]);
  assert.equal(r.code, 1);
  assert.match(r.err, /bug-|decision-|plan-/);
});

test("--json ciktilari GERCEKTEN ayristirilabilir (kapi ve MCP buna guveniyor)", () => {
  const root = mkProje();
  sb(root, ["add", "bug", "--title", "json testi", "--module", "core"]);
  sb(root, ["graph", "build"]);
  for (const args of [["brief", "--json"], ["search", "json", "--json"],
                      ["guard", "src/a.mjs", "--json"], ["impact", "src/a.mjs", "--json"],
                      ["hotspot", "--json"], ["review", "--json"]]) {
    const r = sb(root, args);
    assert.doesNotThrow(() => JSON.parse(r.out), `${args[0]} --json ayristirilamadi: ${r.out.slice(0, 120)}`);
  }
});

test("review: bulgu VARSA exit 2 (kapinin dayandigi sozlesme)", () => {
  const root = mkProje();
  writeFileSync(join(root, ".serif-brain", "config.yaml"),
    'projects:\n  - id: cli-deneme\n    active: true\nvalid_modules:\n  - core\n  - unknown\n' +
    'valid_status:\n  - open\n  - active\n  - done\n' + 'valid_priority:\n  - high\n  - medium\n  - low\n' +
    'bug_signatures:\n  - { name: konsol, pattern: "console\\\\.log", message: "Uretimde console.log", severity: high }\n');
  writeFileSync(join(root, "src", "a.mjs"), 'console.log("x");\n');
  const r = sb(root, ["review"]);
  assert.equal(r.code, 2, "exit 2 = 'bulgu var'; kapi bunu 'komut basarisiz' sanmamali");
  assert.match(r.out, /console\.log/);
});

test("bilinmeyen komut exit 1; emekli komut YON verir", () => {
  const root = mkProje();
  assert.equal(sb(root, ["boyle-bir-komut-yok"]).code, 1);
  const r = sb(root, ["report"]);
  assert.equal(r.code, 1);
  assert.match(r.err, /serif-brain analyze/, "emekli komut sessizce basarili olmamali, yon vermeli");
});

test("doctor: saglikli projede exit 0", () => {
  assert.equal(sb(mkProje(), ["doctor"]).code, 0);
});

test("validate: sema-gecerli brain'de exit 0", () => {
  const root = mkProje();
  sb(root, ["add", "decision", "--title", "gecerli kayit", "--module", "core"]);
  const r = sb(root, ["validate"]);
  assert.equal(r.code, 0, r.out + r.err);
});
