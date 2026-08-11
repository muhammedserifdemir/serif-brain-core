// Claude Code kapisinin KURULUMU. Kapi betigi paket icinde uzun sure vardi ama
// hicbir sey onu settings.json'a baglamiyordu — bu testler o baglantiyi kilitler.
//
// En kritik iki sozlesme: (a) yabanci hook kaydina dokunulmaz, (b) bozuk JSON
// gorulunce YAZILMAZ. Ikisi de kullanicinin baska ayarlarini kaybettirebilir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planHookInstall, applyHookInstall, gateHooks, GATE_SCRIPT, settingsPathOf } from "../src/hooks/install.mjs";

function mkProject(settings) {
  const root = mkdtempSync(join(tmpdir(), "sbc-kapi-"));
  mkdirSync(join(root, ".serif-brain"), { recursive: true });
  if (settings !== undefined) {
    mkdirSync(join(root, ".claude"), { recursive: true });
    writeFileSync(join(root, ".claude", "settings.json"),
      typeof settings === "string" ? settings : JSON.stringify(settings, null, 2));
  }
  return root;
}

const readSettings = (root) => JSON.parse(readFileSync(settingsPathOf(root), "utf8"));
const commandsOf = (s, event) =>
  (s.hooks?.[event] || []).flatMap(e => (e.hooks || []).map(h => h.command));

test("plan: settings.json yokken uc olay da 'missing'", () => {
  const p = planHookInstall(mkProject());
  assert.deepEqual(p.hooks.map(h => h.state), ["missing", "missing", "missing"]);
  assert.equal(p.exists, false);
  assert.equal(p.gateExists, true, "paket kendi kapi betigini tasimali");
});

test("apply: uc olay kurulur ve YENIDEN calistirinca hicbir sey yazilmaz (idempotent)", () => {
  const root = mkProject();
  const r1 = applyHookInstall(root);
  assert.equal(r1.written, true);
  assert.equal(r1.changes.length, 3);

  const s = readSettings(root);
  assert.equal(commandsOf(s, "PreToolUse").length, 1);
  assert.equal(commandsOf(s, "PostToolUse").length, 1);
  assert.equal(commandsOf(s, "Stop").length, 1);
  assert.match(commandsOf(s, "PreToolUse")[0], /claude-gate\.mjs" pre$/);

  const r2 = applyHookInstall(root);
  assert.equal(r2.written, false, "ikinci calistirmada yazma olmamali");
});

test("Stop kaydinda matcher YOKTUR (Pre/Post'ta vardir)", () => {
  const root = mkProject();
  applyHookInstall(root);
  const s = readSettings(root);
  assert.equal(s.hooks.Stop[0].matcher, undefined, "Stop hook'u arac adina gore eslenmez");
  assert.equal(s.hooks.PreToolUse[0].matcher, "Edit|Write|MultiEdit");
});

test("YABANCI hook kaydina dokunulmaz — yan yana yasar", () => {
  const yabanci = { type: "command", command: "node scripts/benim-kendi-hookum.mjs" };
  const root = mkProject({
    hooks: { PreToolUse: [{ matcher: "Edit", hooks: [yabanci] }] },
    permissions: { allow: ["Bash(npm test)"] },
  });
  const r = applyHookInstall(root);
  assert.equal(r.foreign, 1, "yabanci kayit sayilmali");

  const s = readSettings(root);
  const cmds = commandsOf(s, "PreToolUse");
  assert.ok(cmds.includes(yabanci.command), "yabanci hook korunmali");
  assert.equal(cmds.length, 2, "yabanci + bizimki");
  assert.deepEqual(s.permissions.allow, ["Bash(npm test)"], "ilgisiz ayarlar bozulmamali");
});

test("BAYAT kaydimiz guncellenir, kopya birakmaz (paket tasindi senaryosu)", () => {
  const root = mkProject({
    hooks: {
      PreToolUse: [{ matcher: "Edit|Write", hooks: [{ type: "command", command: 'node "/eski/yol/hooks/claude-gate.mjs" pre' }] }],
    },
  });
  const p = planHookInstall(root);
  assert.equal(p.hooks.find(h => h.event === "PreToolUse").state, "stale");

  applyHookInstall(root);
  const cmds = commandsOf(readSettings(root), "PreToolUse");
  assert.equal(cmds.length, 1, "eski kayit kalmamali — iki kapi iki kez konusur");
  assert.ok(cmds[0].includes(GATE_SCRIPT), "yeni yola guncellenmeli");
});

test("mode 'missing' (init): BAYAT kaydimiza DOKUNMAZ", () => {
  const eski = 'node "/eski/yol/hooks/claude-gate.mjs" pre';
  const root = mkProject({ hooks: { PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: eski }] }] } });
  applyHookInstall(root, { mode: "missing" });
  const s = readSettings(root);
  assert.deepEqual(commandsOf(s, "PreToolUse"), [eski], "init kullanicinin kaydini ezmez");
  assert.equal(commandsOf(s, "Stop").length, 1, "ama EKSIK olay yine de eklenir");
});

test("BOZUK JSON: fail-loud — yazmaz, ezmez", () => {
  const bozuk = '{ "hooks": { bu gecerli json degil';
  const root = mkProject(bozuk);
  const p = planHookInstall(root);
  assert.ok(p.error, "hata bildirilmeli");

  const r = applyHookInstall(root);
  assert.equal(r.written, false);
  assert.equal(readFileSync(settingsPathOf(root), "utf8"), bozuk, "dosya BIREBIR korunmali");
});

test("var olan settings.json degisecekse once yedek alinir", () => {
  const root = mkProject({ permissions: { allow: [] } });
  const r = applyHookInstall(root);
  assert.ok(r.backup && existsSync(r.backup), "yedek dosyasi olusmali");
  assert.deepEqual(JSON.parse(readFileSync(r.backup, "utf8")), { permissions: { allow: [] } });
});

test("kapi betigi yoksa durum 'broken' — sessizce 'kurulu' demez", () => {
  const root = mkProject();
  const yokYol = join(root, "olmayan", "claude-gate.mjs");
  applyHookInstall(root, { gateScript: yokYol });
  const p = planHookInstall(root, { gateScript: yokYol });
  assert.equal(p.gateExists, false);
  assert.ok(p.hooks.every(h => h.state === "broken"));
});

test("gateHooks: uc olay ve uc mod (pre/post/stop) eksiksiz", () => {
  const h = gateHooks("/x/claude-gate.mjs");
  assert.deepEqual(h.map(x => x.event), ["PreToolUse", "PostToolUse", "Stop"]);
  assert.deepEqual(h.map(x => x.command.split(" ").pop()), ["pre", "post", "stop"]);
});
