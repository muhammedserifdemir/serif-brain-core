#!/usr/bin/env node
// serif-brain Claude Code kapisi — disiplini TAVSIYEDEN KAPIYA cevirir.
//
//   node hooks/claude-gate.mjs session ← SessionStart: oturum acilisinda "neredeyiz"
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
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(HERE, "../bin/serif-brain.mjs");
const MODE = process.argv[2] || "pre";
const EVENT = { session: "SessionStart", pre: "PreToolUse", post: "PostToolUse", stop: "Stop" }[MODE] || "PreToolUse";

// HATA GUNLUGU.
//
// Kapinin sozlesmesi "oturumu asla bozma" idi ve bu dogru. Ama uygulamasi
// "hatayi YOK ET" seklindeydi: her catch sessizce yutuyordu. Sonucu 2026-08-11'de
// olculdu — kapi AYLARCA sorun bulundugunda susuyordu (review exit 2 veriyor,
// execFileSync firlatiyor, catch yutuyor) ve kimse fark etmedi.
//
// Dogru sozlesme: oturumu bozma AMA izini birak. Gunluk kapali dongu
// olusturmasin diye kendi yazma hatasini yutar (tek yer).
function gunlukYaz(projectRoot, olay, hata) {
  try {
    const dizin = join(projectRoot, ".serif-brain", ".cache");
    mkdirSync(dizin, { recursive: true });
    const yol = join(dizin, "gate.log");
    // Sinirsiz buyume yok: 200 satiri gecerse son 100'u tut.
    let onceki = [];
    try { onceki = readFileSync(yol, "utf8").split("\n").filter(Boolean); } catch { /* ilk yazim */ }
    if (onceki.length > 200) onceki = onceki.slice(-100);
    const satir = JSON.stringify({ t: new Date().toISOString(), mod: MODE, olay, hata: String(hata?.message || hata || "").slice(0, 300) });
    writeFileSync(yol, [...onceki, satir].join("\n") + "\n");
  } catch { /* gunluk yazilamiyorsa yapacak bir sey yok — dongu kurma */ }
}

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

// DIKKAT — burada uzun sure sessiz bir hata vardi (2026-08-11'de bulundu):
// `review`, `layers` ve `lint` BULGU VARSA exit 2 verir; bu sozlesme gereklidir
// (pre-commit kapisi olarak kullanilirlar). execFileSync ise sifir-olmayan her
// cikista FIRLATIR. Eski kod bunu "komut basarisiz" sayip null donuyordu — yani
// Stop kapisi, TAM DA SORUN BULUNDUGUNDA susuyordu. Kapinin varlik sebebinin
// tersi. Sorun yokken (exit 0) konusuyor, sorun varken susuyordu; bu yuzden
// yillardir "temiz" gorunuyordu.
//
// Cozum: hata nesnesi stdout'u tasir. Once onu ayristirmayi dene; ancak
// gercekten cikti yoksa null don.
function brainJson(projectRoot, args) {
  const argv = [BIN, ...args, "--project", projectRoot, "--json"];
  const opts = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10000 };
  let out, hata = null;
  try {
    out = execFileSync(process.execPath, argv, opts);
  } catch (e) {
    out = e?.stdout; // exit 2 = "bulgu var" — cikti gecerlidir
    hata = e;
  }
  if (!out) { gunlukYaz(projectRoot, `komut ciktisi bos: ${args[0]}`, hata); return null; }
  try { return JSON.parse(out); }
  catch (e) { gunlukYaz(projectRoot, `JSON ayristirilamadi: ${args[0]}`, e); return null; }
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

// OTURUM ACILISI: "neredeyiz".
//
// NEDEN HOOK, NEDEN DOSYA DEGIL: `context` uzun suredir CLAUDE.generated.md
// uretiyordu ama onu kimse OKUMUYORDU — Claude Code kok dizindeki CLAUDE.md'yi
// okur, .serif-brain/context/ altini degil. Ureteni olan ama okuyani olmayan
// dosya. Ustelik dosyaya yazilan bagliam yazildigi anda bayatlamaya baslar;
// hook her oturumda TAZE uretir, bayatlayacak bir kopya birakmaz.
//
// Token sozlesmesi: bu metin HER oturuma girer. Yalniz karar verdiren sey
// yazilir (aktif plan/bug/karar basliklari + yakalanmamis sayisi), gerisi
// komutla istenir. Hicbiri yoksa SUSAR — bos brain'de gurultu uretmez.
function session(projectRoot) {
  const b = brainJson(projectRoot, ["brief", "--days", "7", "--stamp"]);
  if (!b || b.brain === false) return;

  const lines = [];
  const bas = (r) => `    · ${r.title}${r.id ? ` [${r.id}]` : ""}`;

  for (const p of (b.active_plans || []).slice(0, 2)) lines.push(`  🗺 AKTIF PLAN:\n${bas(p)}`);
  if (b.active_bugs?.length) {
    lines.push(`  ⛔ ACIK kritik/yuksek bug (${b.active_bugs.length}):`);
    for (const r of b.active_bugs.slice(0, 3)) lines.push(bas(r));
  }
  if (b.active_decisions?.length) {
    lines.push(`  📌 IHLAL ETME — aktif karar (${b.active_decisions.length}):`);
    for (const r of b.active_decisions.slice(0, 3)) lines.push(bas(r));
  }
  if (b.since && !b.since.sessiz) {
    lines.push(`  🆕 Son bakistan beri (${b.since.gun}g): ${b.since.yeni_kayit} yeni kayit · ${b.since.kapanan_kayit} kapandi · ${b.since.commit} commit`);
  }
  if (b.uncaptured?.count) {
    lines.push(`  📝 ${b.uncaptured.count} commit hafizaya gecmemis (serif-brain capture --days ${b.uncaptured.days} --apply)`);
  }

  if (!lines.length) return;
  emit([
    `[serif-brain] Bu projenin bir hafizasi var. Oturum acilisi:`,
    ...lines,
    `  Tamami: serif-brain brief   ·   Dosyaya dokunmadan once: serif-brain guard <dosya>`,
  ]);
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

  // NOT: "hafizaya gecmemis commit" uyarisi buradan KALDIRILDI (2026-08-11).
  // Stop kapisi OLAY bildirir — az once ne yaptin. Yakalanmamis commit ise
  // DURUM'dur: is yapilana kadar degismez, dolayisiyla her durma denemesinde
  // ayni metni uretir ve kapiyi sonsuz donguye sokar. Durum bildirimi oturum
  // ACILISINA aittir (SessionStart + brief), orada dogasi geregi bir kez cikar.
  if (!lines.length) return; // temiz + tam kapsam → sus
  emitOnce(projectRoot, [`[serif-brain review] "bitti" demeden once:`, ...lines]);
}

// Stop kapisi icin TEKRAR KORUMASI.
//
// NEDEN VAR (gercek olay, 2026-08-11): Stop hook'u konusunca model yeniden
// istem alir, bir sey soyler, tekrar durmayi dener — kapi AYNI metni yine
// uretir. Kullanicinin ekraninda "Bekliyorum. Bekliyorum. Bekliyorum..." diye
// giden bir dongu olustu.
//
// Tasarim sozlesmesi "soyleyecek sey yoksa sus" diyordu; eksik olan kural
// suydu: SOYLEYECEGINI ZATEN SOYLEDIYSEN DE SUS. Bir Stop kapisinin ciktisi
// durum degismeden tekrarlaniyorsa, o kapi bir uyari degil bir dongudur.
//
// Kural: ayni metin ikinci kez URETILMEZ. Icerik degisirse (yeni sorun, yeni
// dosya) yeniden konusur — yani sinyal kaybolmaz, yalniz tekrar susturulur.
function emitOnce(projectRoot, lines) {
  const text = lines.filter(Boolean).join("\n").trim();
  if (!text) return;
  const izPath = join(projectRoot, ".serif-brain", ".cache", "last-stop.json");
  let onceki = null;
  try { onceki = JSON.parse(readFileSync(izPath, "utf8"))?.hash ?? null; } catch { /* iz yok */ }
  const hash = createHash("sha1").update(text).digest("hex");
  if (onceki === hash) return; // ayni seyi ikinci kez soyleme — dongu buradan dogar
  try {
    mkdirSync(dirname(izPath), { recursive: true });
    writeFileSync(izPath, JSON.stringify({ hash, at: new Date().toISOString() }) + "\n");
  } catch { /* iz yazilamadi — konusmak yine de dongu riskinden iyidir */ }
  emit(lines);
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
  } else if (MODE === "session") {
    session(projectRoot);
  } else {
    const raw = payload.tool_input?.file_path;
    if (raw) {
      const abs = isAbsolute(raw) ? raw : resolve(projectRoot, raw);
      const rel = relative(projectRoot, abs) || raw;
      // proje disina cikan yollar (../) bu brain'in konusu degil
      if (!rel.startsWith("..")) (MODE === "post" ? post : pre)(projectRoot, rel);
    }
  }
} catch (e) {
  // Oturumu BOZMA sozlesmesi duruyor (exit 0), ama hata artik IZ BIRAKIYOR.
  try { gunlukYaz(process.env.CLAUDE_PROJECT_DIR || process.cwd(), "kapi coktu", e); } catch { /* son care */ }
}

process.exit(0);
