// Panel surec yonetimi — projeyi baslat/durdur, portu kim tutuyor.
//
// GUVENLIK SOZLESMESI (en riskli modul burasi):
//   - "Durdur" YALNIZ panelin kendi baslattigi sureci oldurur. Panelin
//     baslatmadigi bir surec asla sessizce oldurulmez.
//   - Yabanci surec (terminalde acilmis, baska araç) icin ayri bir yol var:
//     forceKillPort — ve o yol CAGIRANDAN ACIK ONAY ISTER (confirm:true).
//     Onaysiz cagri REDDEDILIR, sessizce gecmez.
//   - Oldurme once SIGTERM, sonra SIGKILL (surec temiz kapanma sansi bulur).
import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// repo yolu → { child, startedAt, port, cmd, log:[] }
const owned = new Map();
const LOG_LIMIT = 400;

export function isOwned(repo) { return owned.has(repo); }

/** Portu tutan PID'ler (lsof). Yoksa bos dizi. */
export function portOwners(port) {
  if (!port) return [];
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 4000,
    });
    return out.split("\n").map(s => s.trim()).filter(Boolean).map(Number);
  } catch { return []; }
}

/** Bir PID'in komut satiri — onay ekraninda "neyi olduruyorum" gostermek icin. */
export function pidCommand(pid) {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 4000,
    }).trim();
  } catch { return ""; }
}

/**
 * Projenin canli durumu.
 *   owned      : bu paneli baslatti mi
 *   listening  : portta dinleyen var mi
 *   foreign    : portta biri var ama panel baslatmadi (→ zorla kapatma onay ister)
 */
export function status(repo, port) {
  const rec = owned.get(repo);
  const pids = portOwners(port);
  const listening = pids.length > 0;
  const ownPid = rec?.child?.pid ?? null;
  const foreign = listening && !(ownPid && pids.includes(ownPid)) && !rec;
  return {
    owned: !!rec,
    running: !!rec && rec.child.exitCode === null,
    pid: ownPid,
    startedAt: rec?.startedAt ?? null,
    listening,
    port: port || null,
    listenerPids: pids,
    foreign,
    exitCode: rec?.child?.exitCode ?? null,
  };
}

export function logs(repo, limit = 200) {
  const rec = owned.get(repo);
  return rec ? rec.log.slice(-limit) : [];
}

/** Projeyi calistir. cmd yoksa/repo yoksa hata dondurur (throw etmez). */
export function start(repo, cmd, port) {
  if (!repo || !existsSync(repo)) return { ok: false, error: "proje klasoru bulunamadi" };
  if (!cmd) return { ok: false, error: "calistirma komutu tanimsiz (dashboard override ile ekle)" };
  const cur = owned.get(repo);
  if (cur && cur.child.exitCode === null) return { ok: false, error: "zaten calisiyor", pid: cur.child.pid };

  const child = spawn(cmd, {
    cwd: repo, shell: true, detached: false,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const rec = { child, startedAt: Date.now(), port, cmd, log: [] };
  const push = (stream) => (buf) => {
    for (const line of String(buf).split("\n")) {
      if (line.trim()) rec.log.push({ t: Date.now(), stream, line: line.slice(0, 500) });
    }
    if (rec.log.length > LOG_LIMIT) rec.log.splice(0, rec.log.length - LOG_LIMIT);
  };
  child.stdout.on("data", push("out"));
  child.stderr.on("data", push("err"));
  child.on("exit", (code, sig) => {
    rec.log.push({ t: Date.now(), stream: "sys", line: `— surec bitti (kod ${code ?? sig})` });
  });
  child.on("error", (e) => rec.log.push({ t: Date.now(), stream: "sys", line: `— baslatilamadi: ${e.message}` }));

  owned.set(repo, rec);
  return { ok: true, pid: child.pid };
}

async function killPid(pid, { hardAfterMs = 4000 } = {}) {
  try { process.kill(pid, "SIGTERM"); } catch { return false; }
  const bitti = await new Promise((res) => {
    const t0 = Date.now();
    const tik = setInterval(() => {
      let yasiyor = true;
      try { process.kill(pid, 0); } catch { yasiyor = false; }
      if (!yasiyor) { clearInterval(tik); res(true); }
      else if (Date.now() - t0 > hardAfterMs) { clearInterval(tik); res(false); }
    }, 150);
  });
  if (!bitti) { try { process.kill(pid, "SIGKILL"); } catch { /* zaten olmus */ } }
  return true;
}

/** SADECE panelin baslattigi sureci durdurur. Yabanci surece DOKUNMAZ. */
export async function stop(repo) {
  const rec = owned.get(repo);
  if (!rec) return { ok: false, error: "bu sureci panel baslatmadi — zorla kapatmak icin onay gerekir", needsConfirm: true };
  if (rec.child.exitCode !== null) { owned.delete(repo); return { ok: true, already: true }; }
  await killPid(rec.child.pid);
  owned.delete(repo);
  return { ok: true };
}

/**
 * Portu tutan YABANCI sureci oldurur. Onay olmadan CALISMAZ — kullanicinin
 * terminalde acmis oldugu bir isi panelin sessizce kapatmasi kabul edilemez.
 */
export async function forceKillPort(port, { confirm = false } = {}) {
  if (!confirm) return { ok: false, error: "onay gerekli", needsConfirm: true };
  const pids = portOwners(port);
  if (!pids.length) return { ok: false, error: `portu (${port}) tutan surec yok` };
  for (const pid of pids) await killPid(pid);
  return { ok: true, killed: pids };
}

/** Panel kapanirken kendi baslattigi her seyi topla (zombi surec birakma). */
export async function stopAll() {
  const repos = [...owned.keys()];
  for (const r of repos) await stop(r);
  return repos.length;
}
