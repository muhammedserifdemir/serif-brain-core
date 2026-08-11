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

  const title = (x) => x?.title || x?.id || String(x);
  const lines = [];

  // 1) TAM BU DOSYAYA ozel olanlar — tamami gosterilir, en degerli sinyal bunlar.
  for (const h of g.signature_hits || []) lines.push(`  ⚠ IMZA: ${h.message || h.name} @${h.line ?? "?"}`);
  for (const f of g.file_hits || []) lines.push(`  🔗 BU DOSYA: ${f.type || "kayit"} — ${title(f)} [${f.status ?? "?"}]`);

  // 2) Modul geneli kayitlar — OZETLENIR. Bunlar modulun her dosyasinda ayni
  // cikar; her Edit'te tam liste basmak kapiyi bir gunde okunmaz hale getirir.
  // Oturum acilisindaki 'serif-brain context' zaten tam listeyi veriyor.
  const modul = [
    ...(g.must_not_violate || []).map(d => ({ tag: "aktif karar", t: title(d) })),
    ...(g.open_bugs || []).map(b => ({ tag: "ACIK BUG", t: title(b) })),
    ...(g.scars || []).map(s => ({ tag: "yara izi", t: title(s) })),
  ];
  if (modul.length) {
    const bas = modul[0];
    const kalan = modul.length - 1;
    lines.push(`  📎 Modul (${g.module || "?"}) geneli: ${bas.tag} — ${bas.t}` +
               (kalan > 0 ? ` · +${kalan} kayit daha` : ""));
  }

  // 3) Bu duzenlemeye ozel risk sinyalleri
  const risk = g.risk?.level;
  const blast = g.blast_radius?.transitive ?? null;
  if (risk === "high" || risk === "critical") lines.push(`  📈 RISK: ${risk} (skor ${g.risk.score})`);
  if (blast && blast >= 10) lines.push(`  💥 BLAST: ${blast} dosya bu dosyaya (gecisli) bagli`);

  if (!lines.length) return; // temiz → sus
  emit([`[serif-brain] ${file}:`, ...lines, `  (Tamami: serif-brain guard ${file})`]);
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

  lines.push(...yakalanmamis(projectRoot));

  if (!lines.length) return; // temiz + tam kapsam → sus
  emit([`[serif-brain review] "bitti" demeden once:`, ...lines]);
}

// Hafizaya GECMEMIS commit'ler.
//
// NEDEN: `capture` (commit → aday bug/karar) uzun suredir vardi ama onu hicbir
// sey tetiklemiyordu. Olcum (bu paketin kendi reposu, 2026-08-11): 35 commit,
// 8 obje — 6'si tek gunden. `capture --days 30` o an 9 aday buluyordu. Yani
// bilgi commit mesajlarinda duruyordu, hafizaya HIC gecmemisti. Hafiza yalniz
// insan "kaydet" dediginde buyuyordu.
//
// NEDEN YAZMIYOR: bu brain'in gecmisinde "otomatik churn yazan yok" karari var
// (eski bridge emekli edildi, automation_id_patterns + prune o yuzden eklendi).
// Kapinin isi YAZMAK degil, ATLANANIN GORUNMESI. Yazma karari insanda kalir.
//
// Gurultu sozlesmesi: `capture` yuksek-precision'dir (feat/chore/docs/merge/
// surum commit'leri zaten elenir), oneri yoksa burasi SUSAR ve mesaj tek
// komutla eyleme donusur. Kapatmak icin config.yaml: capture_reminder: false
function yakalanmamis(projectRoot) {
  const cfg = readConfigFlag(projectRoot, "capture_reminder");
  if (cfg === false) return [];
  const c = brainJson(projectRoot, ["capture", "--days", "14"]);
  const p = c?.proposals || [];
  if (!p.length) return [];
  const bas = p.slice(0, 3).map(x => `    · [${x.type}] ${x.title}`);
  return [
    `  📝 HAFIZAYA GECMEMIS: ${p.length} commit (son 14 gun) hafizada karsiliksiz:`,
    ...bas,
    p.length > 3 ? `    · +${p.length - 3} commit daha` : null,
    `    Yaz: serif-brain capture --days 14 --apply   (once gormek icin --apply'siz calistir)`,
  ].filter(Boolean);
}

// config.yaml'dan tek bir bayrak okur. Tam YAML parser'i hook'a tasimamak icin
// satir taramasi yeter — deger yoksa null doner (varsayilan: acik).
function readConfigFlag(projectRoot, key) {
  try {
    const raw = readFileSync(join(projectRoot, ".serif-brain", "config.yaml"), "utf8");
    const m = raw.match(new RegExp(`^${key}\\s*:\\s*(\\S+)`, "m"));
    if (!m) return null;
    return m[1] === "false" ? false : m[1] === "true" ? true : m[1];
  } catch { return null; }
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
