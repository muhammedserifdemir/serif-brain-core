// Claude Code kapisini (hooks/claude-gate.mjs) hedef projenin .claude/settings.json
// dosyasina BAGLAYAN tek kaynak. Iki cagiran ayni kodu kullanir:
//   - init          → mode "missing": var olan kayit ASLA ezilmez
//   - hooks install → mode "sync":    bizim (bayat) kaydimiz guncellenir
//
// NEDEN BU DOSYA VAR
// Paket `hooks/claude-gate.mjs`'i tasiyordu ama onu hicbir sey settings.json'a
// baglamiyordu — kendi reposunda bile bagli degildi. Kurulmayan kapi kapi
// degildir: ajan `guard` calistirmayi HATIRLAMAK zorunda kalir, hatirlamaya
// dayali disiplin de disiplin degildir.
//
// SOZLESME
//   - YABANCI hook kayitlarina ASLA dokunulmaz (bizimkiler komutta claude-gate.mjs
//     gecmesiyle taninir). Kullanicinin kendi hook'u varsa yan yana yasar.
//   - Var olan settings.json degistirilecekse once yedegi alinir.
//   - Bozuk JSON okununca YAZILMAZ; fail-loud. Sessizce ezmek, kullanicinin
//     tum ayarlarini kaybettirmek demektir.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Paketle gelen kapi betiginin mutlak yolu. */
export const GATE_SCRIPT = resolve(HERE, "../../hooks/claude-gate.mjs");

/** Bizim kaydimizi yabancilardan ayiran isaret. */
export const GATE_MARKER = "claude-gate.mjs";

export function settingsPathOf(projectRoot) {
  return join(projectRoot, ".claude", "settings.json");
}

/**
 * Kurulacak kayitlar. Stop olayinda matcher YOKTUR (Claude Code Stop hook'unu
 * arac adina gore eslemez) — buraya bos matcher yazmak kaydi olusu bozuk yapar.
 */
export function gateHooks(gateScript = GATE_SCRIPT) {
  const cmd = (mode) => `node "${gateScript}" ${mode}`;
  return [
    // SessionStart bagliami DOSYAYA yazilmaz: dosyaya yazilan bagliam yazildigi
    // anda bayatlamaya baslar. Hook her oturumda TAZE uretir.
    { event: "SessionStart", matcher: null, command: cmd("session"),
      why: "oturum acilisinda 'neredeyiz' (aktif plan/bug/karar)" },
    { event: "PreToolUse", matcher: "Edit|Write|MultiEdit", command: cmd("pre"),
      why: "dokunmadan once o dosyanin hafizasi (guard)" },
    { event: "PostToolUse", matcher: "Edit|Write|MultiEdit", command: cmd("post"),
      why: "duzenlemeden hemen sonra yapisal kontrol (check)" },
    { event: "Stop", matcher: null, command: cmd("stop"),
      why: "'bitti' demeden once kapsam + review kapisi" },
  ];
}

function readSettings(settingsPath) {
  if (!existsSync(settingsPath)) return { exists: false, data: {} };
  const raw = readFileSync(settingsPath, "utf8");
  if (!raw.trim()) return { exists: true, data: {} };
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { exists: true, data: null, error: "settings.json bir JSON nesnesi degil" };
    }
    return { exists: true, data };
  } catch (e) {
    return { exists: true, data: null, error: `settings.json okunamadi (bozuk JSON): ${e.message}` };
  }
}

// Bir olayin altindaki kayitlari duzlestir: [{matcher, hooks:[{type,command}]}]
function entriesOf(data, event) {
  const arr = data?.hooks?.[event];
  return Array.isArray(arr) ? arr : [];
}

function isOurs(command) {
  return typeof command === "string" && command.includes(GATE_MARKER);
}

/**
 * Hicbir sey YAZMAZ — sadece durum cikarir.
 * Durumlar: missing | same | stale (bizim kayit ama komut farkli) | broken (kapi betigi yok)
 */
export function planHookInstall(projectRoot, { gateScript = GATE_SCRIPT } = {}) {
  const settingsPath = settingsPathOf(projectRoot);
  const { exists, data, error } = readSettings(settingsPath);
  const gateExists = existsSync(gateScript);

  if (error) return { settingsPath, exists, error, gateScript, gateExists, hooks: [], foreign: 0 };

  let foreign = 0;
  const hooks = gateHooks(gateScript).map((want) => {
    const existing = entriesOf(data, want.event);
    let state = "missing";
    let current = null;
    for (const entry of existing) {
      for (const h of Array.isArray(entry.hooks) ? entry.hooks : []) {
        if (isOurs(h.command)) {
          current = h.command;
          state = h.command === want.command ? "same" : "stale";
        } else {
          foreign++;
        }
      }
    }
    if (state !== "missing" && !gateExists) state = "broken";
    return { ...want, state, current };
  });

  return { settingsPath, exists, gateScript, gateExists, hooks, foreign, error: null };
}

/**
 * Kaydi yazar. mode:
 *   "missing" → yalnizca hic olmayan olay eklenir (init; var olani ezmez)
 *   "sync"    → bizim bayat kaydimiz da guncellenir (hooks install --apply)
 * Yabanci kayitlar her iki modda da korunur.
 */
export function applyHookInstall(projectRoot, { gateScript = GATE_SCRIPT, mode = "sync" } = {}) {
  const plan = planHookInstall(projectRoot, { gateScript });
  if (plan.error) return { ...plan, written: false, changes: [] };

  const settingsPath = plan.settingsPath;
  const { data } = readSettings(settingsPath);
  const next = data && typeof data === "object" ? data : {};
  if (!next.hooks || typeof next.hooks !== "object") next.hooks = {};

  const changes = [];
  for (const want of plan.hooks) {
    if (want.state === "same") continue;
    if (want.state !== "missing" && mode === "missing") continue; // init var olani ezmez

    const list = Array.isArray(next.hooks[want.event]) ? next.hooks[want.event] : [];
    // Bizim eski kaydimizi cikar (yabancilar kalir), sonra taze kaydi ekle.
    const kept = [];
    for (const entry of list) {
      const inner = (Array.isArray(entry.hooks) ? entry.hooks : []).filter(h => !isOurs(h.command));
      if (inner.length) kept.push({ ...entry, hooks: inner });
    }
    const fresh = { hooks: [{ type: "command", command: want.command }] };
    if (want.matcher) fresh.matcher = want.matcher;
    next.hooks[want.event] = [...kept, fresh];
    changes.push({ event: want.event, from: want.state, command: want.command });
  }

  if (!changes.length) return { ...plan, written: false, changes: [], backup: null };

  mkdirSync(dirname(settingsPath), { recursive: true });
  // Var olan dosya degisecekse once yedek — hook ayari kullanicinin baska
  // ayarlariyla ayni dosyada yasiyor, geri donusu olmayan yazma yapilmaz.
  let backup = null;
  if (plan.exists) {
    backup = `${settingsPath}.serif-brain-yedek`;
    try { copyFileSync(settingsPath, backup); } catch { backup = null; }
  }
  writeFileSync(settingsPath, JSON.stringify(next, null, 2) + "\n");
  return { ...plan, written: true, changes, backup };
}
