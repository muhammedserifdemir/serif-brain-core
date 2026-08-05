// Panel sunucusu — JSON API + tek-sayfa arayuz. Saf Node http (sifir bagimlilik).
//
// GUVENLIK: yalniz 127.0.0.1'e baglanir. Panel surec baslatabildigi icin agdan
// erisilebilir olmasi kabul edilemez; dis arayuze acilmaz.
import { createServer } from "node:http";
import { resolve } from "node:path";
import * as api from "./api.mjs";
import * as proc from "./proc.mjs";
import { renderApp } from "./ui.mjs";

const JSON_H = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function send(res, code, data) {
  res.writeHead(code, JSON_H);
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((res) => {
    let b = "";
    req.on("data", (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on("end", () => { try { res(JSON.parse(b || "{}")); } catch { res({}); } });
  });
}

// Gelen repo yolu registry'de kayitli olmali. Dogrulanmamis yolla surec
// baslatmak, panelin en tehlikeli yuzeyi olurdu.
function requireRepo(res, repo) {
  const ok = api.knownRepo(repo);
  if (!ok) { send(res, 400, { ok: false, error: "bilinmeyen proje yolu" }); return null; }
  return ok;
}

async function handle(req, res, url) {
  const p = url.pathname;

  if (p === "/" || p === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(renderApp());
  }

  // Kimlik imzasi: "4700'u tutan bu mu?" sorusunun cevabi. launch.mjs bunu
  // sorar; baska bir uygulama portu tutuyorsa panel oraya baglanmaz.
  if (p === "/api/health") {
    return send(res, 200, { serif_brain: true, ok: true, pid: process.pid });
  }

  if (p === "/api/projects") {
    const sync = url.searchParams.get("sync") !== "0";
    return send(res, 200, api.listProjects({ sync }));
  }

  if (p === "/api/search") {
    return send(res, 200, api.searchAll(url.searchParams.get("q") || ""));
  }

  if (p === "/api/objects") {
    const repo = requireRepo(res, url.searchParams.get("repo"));
    if (!repo) return;
    return send(res, 200, api.projectObjects(repo, {
      type: url.searchParams.get("type"),
      status: url.searchParams.get("status"),
      q: url.searchParams.get("q") || "",
    }));
  }

  if (p === "/api/object") {
    const repo = requireRepo(res, url.searchParams.get("repo"));
    if (!repo) return;
    const det = api.objectDetail(repo, url.searchParams.get("id"));
    return det ? send(res, 200, det) : send(res, 404, { error: "obje bulunamadi" });
  }

  if (p === "/api/logs") {
    const repo = requireRepo(res, url.searchParams.get("repo"));
    if (!repo) return;
    return send(res, 200, { repo, lines: proc.logs(repo) });
  }

  if (req.method === "POST" && p === "/api/start") {
    const body = await readBody(req);
    const repo = requireRepo(res, body.repo);
    if (!repo) return;
    const rec = api.projectRecord(repo);
    return send(res, 200, proc.start(repo, body.cmd || rec?.run, rec?.port));
  }

  if (req.method === "POST" && p === "/api/stop") {
    const body = await readBody(req);
    const repo = requireRepo(res, body.repo);
    if (!repo) return;
    return send(res, 200, await proc.stop(repo));
  }

  // Yabanci surec: SADECE acik onayla. Onay yoksa proc katmani reddeder.
  if (req.method === "POST" && p === "/api/force-kill") {
    const body = await readBody(req);
    const port = Number(body.port);
    if (!port) return send(res, 400, { ok: false, error: "port gerekli" });
    return send(res, 200, await proc.forceKillPort(port, { confirm: body.confirm === true }));
  }

  // Onay ekraninin gosterecegi bilgi: portu kim tutuyor, hangi komut?
  if (p === "/api/port-owner") {
    const port = Number(url.searchParams.get("port"));
    const pids = proc.portOwners(port);
    return send(res, 200, { port, pids: pids.map(pid => ({ pid, cmd: proc.pidCommand(pid) })) });
  }

  // Panelden kaldirma — silinen/tasinan projeyi listeden dusurur.
  // Diskteki dosyalara DOKUNMAZ, yalnizca registry kaydini siler.
  if (req.method === "POST" && p === "/api/forget") {
    const body = await readBody(req);
    const repo = requireRepo(res, body.repo);
    if (!repo) return;
    return send(res, 200, api.forgetProject(repo));
  }

  if (req.method === "POST" && p === "/api/override") {
    const body = await readBody(req);
    const repo = requireRepo(res, body.repo);
    if (!repo) return;
    return send(res, 200, api.setOverride(repo, body.patch || {}));
  }

  send(res, 404, { error: "yok" });
}

export function createDashboardServer() {
  return createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    handle(req, res, url).catch((e) => {
      // Panel hatasi oturumu dusurmez; hata JSON olarak doner ve gorunur olur.
      try { send(res, 500, { error: String(e && e.message || e) }); } catch { /* yanit kapanmis */ }
    });
  });
}

/** port 0 verilirse isletim sistemi bos port secer (Electron bunu kullanir). */
export function serve({ port = 4700, host = "127.0.0.1" } = {}) {
  const server = createDashboardServer();
  return new Promise((res, rej) => {
    server.once("error", rej);
    server.listen(port, host, () => res({ server, port: server.address().port, host }));
  });
}
