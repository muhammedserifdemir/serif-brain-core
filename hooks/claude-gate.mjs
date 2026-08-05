#!/usr/bin/env node
// serif-brain Claude Code kapisi — disiplini TAVSIYEDEN KAPIYA cevirir.
//
//   node hooks/claude-gate.mjs pre    ← PreToolUse  (Edit|Write): dokunmadan once hafiza
//   node hooks/claude-gate.mjs post   ← PostToolUse (Edit|Write): duzenlemeden hemen sonra yapisal kontrol
//   node hooks/claude-gate.mjs stop   ← Stop:                     "bitti" demeden once review kapisi
//
// NEDEN BU BETIK VAR (duz komut yerine):
// PreToolUse/PostToolUse'ta hook'un STDOUT'u Claude'a GITMEZ — sadece debug
// log'una yazilir. Yani `serif-brain guard <dosya>` diye duz bir komut baglamak
// calisiyormus gibi gorunur ama Claude hicbir sey gormez. Claude'a ulasmanin
// yolu stdout'a `hookSpecificOutput.additionalContext` JSON'u basmaktir.
//
// SOZLESME:
//   - HER ZAMAN exit 0. Bu kapi bloklamaz; hata verse bile oturumu bozmaz.
//   - Soyleyecek sey yoksa SUSAR. Her duzenlemede cikan sabit metin bir sure
//     sonra okunmaz hale gelir ve kapinin degerini sifirlar.
//   - .serif-brain olmayan projede sessizce cikar.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(HERE, "../bin/serif-brain.mjs");
const MODE = process.argv[2] || "pre";
const EVENT = { pre: "PreToolUse", post: "PostToolUse", stop: "Stop" }[MODE] || "PreToolUse";

function emit(lines) {
  const text = lines.filter(Boolean).join("\n").trim();
  if (!text) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: EVENT, additionalContext: text },
  }));
}

function readStdin() {
  try { return JSON.parse(readFileSync(0, "utf8")); }
  catch { return null; }
}

function brainJson(projectRoot, args) {
  try {
    const out = execFileSync(process.execPath, [BIN, ...args, "--project", projectRoot, "--json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10000,
    });
    return JSON.parse(out);
  } catch { return null; }
}

// ── Modlar ──────────────────────────────────────────────────────────────────

// Edit'ten ONCE: o dosyanin gecmisi. Sadece BULGU varsa konusur.
function pre(projectRoot, file) {
  const g = brainJson(projectRoot, ["guard", file]);
  if (!g) return;

  const lines = [];
  for (const d of g.must_not_violate || []) lines.push(`  ⛔ KISIT: ${d.title || d.id || d}`);
  for (const b of g.open_bugs || []) lines.push(`  🐞 ACIK BUG: ${b.title || b.id || b}`);
  for (const s of g.scars || []) lines.push(`  🩹 YARA IZI: ${s.title || s.id || s}`);
  for (const h of g.signature_hits || []) lines.push(`  ⚠ IMZA: ${h.message || h.name} @${h.line ?? "?"}`);

  const risk = g.risk?.level;
  const blast = g.blast_radius?.transitive_dependent_count ?? null;
  if (risk && risk !== "low") lines.push(`  📈 RISK: ${risk} (skor ${g.risk.score})`);
  if (blast && blast >= 10) lines.push(`  💥 BLAST: ${blast} dosya bu dosyaya bagli`);

  if (!lines.length) return; // temiz → sus
  emit([`[serif-brain] ${file} — bu dosyada hafiza kaydi var:`, ...lines,
        `  (Kaynak: serif-brain guard ${file})`]);
}

// Edit'ten HEMEN SONRA: yapisal bozulma. Grafta olmayan dosyada susar —
// kapsam eksikligini tur sonunda 'stop' modu zaten durustce raporluyor.
function post(projectRoot, file) {
  const c = brainJson(projectRoot, ["check", file]);
  if (!c || c.found === false || c.ok !== false) return;
  const issues = (c.issues || []).map(i => `  ✗ ${i}`);
  if (!issues.length) return;
  emit([`[serif-brain] ${file} — duzenleme sonrasi YAPISAL sorun:`, ...issues,
        `  Duzelt veya gerekcesini soyle.`]);
}

// "Bitti" demeden once: degisen tum dosyalarda kapi + KAPSAM etiketi.
// Sorun yoksa bile kapsam eksikse konusur — cunku "denetlenmedi" ile
// "temiz cikti" ayri seylerdir ve tur sonu bu ayrimin en kritik oldugu andir.
function stop(projectRoot) {
  const r = brainJson(projectRoot, ["review"]);
  if (!r) return;

  const lines = [];
  if (r.flagged) {
    lines.push(`  ⚠ ${r.flagged}/${r.changed} degisen dosyada sorun:`);
    for (const f of r.report || []) {
      for (const i of f.issues || []) lines.push(`    ✗ ${f.file}: ${i.detail}`);
    }
  }
  const cov = r.coverage;
  if (cov?.graph_missing && r.changed) {
    lines.push(`  ⚠ KAPSAM: graf yok — yapisal denetim HIC calismadi (serif-brain graph build).`);
  } else if (cov?.uncovered) {
    lines.push(`  ⚠ KAPSAM: ${cov.uncovered}/${r.changed} degisen dosya grafta yok — yapisal sonuc YOK:`);
    for (const f of cov.uncovered_files || []) lines.push(`    · ${f}`);
    lines.push(`    Duzelt: serif-brain graph build`);
  }

  if (!lines.length) return; // temiz + tam kapsam → sus
  emit([`[serif-brain review] "bitti" demeden once:`, ...lines]);
}

// ── Giris ───────────────────────────────────────────────────────────────────
try {
  const payload = readStdin() || {};
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();

  // serif-brain kullanmayan projede sessizce cik
  if (!existsSync(join(projectRoot, ".serif-brain"))) process.exit(0);

  if (MODE === "stop") {
    stop(projectRoot);
  } else {
    const raw = payload.tool_input?.file_path;
    if (raw) {
      const abs = isAbsolute(raw) ? raw : resolve(projectRoot, raw);
      const rel = relative(projectRoot, abs) || raw;
      // proje disina cikan yollar (../) bu brain'in konusu degil
      if (!rel.startsWith("..")) (MODE === "post" ? post : pre)(projectRoot, rel);
    }
  }
} catch { /* kapi asla oturumu bozmaz */ }

process.exit(0);
