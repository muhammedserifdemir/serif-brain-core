// Canli panel testleri — surec yonetimi, kesif ve API guvenligi.
// En kritik sozlesme: panel YABANCI sureci onaysiz oldurmez. Bu kaybolursa
// terminalde acilmis bir isi panel sessizce kapatabilir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

    const bulunan = findBrains(kok).map(p => p.replace(kok + "/", "")).sort();
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
