// Paneli "kurulunca kendiliginden" acan katman.
//
// SOZLESME:
//   - TEK sunucu. Panel zaten ayaktaysa ikincisi acilmaz; var olan adres
//     dondurulur. Yoksa her 'init' yeni bir surec birakir ve portlar sisirdi.
//   - Ayakta olanin BIZIM sunucumuz oldugu dogrulanir (/api/health imzasi).
//     Baska bir uygulama 4700'u tutuyorsa panel oraya baglanmaz.
//   - Otomatik acma INSAN oturumu icindir: CI/otomasyon ortaminda ve
//     --no-panel ile devre disi kalir. Kurulum betigi tarayici acmamali.
//   - Sunucu ARKA PLANDA yasar (detached+unref): 'init' biter, panel kalir.
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(HERE, "../../bin/serif-brain.mjs");
export const VARSAYILAN_PORT = 4700;

/** Panel bu portta ayakta mi — ve BIZIM panelimiz mi? */
export async function ayaktaMi(port = VARSAYILAN_PORT, zamanAsimi = 900) {
  const kes = AbortSignal.timeout(zamanAsimi);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: kes });
    if (!r.ok) return false;
    const j = await r.json();
    return j && j.serif_brain === true;   // baska uygulamanin portu degil
  } catch { return false; }
}

/** Otomatik acma uygun mu? CI/otomasyonda tarayici acilmaz. */
export function otomatikUygun(flags = {}) {
  if (flags["no-panel"] === true || flags.panel === false) return { ok: false, neden: "--no-panel" };
  if (process.env.SERIF_BRAIN_NO_PANEL) return { ok: false, neden: "SERIF_BRAIN_NO_PANEL" };
  if (process.env.CI) return { ok: false, neden: "CI ortami" };
  if (!process.stdout.isTTY) return { ok: false, neden: "etkilesimli olmayan oturum" };
  return { ok: true };
}

/** Sunucu yoksa arka planda baslat. Varsa DOKUNMA. */
export async function sunucuyuGarantile(port = VARSAYILAN_PORT) {
  if (await ayaktaMi(port)) return { url: `http://127.0.0.1:${port}`, baslatildi: false };

  const cocuk = spawn(process.execPath, [BIN, "dashboard", "serve", "--port", String(port)], {
    detached: true, stdio: "ignore",
  });
  cocuk.unref();                                   // 'init' bitince panel yasamaya devam etsin

  // Dinlemeye baslamasini bekle (en fazla ~3 sn)
  for (let i = 0; i < 20; i++) {
    if (await ayaktaMi(port, 400)) return { url: `http://127.0.0.1:${port}`, baslatildi: true };
    await new Promise(r => setTimeout(r, 150));
  }
  return { url: null, baslatildi: false, hata: "panel sunucusu baslatilamadi" };
}

/** Sistem tarayicisinda ac. Basarisiz olursa SESSIZ kalmaz, false doner. */
export function tarayicidaAc(url) {
  const p = platform();
  const komut = p === "darwin" ? "open" : p === "win32" ? "start" : "xdg-open";
  try {
    const c = spawn(komut, [url], { detached: true, stdio: "ignore", shell: p === "win32" });
    c.unref();
    return true;
  } catch { return false; }
}

/**
 * init sonrasi cagrilir. Panel yoksa baslatir, tarayicida acar ve NE YAPTIGINI
 * yazar. Hicbir kosulda 'init'i basarisiz etmez — panel bir kolayliktir,
 * kurulumun sarti degildir.
 */
export async function initSonrasiPanel(flags = {}) {
  const uygun = otomatikUygun(flags);
  if (!uygun.ok) {
    console.log(``);
    console.log(`Panel: otomatik acilmadi (${uygun.neden}) — elle: serif-brain dashboard serve`);
    return 0;
  }
  try {
    const port = Number(flags.port) || VARSAYILAN_PORT;
    const { url, baslatildi, hata } = await sunucuyuGarantile(port);
    console.log(``);
    if (!url) {
      console.log(`Panel acilamadi (${hata}) — elle: serif-brain dashboard serve`);
      return 0;
    }
    tarayicidaAc(url);
    console.log(`Merkezi panel: ${url}  ${baslatildi ? "(baslatildi)" : "(zaten calisiyordu)"}`);
    console.log(`  Bu proje panelde kart olarak gorunur. Kapatmak icin: pkill -f "dashboard serve"`);
  } catch {
    console.log(`Panel acilamadi — elle: serif-brain dashboard serve`);
  }
  return 0;
}
