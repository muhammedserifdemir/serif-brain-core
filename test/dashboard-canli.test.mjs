// Canli panel testleri — surec yonetimi, kesif ve API guvenligi.
// En kritik sozlesme: panel YABANCI sureci onaysiz oldurmez. Bu kaybolursa
// terminalde acilmis bir isi panel sessizce kapatabilir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import * as proc from "../src/dashboard/proc.mjs";
import { findBrains } from "../src/dashboard/api.mjs";
import { serve } from "../src/dashboard/server.mjs";

const bekle = ms => new Promise(r => setTimeout(r, ms));

function tmpRepo() {
  const d = mkdtempSync(join(tmpdir(), "sb-dash-"));
  mkdirSync(join(d, ".serif-brain"), { recursive: true });
  return d;
}

// Bu dosya SUNUCUYU test ediyor, GELISTIRICININ MAKINESINI degil. Fikstur
// registry olmadan `serve()` testleri ~/.serif-brain-registry.json okur: baska
// makinede yesil, burada kirmizi olur ve hata sunucuda mi kayittaki bir projede
// mi belli olmaz. Fikstur SILINMIS BIR PROJE de icerir — panelin en sik gercek
// hali budur (klasor tasinir/silinir, kayit kalir).
const SAGLAM = tmpRepo();
const HAYALET = join(tmpdir(), "sb-dash-silinmis-" + process.pid);
{
  const f = join(tmpdir(), `sb-registry-${process.pid}.json`);
  writeFileSync(f, JSON.stringify({
    brains: [{ repo: SAGLAM, name: "Saglam" }, { repo: HAYALET, name: "Hayalet" }],
  }));
  process.env.SERIF_BRAIN_REGISTRY = f;
}

test("proc — baslat/durdur: surec gercekten acilir ve gercekten kapanir", async () => {
  const repo = tmpRepo();
  try {
    const r = proc.start(repo, `node -e "setInterval(()=>{},1000)"`, null);
    assert.equal(r.ok, true);
    assert.ok(r.pid > 0);
    assert.equal(proc.status(repo).running, true);

    await proc.stop(repo);
    await bekle(300);
    assert.equal(proc.isOwned(repo), false, "durdurulan surec kayittan dusmeli");
    let yasiyor = true;
    try { process.kill(r.pid, 0); } catch { yasiyor = false; }
    assert.equal(yasiyor, false, "surec gercekten olmeli (kayit silmek yetmez)");
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("proc — calistirma komutu yoksa baslatmaz, ANLASILIR hata verir", () => {
  const repo = tmpRepo();
  try {
    const r = proc.start(repo, "", null);
    assert.equal(r.ok, false);
    assert.match(r.error, /komut/i);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("proc — ayni proje iki kez baslatilamaz", async () => {
  const repo = tmpRepo();
  try {
    proc.start(repo, `node -e "setInterval(()=>{},1000)"`, null);
    const r2 = proc.start(repo, `node -e "setInterval(()=>{},1000)"`, null);
    assert.equal(r2.ok, false);
    assert.match(r2.error, /zaten/i);
  } finally { await proc.stop(repo); rmSync(repo, { recursive: true, force: true }); }
});

test("proc — panelin baslatmadigi sureci stop() OLDURMEZ, onay ister", async () => {
  const repo = tmpRepo();
  try {
    const r = await proc.stop(repo);           // hic baslatilmadi
    assert.equal(r.ok, false);
    assert.equal(r.needsConfirm, true, "yabanci surec icin onay istenmeli");
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("proc — forceKillPort ONAYSIZ calismaz (en kritik guvenlik kapisi)", async () => {
  const r = await proc.forceKillPort(3999, { confirm: false });
  assert.equal(r.ok, false);
  assert.equal(r.needsConfirm, true);
});

test("proc — surec ciktisi gunluge yazilir", async () => {
  const repo = tmpRepo();
  try {
    proc.start(repo, `node -e "console.log('MERHABA-PANEL')"`, null);
    await bekle(500);
    const satirlar = proc.logs(repo).map(l => l.line).join("\\n");
    assert.match(satirlar, /MERHABA-PANEL/);
  } finally { await proc.stop(repo); rmSync(repo, { recursive: true, force: true }); }
});

test("kesif — .serif-brain iceren klasorler bulunur, node_modules atlanir", () => {
  const kok = mkdtempSync(join(tmpdir(), "sb-scan-"));
  try {
    mkdirSync(join(kok, "projeA", ".serif-brain"), { recursive: true });
    mkdirSync(join(kok, "alt", "projeB", ".serif-brain"), { recursive: true });
    mkdirSync(join(kok, "node_modules", "paket", ".serif-brain"), { recursive: true });
    mkdirSync(join(kok, "duz-klasor"), { recursive: true });

    // `p.replace(kok + "/", "")` Windows'ta hic tutmaz (ayrac "\") ve iddia
    // MUTLAK yolla karsilastirilir. relative() + POSIX'e cevir.
    const bulunan = findBrains(kok).map(p => relative(kok, p).split("\\").join("/")).sort();
    assert.deepEqual(bulunan, ["alt/projeB", "projeA"]);
  } finally { rmSync(kok, { recursive: true, force: true }); }
});

test("server — bilinmeyen proje yoluyla surec BASLATILAMAZ", async () => {
  const { server, port } = await serve({ port: 0 });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/start`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: "/etc", cmd: "echo saldiri" }),
    }).then(r => r.json());
    assert.equal(r.ok, false);
    assert.match(r.error, /bilinmeyen/i);
  } finally { server.close(); }
});

test("server — yalniz 127.0.0.1'e baglanir (agdan erisilemez)", async () => {
  const { server, port, host } = await serve({ port: 0 });
  try {
    assert.equal(host, "127.0.0.1");
    assert.equal(server.address().address, "127.0.0.1",
      "panel surec baslatabildigi icin dis arayuze ACILMAMALI");
    const r = await fetch(`http://127.0.0.1:${port}/api/projects?sync=0`).then(r => r.json());
    assert.ok(Array.isArray(r.active));
  } finally { server.close(); }
});

test("api — SILINMIS tek proje TUM paneli dusurmez", async () => {
  // Regresyon: kayip brain'de kayit yarim donuyordu (critItems yok), toplamlar
  // `critItems.some()` cagirinca /api/projects komple hata veriyordu — 19
  // brain'in 18'i sagliklidir ama panelde hicbiri gorunmezdi.
  const { server, port } = await serve({ port: 0 });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/projects?sync=0`).then(r => r.json());
    assert.ok(!r.error, `panel hata dondu: ${r.error}`);
    assert.equal(r.active.length, 2, "kayip proje listeden DUSURULMEZ");
    const hayalet = r.active.find(p => p.name === "Hayalet");
    assert.equal(hayalet.error, "brain bulunamadı");
    assert.ok(Array.isArray(hayalet.critItems), "kayit sema-tam donmeli");
    assert.equal(hayalet.objCount, 0);
    assert.equal(typeof r.totals.blocked, "number", "toplamlar hesaplanabilmeli");
  } finally { server.close(); }
});

test("server — arayuz servis edilir ve API uclari cevap verir", async () => {
  const { server, port } = await serve({ port: 0 });
  try {
    const html = await fetch(`http://127.0.0.1:${port}/`).then(r => r.text());
    assert.match(html, /serif-brain/);
    assert.match(html, /api\/projects/, "arayuz canli API'yi cagirmali (statik degil)");

    const bos = await fetch(`http://127.0.0.1:${port}/api/search?q=`).then(r => r.json());
    assert.deepEqual(bos.results, [], "bos sorgu tum brain'leri taramamali");

    const yok = await fetch(`http://127.0.0.1:${port}/api/bilinmeyen`);
    assert.equal(yok.status, 404);
  } finally { server.close(); }
});

test("cli — argumansiz 'dashboard' sunucu BASLATMAZ (varsayilan degismedi)", async () => {
  // 'serve' sonradan eklendi. Varsayilani ona cevirmek, komutu bilmeden
  // calistiran kullaniciyi bitmeyen bir sunucuya dusururdu.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/cli/dashboard.mjs", import.meta.url), "utf8");
  const i = src.indexOf("case undefined:");
  const j = src.indexOf("case \"build\":", i);
  const k = src.indexOf("case \"serve\":");
  assert.ok(i >= 0 && j > i, "'case undefined' hemen 'build' dalina dusmeli");
  assert.ok(k < i || j < src.indexOf("cmdServe", i),
    "'case undefined' ile 'build' arasina baska bir dal girmemeli (serve'e dusmesin)");
  assert.ok(!src.slice(i, j).includes("cmdServe"), "argumansiz dashboard serve'e DUSMEMELI");
});

test("silinen proje — OTOMATIK kaldirilmaz, KAYIP olarak isaretlenir", async () => {
  // Klasor diskte yok diye registry kaydini kendiliginden silmek, kullanicinin
  // AYARLARINI (port, calistirma komutu, hedef, arsiv gerekcesi) yok ederdi:
  // harici disk cikarildiginda veya klasor yeniden adlandirildiginda geri
  // alinamaz. Kayit durur, arayuz "KAYIP" der, silmeyi kullanici secer.
  const { collectBrain } = await import("../src/dashboard/collect.mjs");
  const yok = "/tmp/kesinlikle-olmayan-proje-" + process.pid;
  const r = collectBrain({ repo: yok, name: "Hayalet", override: { port: "1234" } });
  assert.equal(r.error, "brain bulunamadı", "kayip proje hata ile isaretlenmeli");
  assert.equal(r.name, "Hayalet", "kayit ve adi korunmali (sessizce dusurulmemeli)");
});

test("arayuz — kayip projede sayilar 'undefined' basmaz", async () => {
  const { renderApp } = await import("../src/dashboard/ui.mjs");
  const html = renderApp();
  assert.match(html, /KAYIP/, "kayip durumu arayuzde adlandirilmali");
  assert.match(html, /Panelden kaldır/, "tek tikla kaldirma sunulmali");
  assert.match(html, /p\.objCount \?\? 0/, "eksik sayi 0'a dusmeli, undefined basilmamali");
});

test("arayuz — emoji ikon KULLANILMAZ (SVG sembol seti)", async () => {
  const { renderApp } = await import("../src/dashboard/ui.mjs");
  const html = renderApp();
  // Tasarim kontrol listesi: ikonlar SVG olmali (Lucide/Heroicons tarzi)
  const emoji = html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
  assert.deepEqual(emoji, [], `arayuzde emoji ikon kalmis: ${emoji.join(" ")}`);
  assert.match(html, /<symbol id="i-oynat"/, "SVG sembol seti bulunmali");
});

test("arayuz — prefers-reduced-motion'a saygi duyar", async () => {
  const { renderApp } = await import("../src/dashboard/ui.mjs");
  assert.match(renderApp(), /prefers-reduced-motion/);
});

/* ── Kurulunca otomatik acilan panel ── */

test("panel — CI ve etkilesimsiz oturumda OTOMATIK ACILMAZ", async () => {
  // Kurulum betigi tarayici acmamali: CI'de gorunmez bir surec birakir,
  // otomasyonda beklenmedik yan etki olur.
  const { otomatikUygun } = await import("../src/dashboard/launch.mjs");
  const eskiCI = process.env.CI, eskiTTY = process.stdout.isTTY;
  try {
    process.env.CI = "1";
    assert.equal(otomatikUygun({}).ok, false, "CI'da acilmamali");
    delete process.env.CI;

    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    assert.equal(otomatikUygun({}).ok, false, "etkilesimsiz oturumda acilmamali");

    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    assert.equal(otomatikUygun({}).ok, true, "insan oturumunda acilmali");
    assert.equal(otomatikUygun({ "no-panel": true }).ok, false, "--no-panel devre disi birakmali");
    process.env.SERIF_BRAIN_NO_PANEL = "1";
    assert.equal(otomatikUygun({}).ok, false, "SERIF_BRAIN_NO_PANEL devre disi birakmali");
  } finally {
    delete process.env.SERIF_BRAIN_NO_PANEL;
    if (eskiCI === undefined) delete process.env.CI; else process.env.CI = eskiCI;
    Object.defineProperty(process.stdout, "isTTY", { value: eskiTTY, configurable: true });
  }
});

test("panel — ayaktaMi() YABANCI servisi bizimki sanmaz", async () => {
  const { ayaktaMi } = await import("../src/dashboard/launch.mjs");
  const { createServer } = await import("node:http");
  const sahte = createServer((q, s) => s.end("baska uygulama"));
  await new Promise(r => sahte.listen(0, "127.0.0.1", r));
  const port = sahte.address().port;
  try {
    assert.equal(await ayaktaMi(port), false,
      "4700'u baska bir uygulama tutuyorsa panel oraya BAGLANMAMALI");
  } finally { sahte.close(); }
});

test("panel — /api/health kimlik imzasi doner", async () => {
  const { server, port } = await serve({ port: 0 });
  try {
    const j = await fetch(`http://127.0.0.1:${port}/api/health`).then(r => r.json());
    assert.equal(j.serif_brain, true, "kimlik imzasi olmadan 'tek sunucu' kurali kurulamaz");
  } finally { server.close(); }
});

test("panel — sunucuyuGarantile IKINCI sunucu acmaz", async () => {
  const { sunucuyuGarantile } = await import("../src/dashboard/launch.mjs");
  const { createServer } = await import("node:http");
  // Bizim imzamizi veren bir sunucu zaten ayakta olsun
  const mevcut = createServer((q, s) => {
    s.writeHead(200, { "content-type": "application/json" });
    s.end(JSON.stringify({ serif_brain: true, ok: true }));
  });
  await new Promise(r => mevcut.listen(0, "127.0.0.1", r));
  const port = mevcut.address().port;
  try {
    const r = await sunucuyuGarantile(port);
    assert.equal(r.baslatildi, false, "ayakta olan varken yeni surec baslatilmamali");
    assert.equal(r.url, `http://127.0.0.1:${port}`);
  } finally { mevcut.close(); }
});

test("kesif — SERIF_BRAIN_SCAN_ROOTS varsayilanin YERINE gecer", async () => {
  // Eskiden ~/Desktop'a EKLENIYORDU; o zaman kok kumesi tam denetlenemiyordu
  // ve demo/test kosumuna gercek projeler siziyordu.
  const { scanRoots } = await import("../src/dashboard/api.mjs");
  const eski = process.env.SERIF_BRAIN_SCAN_ROOTS;
  try {
    process.env.SERIF_BRAIN_SCAN_ROOTS = "/tmp/a:/tmp/b";
    assert.deepEqual(scanRoots(), ["/tmp/a", "/tmp/b"], "verilen kokler TAM kume olmali");
    delete process.env.SERIF_BRAIN_SCAN_ROOTS;
    assert.equal(scanRoots().length, 1, "verilmezse tek varsayilan kok (~/Desktop)");
  } finally {
    if (eski === undefined) delete process.env.SERIF_BRAIN_SCAN_ROOTS;
    else process.env.SERIF_BRAIN_SCAN_ROOTS = eski;
  }
});
