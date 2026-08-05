// Claude Code kapisi (hooks/claude-gate.mjs) — GERCEK hook yuku stdin'den verilir.
// Kilitlenen sozlesme:
//   1) her zaman exit 0 (kapi oturumu asla bozmaz)
//   2) soyleyecek sey yoksa TAMAMEN sessiz (gurultu kapiyi degersizlestirir)
//   3) konusuyorsa hookSpecificOutput.additionalContext ile konusur —
//      cunku Pre/PostToolUse'ta duz stdout Claude'a ULASMAZ
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = resolve(HERE, "../hooks/claude-gate.mjs");

function runGate(mode, payload, env = {}) {
  const out = execFileSync(process.execPath, [GATE, mode], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return out;
}

function parseEmit(out) {
  if (!out.trim()) return null;
  return JSON.parse(out);
}

function makeBrainProject() {
  const tmp = mkdtempSync(join(tmpdir(), "sb-gate-"));
  mkdirSync(join(tmp, ".serif-brain", "graph"), { recursive: true });
  mkdirSync(join(tmp, "src"), { recursive: true });
  writeFileSync(join(tmp, ".serif-brain", "config.yaml"), "layer_rules: []\nbug_signatures: []\n");
  writeFileSync(join(tmp, "src", "a.mjs"), "export const a = 1;\n");
  return tmp;
}

test("kapi — .serif-brain OLMAYAN projede tamamen sessiz, exit 0", () => {
  const tmp = mkdtempSync(join(tmpdir(), "sb-nobrain-"));
  try {
    writeFileSync(join(tmp, "x.mjs"), "export const x = 1;\n");
    const out = runGate("pre", { tool_input: { file_path: "x.mjs" }, cwd: tmp }, { CLAUDE_PROJECT_DIR: tmp });
    assert.equal(out.trim(), "", "brain'siz projede kapi konusmamali");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("kapi — temiz dosyada SUSAR (her Edit'te sabit metin basmaz)", () => {
  const tmp = makeBrainProject();
  try {
    const out = runGate("pre", { tool_input: { file_path: "src/a.mjs" }, cwd: tmp }, { CLAUDE_PROJECT_DIR: tmp });
    assert.equal(out.trim(), "", "bulgu yokken kapi susmali");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("kapi — imza eslesmesinde KONUSUR ve additionalContext kullanir", () => {
  const tmp = makeBrainProject();
  try {
    // Projeye-ozel bug imzasi tanimla; guard bunu yakalamali
    writeFileSync(join(tmp, ".serif-brain", "config.yaml"),
      `layer_rules: []
bug_signatures:
  - { name: yasak-cagri, pattern: "eval\\\\(", message: "eval kullanma", severity: high }
`);
    writeFileSync(join(tmp, "src", "a.mjs"), "export const a = eval('1');\n");

    const out = runGate("pre", { tool_input: { file_path: "src/a.mjs" }, cwd: tmp }, { CLAUDE_PROJECT_DIR: tmp });
    const j = parseEmit(out);
    assert.ok(j, "bulgu varken kapi konusmali");
    assert.equal(j.hookSpecificOutput.hookEventName, "PreToolUse");
    assert.match(j.hookSpecificOutput.additionalContext, /IMZA/);
    assert.match(j.hookSpecificOutput.additionalContext, /eval kullanma/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("kapi — stop modu: kapsam eksigini tur sonunda bildirir", () => {
  const tmp = makeBrainProject();
  try {
    // src/a.mjs grafta VAR, src/yeni.mjs olmayacak → "uncovered" yolu test edilir
    writeFileSync(join(tmp, ".serif-brain", "graph", "graph.json"), JSON.stringify({
      nodes: [{ id: "file:src/a.mjs", type: "file", path: "src/a.mjs", label: "src/a.mjs" }],
      edges: [],
    }));
    const git = (...a) => execFileSync("git", ["-C", tmp, ...a], { stdio: "ignore" });
    git("init", "-q");
    git("config", "user.email", "t@t.t");
    git("config", "user.name", "t");
    git("add", "-A");
    git("commit", "-qm", "base");
    writeFileSync(join(tmp, "src", "yeni.mjs"), "export const b = 2;\n"); // grafta yok

    const out = runGate("stop", { cwd: tmp }, { CLAUDE_PROJECT_DIR: tmp });
    const j = parseEmit(out);
    assert.ok(j, "kapsam eksikken stop kapisi konusmali");
    assert.equal(j.hookSpecificOutput.hookEventName, "Stop");
    assert.match(j.hookSpecificOutput.additionalContext, /KAPSAM/);
    assert.match(j.hookSpecificOutput.additionalContext, /src\/yeni\.mjs/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("kapi — bozuk stdin / eksik alan oturumu BOZMAZ", () => {
  const tmp = makeBrainProject();
  try {
    for (const bad of ["", "{bozuk json", JSON.stringify({}), JSON.stringify({ tool_input: {} })]) {
      const out = execFileSync(process.execPath, [GATE, "pre"], {
        input: bad, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: tmp },
      });
      assert.equal(out.trim(), "", `bozuk yukte sessiz kalmali: ${bad.slice(0, 20)}`);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("kapi — proje disi dosya yolunu yok sayar", () => {
  const tmp = makeBrainProject();
  try {
    const out = runGate("pre", { tool_input: { file_path: "/etc/hosts" }, cwd: tmp }, { CLAUDE_PROJECT_DIR: tmp });
    assert.equal(out.trim(), "", "proje disindaki dosya bu brain'in konusu degil");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
