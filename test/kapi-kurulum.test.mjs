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

// Testler gelistiricinin GERCEK ~/.claude/settings.json'ini okumamali:
// ortama bagli test, makinede yesil CI'da kirmizi demektir.
const YOK_GLOBAL = join(tmpdir(), "sbc-olmayan-global", "settings.json");
const plan = (root, o = {}) => planHookInstall(root, { globalPath: YOK_GLOBAL, ...o });
const apply = (root, o = {}) => applyHookInstall(root, { globalPath: YOK_GLOBAL, ...o });

const readSettings = (root) => JSON.parse(readFileSync(settingsPathOf(root), "utf8"));
const commandsOf = (s, event) =>
  (s.hooks?.[event] || []).flatMap(e => (e.hooks || []).map(h => h.command));

test("plan: settings.json yokken tum olaylar 'missing'", () => {
  const p = plan(mkProject());
  assert.deepEqual(p.hooks.map(h => h.state), ["missing", "missing", "missing", "missing"]);
  assert.equal(p.exists, false);
  assert.equal(p.gateExists, true, "paket kendi kapi betigini tasimali");
});

test("apply: tum olaylar kurulur ve YENIDEN calistirinca hicbir sey yazilmaz (idempotent)", () => {
  const root = mkProject();
  const r1 = apply(root);
  assert.equal(r1.written, true);
  assert.equal(r1.changes.length, 4);

  const s = readSettings(root);
  assert.equal(commandsOf(s, "SessionStart").length, 1);
  assert.equal(commandsOf(s, "PreToolUse").length, 1);
  assert.equal(commandsOf(s, "PostToolUse").length, 1);
  assert.equal(commandsOf(s, "Stop").length, 1);
  assert.match(commandsOf(s, "PreToolUse")[0], /claude-gate\.mjs" pre$/);

  const r2 = apply(root);
  assert.equal(r2.written, false, "ikinci calistirmada yazma olmamali");
});

test("Stop/SessionStart kaydinda matcher YOKTUR (Pre/Post'ta vardir)", () => {
  const root = mkProject();
  apply(root);
  const s = readSettings(root);
  assert.equal(s.hooks.Stop[0].matcher, undefined, "Stop hook'u arac adina gore eslenmez");
  assert.equal(s.hooks.SessionStart[0].matcher, undefined, "SessionStart da arac adina gore eslenmez");
  assert.equal(s.hooks.PreToolUse[0].matcher, "Edit|Write|MultiEdit");
});

test("YABANCI hook kaydina dokunulmaz — yan yana yasar", () => {
  const yabanci = { type: "command", command: "node scripts/benim-kendi-hookum.mjs" };
  const root = mkProject({
    hooks: { PreToolUse: [{ matcher: "Edit", hooks: [yabanci] }] },
    permissions: { allow: ["Bash(npm test)"] },
  });
  const r = apply(root);
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
  const p = plan(root);
  assert.equal(p.hooks.find(h => h.event === "PreToolUse").state, "stale");

  apply(root);
  const cmds = commandsOf(readSettings(root), "PreToolUse");
  assert.equal(cmds.length, 1, "eski kayit kalmamali — iki kapi iki kez konusur");
  assert.ok(cmds[0].includes(GATE_SCRIPT), "yeni yola guncellenmeli");
});

test("mode 'missing' (init): BAYAT kaydimiza DOKUNMAZ", () => {
  const eski = 'node "/eski/yol/hooks/claude-gate.mjs" pre';
  const root = mkProject({ hooks: { PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: eski }] }] } });
  apply(root, { mode: "missing" });
  const s = readSettings(root);
  assert.deepEqual(commandsOf(s, "PreToolUse"), [eski], "init kullanicinin kaydini ezmez");
  assert.equal(commandsOf(s, "Stop").length, 1, "ama EKSIK olay yine de eklenir");
});

test("BOZUK JSON: fail-loud — yazmaz, ezmez", () => {
  const bozuk = '{ "hooks": { bu gecerli json degil';
  const root = mkProject(bozuk);
  const p = plan(root);
  assert.ok(p.error, "hata bildirilmeli");

  const r = apply(root);
  assert.equal(r.written, false);
  assert.equal(readFileSync(settingsPathOf(root), "utf8"), bozuk, "dosya BIREBIR korunmali");
});

test("var olan settings.json degisecekse once yedek alinir", () => {
  const root = mkProject({ permissions: { allow: [] } });
  const r = apply(root);
  assert.ok(r.backup && existsSync(r.backup), "yedek dosyasi olusmali");
  assert.deepEqual(JSON.parse(readFileSync(r.backup, "utf8")), { permissions: { allow: [] } });
});

test("kapi betigi yoksa durum 'broken' — sessizce 'kurulu' demez", () => {
  const root = mkProject();
  const yokYol = join(root, "olmayan", "claude-gate.mjs");
  apply(root, { gateScript: yokYol });
  const p = plan(root, { gateScript: yokYol });
  assert.equal(p.gateExists, false);
  assert.ok(p.hooks.every(h => h.state === "broken"));
});

test("gateHooks: dort olay ve dort mod (session/pre/post/stop) eksiksiz", () => {
  const h = gateHooks("/x/claude-gate.mjs");
  assert.deepEqual(h.map(x => x.event), ["SessionStart", "PreToolUse", "PostToolUse", "Stop"]);
  assert.deepEqual(h.map(x => x.command.split(" ").pop()), ["session", "pre", "post", "stop"]);
});

// ── CLAUDE.md isaret blogu ─────────────────────────────────────────────────
// `context` .serif-brain/context/CLAUDE.generated.md uretiyordu ama Claude Code
// KOK CLAUDE.md'yi okur: ureteni olan, okuyani olmayan dosya.
import { planClaudeMd, applyClaudeMd, BEGIN, END } from "../src/context/claude-md.mjs";

test("CLAUDE.md: yoksa olusturulur, ikinci calistirma yazmaz", () => {
  const root = mkProject();
  const r1 = applyClaudeMd(root);
  assert.equal(r1.written, true);
  assert.match(readFileSync(r1.path, "utf8"), /serif-brain brief/);
  assert.equal(applyClaudeMd(root).written, false, "idempotent olmali");
});

test("CLAUDE.md: kullanicinin kendi icerigi KORUNUR (yalniz isaretler arasi degisir)", () => {
  const root = mkProject();
  const path = join(root, "CLAUDE.md");
  writeFileSync(path, "# Benim projem\n\nBuraya dokunma.\n");
  applyClaudeMd(root);
  const raw = readFileSync(path, "utf8");
  assert.match(raw, /# Benim projem/);
  assert.match(raw, /Buraya dokunma\./);
  assert.ok(raw.includes(BEGIN) && raw.includes(END));
});

test("CLAUDE.md: BAYAT blok guncellenir, kullanici metni yerinde kalir", () => {
  const root = mkProject();
  const path = join(root, "CLAUDE.md");
  writeFileSync(path, `ONCE\n${BEGIN}\neski icerik\n${END}\nSONRA\n`);
  assert.equal(planClaudeMd(root).state, "stale");
  applyClaudeMd(root);
  const raw = readFileSync(path, "utf8");
  assert.match(raw, /^ONCE/m);
  assert.match(raw, /^SONRA/m);
  assert.ok(!raw.includes("eski icerik"), "bayat blok kalmamali");
  assert.equal((raw.match(new RegExp(BEGIN.slice(0, 20), "g")) || []).length, 1, "blok cogalmamali");
});

test("CLAUDE.md: aktif is LISTESI yazilmaz (bayatlayacak icerik en pahali yerde durmaz)", () => {
  const root = mkProject();
  const raw = readFileSync(applyClaudeMd(root).path, "utf8");
  assert.ok(!/\[bug-\d|\[decision-\d/.test(raw), "obje id listesi bu dosyaya girmemeli");
});

// ── Cift kapi / global ayar ────────────────────────────────────────────────
// Claude Code global ve proje hook'larini BIRLESTIRIR. Global'de kurulu bir
// kapiyi gormeyen kurulum uzerine bir tane daha ekler → kapi iki kez calisir,
// ayni metni iki kez basar. Gercekte yasandi (kullanicinin ~/.claude'unda
// args-bicimli kayit vardi, tanima yalniz `command` alanina bakiyordu).
import { globalSettingsPath } from "../src/hooks/install.mjs";

test("TANIMA: args bicimindeki kayit da BIZIMDIR (yoksa uzerine ikinci kapi acilir)", () => {
  const root = mkProject({
    hooks: {
      PreToolUse: [{
        matcher: "Edit|Write",
        hooks: [{ type: "command", command: "node", args: [GATE_SCRIPT, "pre"] }],
      }],
    },
  });
  const p = planHookInstall(root, { includeGlobal: false });
  const pre = p.hooks.find(h => h.event === "PreToolUse");
  assert.notEqual(pre.state, "missing", "args bicimi 'yok' sayilmamali");
  assert.equal(p.foreign, 0, "kendi kaydimizi yabanci saymamali");

  applyHookInstall(root, { includeGlobal: false });
  assert.equal(commandsOf(readSettings(root), "PreToolUse").length, 1, "tek kayit kalmali — cift kapi olmaz");
});

test("globalSettingsPath: ~/.claude/settings.json", () => {
  assert.match(globalSettingsPath(), /\.claude[/\\]settings\.json$/);
});

test("plan: includeGlobal:false ile proje dosyasi tek basina degerlendirilir", () => {
  const p = planHookInstall(mkProject(), { includeGlobal: false });
  assert.ok(p.hooks.every(h => h.state === "missing"));
  assert.ok(p.hooks.every(h => h.scope === null));
});
