// Panel arayuzu — tek dosya, SIFIR BAGIMLILIK, CDN yok (Electron'da ve
// cevrimdisi calisir). Animasyon/efekt kutuphanesi kullanilmaz: bu UI
// serif-brain-core icinde yasiyor ve o paketin "dependencies: {}" garantisi
// var; ayrica bundler yok, tek HTML dizesi olarak servis ediliyor.
// Premium his saf CSS/JS ile kuruldu (yay egrileri, kademeli giris, cam
// baslik, gren dokusu, komut paleti).
//
// Tasarim sistemi: Dark Mode (OLED) — #0F172A zemin, #22C55E "calisiyor"
// yesili, Fira ailesinin yerine AG GEREKTIRMEYEN sistem esdegeri yigin
// (SF Pro / SF Mono) — cevrimdisi calisma sarti font indirmeye izin vermiyor.
export function renderApp() {
  return `<!doctype html>
<html lang="tr" data-tema="koyu"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>serif-brain — Merkezi Panel</title>
<style>
:root{
  /* Dark Mode (OLED) — tasarim sisteminden */
  --bg:#0F172A; --yuzey:#1E293B; --yuzey2:#334155; --cizgi:#2A3A50;
  --tx:#F8FAFC; --dim:#94A3B8; --dim2:#64748B;
  --calisiyor:#22C55E; --uyari:#F59E0B; --hata:#EF4444; --vurgu:#38BDF8;
  --r:14px; --r2:10px;
  --yay:cubic-bezier(.22,1,.36,1);          /* yaylanma */
  --hizli:cubic-bezier(.4,0,.2,1);
  --golge:0 1px 2px #0006, 0 8px 24px -12px #000a;
  --golge2:0 2px 8px #0008, 0 24px 48px -20px #000c;
}
:root[data-tema="acik"]{
  --bg:#F1F5F9; --yuzey:#FFFFFF; --yuzey2:#F1F5F9; --cizgi:#DDE3EA;
  --tx:#0F172A; --dim:#475569; --dim2:#94A3B8;
  --golge:0 1px 2px #0f172a12, 0 8px 24px -14px #0f172a30;
  --golge2:0 2px 8px #0f172a14, 0 24px 48px -20px #0f172a35;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;background:var(--bg);color:var(--tx);
  font:14px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",sans-serif;
  -webkit-font-smoothing:antialiased;
  font-feature-settings:"cv11","ss01";
}
/* Film greni — premium doku, 1 KB'lik SVG, ag istegi yok */
body::after{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:100;opacity:.028;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>");
}
/* Zemin isigi — derinlik */
body::before{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(900px 500px at 12% -8%, #38BDF814, transparent 70%),
             radial-gradient(700px 420px at 92% 4%, #22C55E0e, transparent 70%);
}
:root[data-tema="acik"] body::before{opacity:.55}

.mono{font-family:ui-monospace,"SF Mono",SFMono-Regular,Menlo,monospace;
  font-size:11.5px;font-variant-ligatures:none}
.num{font-variant-numeric:tabular-nums}

button{
  font:inherit;font-weight:500;cursor:pointer;color:var(--tx);
  border:1px solid var(--cizgi);background:var(--yuzey2);
  border-radius:9px;padding:6px 12px;
  transition:background .16s var(--hizli),border-color .16s var(--hizli),
             transform .16s var(--yay),box-shadow .16s var(--hizli);
}
button:hover:not(:disabled){border-color:var(--dim2);transform:translateY(-1px);box-shadow:var(--golge)}
button:active:not(:disabled){transform:translateY(0) scale(.98)}
button:disabled{opacity:.35;cursor:not-allowed}
button:focus-visible,input:focus-visible,.kart:focus-visible,.oge:focus-visible{
  outline:2px solid var(--vurgu);outline-offset:2px}
button.bas{background:var(--calisiyor);border-color:transparent;color:#04220F;font-weight:600}
button.bas:hover:not(:disabled){box-shadow:0 0 0 4px #22C55E22, var(--golge)}
button.teh{background:transparent;border-color:#EF444455;color:var(--hata)}
button.teh:hover:not(:disabled){background:#EF44441a;border-color:var(--hata)}
button.ufak{padding:4px 9px;font-size:12px}
.ikon{width:14px;height:14px;flex:none;vertical-align:-2px}

input{
  font:inherit;background:var(--yuzey);color:var(--tx);
  border:1px solid var(--cizgi);border-radius:10px;padding:8px 12px;
  transition:border-color .16s var(--hizli),box-shadow .16s var(--hizli)}
input:focus{outline:none;border-color:var(--vurgu);box-shadow:0 0 0 4px #38BDF822}
input::placeholder{color:var(--dim2)}

/* ── Baslik: cam ── */
header{
  position:sticky;top:0;z-index:30;
  padding:11px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;
  background:color-mix(in srgb, var(--bg) 72%, transparent);
  backdrop-filter:saturate(180%) blur(20px);
  -webkit-backdrop-filter:saturate(180%) blur(20px);
  border-bottom:1px solid color-mix(in srgb, var(--cizgi) 70%, transparent);
}
.marka{display:flex;align-items:center;gap:9px;font-weight:650;letter-spacing:-.2px;font-size:14px}
.marka svg{width:19px;height:19px}
.sp{flex:1}
#ara{width:min(340px,38vw)}
.rozet{font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;
  background:var(--yuzey2);color:var(--dim);border:1px solid var(--cizgi)}
kbd{font:500 10.5px ui-monospace,monospace;background:var(--yuzey2);color:var(--dim);
  border:1px solid var(--cizgi);border-bottom-width:2px;border-radius:5px;padding:1px 5px}

main{padding:22px 20px 60px;max-width:1600px;margin:0 auto;position:relative;z-index:1}
.bolum{font-size:11px;font-weight:700;letter-spacing:.09em;color:var(--dim2);
  margin:30px 0 12px;text-transform:uppercase;display:flex;align-items:center;gap:9px}
.bolum::after{content:"";flex:1;height:1px;background:var(--cizgi)}
.izgara{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(345px,1fr))}

/* ── Kart ── */
.kart{
  position:relative;background:var(--yuzey);border:1px solid var(--cizgi);
  border-radius:var(--r);padding:16px;display:flex;flex-direction:column;gap:11px;
  min-height:238px;box-shadow:var(--golge);
  transition:transform .28s var(--yay),box-shadow .28s var(--yay),border-color .2s var(--hizli);
  animation:gir .5s var(--yay) both;
}
@keyframes gir{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
.kart:hover{transform:translateY(-3px);box-shadow:var(--golge2);border-color:var(--dim2)}
/* Ust kenar isigi — calisan projede yesil */
.kart::before{
  content:"";position:absolute;inset:0 0 auto;height:1px;border-radius:var(--r) var(--r) 0 0;
  background:linear-gradient(90deg,transparent,#ffffff1f,transparent);
}
.kart.acik{border-color:#22C55E4d}
.kart.acik::before{background:linear-gradient(90deg,transparent,var(--calisiyor),transparent);opacity:.8}
.kart.kayip{opacity:.62;border-style:dashed}
.kart.kayip:hover{opacity:1}

.kbas{display:flex;align-items:center;gap:9px;margin:0;font-size:15.5px;font-weight:640;
  letter-spacing:-.2px;min-height:22px}
.kbas .ad{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nokta{width:7px;height:7px;border-radius:99px;background:var(--dim2);flex:none;position:relative}
.nokta.on{background:var(--calisiyor)}
.nokta.on::after{content:"";position:absolute;inset:-3px;border-radius:99px;
  border:1px solid var(--calisiyor);animation:nabiz 2s var(--hizli) infinite}
@keyframes nabiz{0%{opacity:.9;transform:scale(.8)}70%{opacity:0;transform:scale(1.9)}100%{opacity:0}}
.nokta.yabanci{background:var(--uyari)}
.nokta.kayip{background:var(--hata)}
/* Yol kisaltma: direction:rtl denendi ve BOZDU — bastaki "/" gorsel olarak
   sona kayiyor ("Users/…/x/" gibi okunuyor). Onun yerine ev dizini "~" ile
   kisaltilir, tasarsa sondan uc nokta konur; tamami title'da durur. */
.yol{font-size:11px;color:var(--dim2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.cubuk{height:4px;background:var(--yuzey2);border-radius:99px;overflow:hidden}
.cubuk>i{display:block;height:100%;border-radius:99px;
  background:linear-gradient(90deg,var(--vurgu),#818CF8);
  transition:width .7s var(--yay)}
.sayilar{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--dim)}
.sayilar b{color:var(--tx);font-weight:640;font-size:13px;font-variant-numeric:tabular-nums}
.sayilar i{font-style:normal;display:block;font-size:10px;color:var(--dim2);
  letter-spacing:.04em;text-transform:uppercase}
.satir{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.etiket{font-size:10px;font-weight:650;padding:2px 8px;border-radius:99px;
  border:1px solid currentColor;letter-spacing:.03em}
.e-kritik{color:var(--hata)} .e-yabanci{color:var(--uyari)} .e-calisiyor{color:var(--calisiyor)}
.e-kayip{color:var(--hata)}
.komut{margin-top:auto;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden;color:var(--dim2);background:var(--bg);border:1px solid var(--cizgi);
  border-radius:8px;padding:6px 9px}
:root[data-tema="acik"] .komut{background:var(--yuzey2)}

/* ── Cekmece ── */
#golge{position:fixed;inset:0;background:#020617;opacity:0;pointer-events:none;
  transition:opacity .3s var(--hizli);z-index:40;backdrop-filter:blur(2px)}
#golge.on{opacity:.55;pointer-events:auto}
#cekmece{
  position:fixed;top:0;right:0;bottom:0;width:min(820px,96vw);z-index:50;
  background:var(--yuzey);border-left:1px solid var(--cizgi);box-shadow:var(--golge2);
  transform:translateX(101%);transition:transform .34s var(--yay);
  display:flex;flex-direction:column}
#cekmece.on{transform:none}
.cbas{display:flex;align-items:center;gap:10px;padding:14px 18px;
  border-bottom:1px solid var(--cizgi);background:var(--yuzey)}
.cbas h2{margin:0;font-size:15px;font-weight:640;letter-spacing:-.2px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cgovde{overflow:auto;padding:18px;flex:1;scroll-behavior:smooth}
.cgovde::-webkit-scrollbar{width:10px}
.cgovde::-webkit-scrollbar-thumb{background:var(--yuzey2);border-radius:99px;
  border:3px solid var(--yuzey)}

.sekmeler{display:flex;gap:5px;margin-bottom:14px;flex-wrap:wrap}
.sekmeler button.on{background:var(--tx);border-color:var(--tx);color:var(--bg)}
.oge{border:1px solid var(--cizgi);border-radius:var(--r2);padding:11px 13px;margin-bottom:8px;
  background:var(--bg);cursor:pointer;
  transition:border-color .16s var(--hizli),transform .16s var(--yay),background .16s var(--hizli);
  animation:gir .34s var(--yay) both}
:root[data-tema="acik"] .oge{background:var(--yuzey2)}
.oge:hover{border-color:var(--vurgu);transform:translateX(3px)}
.oge .t{font-weight:560;margin-bottom:4px;line-height:1.35}
.oge .m{font-size:11px;color:var(--dim);display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.hap{font-size:9.5px;font-weight:650;padding:2px 7px;border-radius:5px;letter-spacing:.05em;
  text-transform:uppercase;background:var(--yuzey2);color:var(--dim);border:1px solid var(--cizgi)}
.hap.critical,.hap.high{background:#EF444422;color:#FCA5A5;border-color:#EF444455}
.hap.open{background:#F59E0B22;color:#FCD34D;border-color:#F59E0B55}
.hap.closed,.hap.done,.hap.active{background:#22C55E22;color:#86EFAC;border-color:#22C55E55}
:root[data-tema="acik"] .hap.critical,:root[data-tema="acik"] .hap.high{color:#B91C1C}
:root[data-tema="acik"] .hap.open{color:#B45309}
:root[data-tema="acik"] .hap.closed,:root[data-tema="acik"] .hap.done,
:root[data-tema="acik"] .hap.active{color:#15803D}

pre.md{white-space:pre-wrap;word-wrap:break-word;background:var(--bg);
  border:1px solid var(--cizgi);border-radius:var(--r2);padding:15px;
  font:12.5px/1.65 ui-monospace,"SF Mono",Menlo,monospace;margin:0;color:var(--tx)}
:root[data-tema="acik"] pre.md{background:var(--yuzey2)}
pre.gunluk{max-height:330px;overflow:auto;font-size:11.5px;color:var(--dim)}

.bos{color:var(--dim2);padding:52px 20px;text-align:center;font-size:13px}
.iskelet{background:var(--yuzey);border:1px solid var(--cizgi);border-radius:var(--r);
  min-height:238px;position:relative;overflow:hidden}
.iskelet::after{content:"";position:absolute;inset:0;
  background:linear-gradient(90deg,transparent,#ffffff08,transparent);
  animation:parla 1.4s infinite}
@keyframes parla{to{transform:translateX(100%)}}

/* ── Komut paleti ── */
#palet{position:fixed;inset:0;z-index:60;display:none;
  background:#02061799;backdrop-filter:blur(6px)}
#palet.on{display:block}
.pkutu{max-width:620px;margin:12vh auto 0;background:var(--yuzey);
  border:1px solid var(--cizgi);border-radius:var(--r);box-shadow:var(--golge2);
  overflow:hidden;animation:paletGir .28s var(--yay) both}
@keyframes paletGir{from{opacity:0;transform:translateY(-12px) scale(.98)}to{opacity:1;transform:none}}
#pgiris{width:100%;border:none;border-radius:0;border-bottom:1px solid var(--cizgi);
  padding:15px 18px;font-size:15px;background:transparent}
#pgiris:focus{box-shadow:none;border-color:var(--cizgi)}
#pliste{max-height:52vh;overflow:auto;padding:7px}
.psatir{padding:10px 13px;border-radius:9px;cursor:pointer;display:flex;align-items:center;gap:11px}
.psatir[aria-selected="true"]{background:var(--yuzey2)}
.psatir .sag{margin-left:auto;font-size:11px;color:var(--dim2)}

dialog{background:var(--yuzey);color:var(--tx);border:1px solid var(--cizgi);
  border-radius:var(--r);padding:22px;max-width:580px;box-shadow:var(--golge2)}
dialog::backdrop{background:#020617cc;backdrop-filter:blur(4px)}
dialog h3{margin:0 0 8px;font-size:16px;font-weight:640}

.uyariKutu{background:var(--yuzey);border:1px solid var(--uyari);border-left-width:3px;
  border-radius:var(--r2);padding:12px 15px;margin-bottom:16px;display:flex;gap:11px;
  align-items:center;animation:gir .4s var(--yay) both}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important}
}
</style></head><body>

<svg style="display:none">
  <symbol id="i-marka" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round"><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="3.4" r="1.9" fill="currentColor" stroke="none"/>
    <circle cx="20.1" cy="9.3" r="1.9" fill="currentColor" stroke="none"/>
    <circle cx="17" cy="19.2" r="1.9" fill="currentColor" stroke="none"/>
    <circle cx="7" cy="19.2" r="1.9" fill="currentColor" stroke="none"/>
    <circle cx="3.9" cy="9.3" r="1.9" fill="currentColor" stroke="none"/>
    <path d="M12 12 12 3.4M12 12l8.1-2.7M12 12l5 7.2M12 12l-5 7.2M12 12 3.9 9.3" opacity=".55"/></symbol>
  <symbol id="i-oynat" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></symbol>
  <symbol id="i-dur" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></symbol>
  <symbol id="i-liste" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></symbol>
  <symbol id="i-disari" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></symbol>
  <symbol id="i-kapat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-yenile" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></symbol>
  <symbol id="i-uyari" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round"><path d="M12 3.5 22 20H2L12 3.5zM12 10v4M12 17.2h.01"/></symbol>
  <symbol id="i-cop" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></symbol>
  <symbol id="i-gunluk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14v16H5zM8.5 9.5l2.5 2.5-2.5 2.5M13 15h3"/></symbol>
  <symbol id="i-geri" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></symbol>
  <symbol id="i-tema" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></symbol>
</svg>

<header>
  <span class="marka"><svg style="color:var(--vurgu)"><use href="#i-marka"/></svg> serif-brain</span>
  <span class="rozet num" id="sayac">—</span>
  <input id="ara" placeholder="Tüm brain'lerde ara…" autocomplete="off" spellcheck="false">
  <span class="sp"></span>
  <kbd id="ipucu">⌘K</kbd>
  <button class="ufak" id="tema" title="Tema"><svg class="ikon"><use href="#i-tema"/></svg></button>
  <button class="ufak" id="yenile" title="Yenile (R)"><svg class="ikon"><use href="#i-yenile"/></svg></button>
</header>

<main>
  <div id="bildirim"></div>
  <div class="izgara" id="izgara">
    <div class="iskelet"></div><div class="iskelet"></div>
    <div class="iskelet"></div><div class="iskelet"></div>
  </div>
  <div class="bolum" id="arsBaslik" hidden>Arşiv</div>
  <div class="izgara" id="ars"></div>
</main>

<div id="golge"></div>
<aside id="cekmece" aria-hidden="true">
  <div class="cbas">
    <button class="ufak" id="cgeri" hidden><svg class="ikon"><use href="#i-geri"/></svg></button>
    <h2 id="cbaslik">—</h2><span class="sp"></span>
    <button class="ufak" id="ckapat"><svg class="ikon"><use href="#i-kapat"/></svg></button>
  </div>
  <div class="cgovde" id="cgovde"></div>
</aside>

<div id="palet"><div class="pkutu">
  <input id="pgiris" placeholder="Projeye git, başlat, durdur…" autocomplete="off" spellcheck="false">
  <div id="pliste"></div>
</div></div>

<dialog id="onay">
  <h3><svg class="ikon" style="color:var(--uyari)"><use href="#i-uyari"/></svg> Yabancı süreci kapat?</h3>
  <p style="color:var(--dim);font-size:13px" id="onayMetin"></p>
  <pre class="md mono" id="onayPid" style="font-size:11.5px"></pre>
  <p style="color:var(--dim);font-size:12.5px">Bu süreci <b style="color:var(--tx)">panel başlatmadı</b> —
  terminalde veya başka bir uygulamada açılmış olabilir. Kapatmak oradaki işi de sonlandırır.</p>
  <div class="satir" style="justify-content:flex-end;margin-top:14px">
    <button id="onayHayir">Vazgeç</button>
    <button class="teh" id="onayEvet">Evet, kapat</button>
  </div>
</dialog>

<script>
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const jget = u => fetch(u).then(r => r.json());
const jpost = (u,b) => fetch(u,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify(b)}).then(r => r.json());
const kisaYol = y => String(y).replace(/^\\/(Users|home)\\/[^/]+/, "~");
const svg = (id,st="") => \`<svg class="ikon" style="\${st}"><use href="#\${id}"/></svg>\`;

let DATA = null, oto = null, sonImza = "", cekmeceGeri = null;

/* ── Tema (koyu varsayilan — tasarim sistemi "acik varsayilan"i anti-patern sayiyor) ── */
const temaYukle = () => {
  const t = localStorage.getItem("sb-tema") || "koyu";
  document.documentElement.dataset.tema = t;
};
$("#tema").onclick = () => {
  const y = document.documentElement.dataset.tema === "koyu" ? "acik" : "koyu";
  document.documentElement.dataset.tema = y;
  localStorage.setItem("sb-tema", y);
};
temaYukle();

/* ── Kart ── */
function kart(p, i){
  const s = p.proc || {};
  const kayip = !!p.error;
  const durum = kayip ? "kayip" : s.running ? "on" : (s.foreign ? "yabanci" : "");
  const acik = s.running || s.listening;
  return \`<div class="kart \${acik?'acik':''} \${kayip?'kayip':''}" data-repo="\${esc(p.repo)}"
       style="animation-delay:\${Math.min(i,14)*26}ms" tabindex="0">
    <h3 class="kbas"><span class="nokta \${durum}"></span>
      <span class="ad">\${esc(p.name)}</span>
      \${kayip ? '<span class="etiket e-kayip">KAYIP</span>' : ""}
      \${!kayip && p.criticalOpen ? \`<span class="etiket e-kritik num">\${p.criticalOpen} kritik</span>\` : ""}
      \${s.running ? '<span class="etiket e-calisiyor">çalışıyor</span>' : ""}
    </h3>
    <div class="yol mono" title="\${esc(p.repo)}">\${esc(kisaYol(p.repo))}</div>
    \${kayip ? \`
      <div style="color:var(--dim);font-size:12.5px;margin-top:4px">
        Klasör diskte yok. Kayıt panelde duruyor çünkü ayarların (port, çalıştırma
        komutu, hedef) burada saklı — silmeyi sen seçersin.</div>
      <div class="satir" style="margin-top:auto">
        <button class="teh" data-act="unut">\${svg("i-cop")} Panelden kaldır</button>
      </div>\`
    : \`
    <div class="cubuk"><i style="width:\${p.percent ?? 0}%"></i></div>
    <div class="sayilar">
      <span><b>\${p.percent ?? "—"}%</b><i>ilerleme</i></span>
      <span><b>\${p.objCount ?? 0}</b><i>kayıt</i></span>
      <span><b>\${p.open ?? 0}</b><i>açık</i></span>
      <span><b>\${p.done ?? 0}</b><i>biten</i></span>
      <span><b>\${esc(p.last || "—")}</b><i>son</i></span>
    </div>
    <div class="satir" style="font-size:11.5px;color:var(--dim)">
      <span class="mono">port \${p.port || "—"}</span>
      \${s.foreign ? '<span class="etiket e-yabanci">yabancı süreç</span>' : ""}
      \${s.running ? \`<span class="mono" style="color:var(--calisiyor)">pid \${s.pid}</span>\` : ""}
    </div>
    <div class="satir">
      <button class="bas" data-act="basla" \${(s.running||!p.run)?"disabled":""}>\${svg("i-oynat")} Başlat</button>
      <button data-act="dur" \${!s.running?"disabled":""}>\${svg("i-dur")} Durdur</button>
      \${s.foreign ? \`<button class="teh ufak" data-act="zorla">Zorla kapat</button>\` : ""}
      <button class="ufak" data-act="ac">\${svg("i-liste")} Kayıtlar</button>
      \${s.running ? \`<button class="ufak" data-act="gunluk">\${svg("i-gunluk")}</button>\` : ""}
      \${p.port && acik ? \`<button class="ufak" data-act="tarayici">\${svg("i-disari")}</button>\` : ""}
    </div>
    <code class="komut mono" title="\${esc(p.run||"")}">\${esc(p.run || "— çalıştırma komutu tanımsız")}</code>\`}
  </div>\`;
}

async function yukle(sync=true, zorla=false){
  DATA = await jget("/api/projects?sync=" + (sync?"1":"0"));
  // Veri degismediyse DOM'a DOKUNMA: yeniden cizim, tiklamak istedigin dugmeyi
  // elinin altindan kaydirir ve giris animasyonunu her seferinde tekrar oynatir.
  const imza = JSON.stringify([DATA.active, DATA.archived]);
  if (!zorla && imza === sonImza) return;
  sonImza = imza;

  $("#izgara").innerHTML = DATA.active.map(kart).join("") || '<div class="bos">Brain bulunamadı.</div>';
  $("#ars").innerHTML = DATA.archived.map(kart).join("");
  $("#arsBaslik").hidden = !DATA.archived.length;
  $("#sayac").textContent = \`\${DATA.active.length} aktif · \${DATA.archived.length} arşiv\`;

  const kayipSayisi = [...DATA.active, ...DATA.archived].filter(p => p.error).length;
  $("#bildirim").innerHTML =
    (DATA.newlyDiscovered.length ? \`<div class="uyariKutu" style="border-color:var(--calisiyor)">
      \${svg("i-marka","color:var(--calisiyor)")}
      <div>Yeni brain bulundu ve eklendi: <b>\${DATA.newlyDiscovered.map(p=>esc(p.split("/").pop())).join(", ")}</b></div>
     </div>\` : "") +
    (kayipSayisi ? \`<div class="uyariKutu">\${svg("i-uyari","color:var(--uyari)")}
      <div><b>\${kayipSayisi} proje kayıp</b> — klasörü diskte yok. Ayarları kaybolmasın diye
      otomatik silinmiyor.</div><span class="sp"></span>
      <button class="teh ufak" id="hepsiniUnut">\${svg("i-cop")} Hepsini kaldır</button></div>\` : "");

  const hu = $("#hepsiniUnut");
  if (hu) hu.onclick = async () => {
    for (const p of [...DATA.active, ...DATA.archived].filter(x => x.error))
      await jpost("/api/forget", { repo: p.repo });
    yukle(false, true);
  };
}

/* ── Kart eylemleri ── */
document.addEventListener("click", async e => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const repo = btn.closest(".kart").dataset.repo;
  const act = btn.dataset.act;
  if (act === "basla"){ btn.disabled = true;
    const r = await jpost("/api/start",{repo});
    if (!r.ok) bildir("Başlatılamadı: " + r.error); await yukle(false,true); return; }
  if (act === "dur"){ btn.disabled = true; await jpost("/api/stop",{repo}); await yukle(false,true); return; }
  if (act === "zorla") return zorlaOnayi(repo);
  if (act === "ac") return kayitlariAc(repo);
  if (act === "gunluk") return gunlukAc(repo);
  if (act === "unut"){ await jpost("/api/forget",{repo}); return yukle(false,true); }
  if (act === "tarayici"){ const p = bul(repo); window.open("http://localhost:" + p.port, "_blank"); return; }
});
const bul = repo => [...DATA.active, ...DATA.archived].find(x => x.repo === repo);
const bildir = m => { const d=$("#bildirim");
  d.innerHTML = \`<div class="uyariKutu" style="border-color:var(--hata)">\${svg("i-uyari","color:var(--hata)")}<div>\${esc(m)}</div></div>\` + d.innerHTML; };

/* ── Zorla kapatma: ONAY ZORUNLU ── */
async function zorlaOnayi(repo){
  const p = bul(repo);
  const bilgi = await jget("/api/port-owner?port=" + p.port);
  $("#onayMetin").innerHTML = \`<b style="color:var(--tx)">\${esc(p.name)}</b> için
    <b style="color:var(--tx)">\${p.port}</b> portunu tutan süreç:\`;
  $("#onayPid").textContent = bilgi.pids.map(x => "pid " + x.pid + "  " + x.cmd).join("\\n") || "(bulunamadı)";
  $("#onay").showModal();
  $("#onayEvet").onclick = async () => {
    $("#onay").close();
    const r = await jpost("/api/force-kill", { port: p.port, confirm: true });
    if (!r.ok) bildir("Kapatılamadı: " + r.error);
    await yukle(false, true);
  };
}
$("#onayHayir").onclick = () => $("#onay").close();

/* ── Cekmece ── */
function cekmeceAc(baslik, html, geri=null){
  $("#cbaslik").textContent = baslik;
  $("#cgovde").innerHTML = html;
  $("#cgovde").scrollTop = 0;
  cekmeceGeri = geri;
  $("#cgeri").hidden = !geri;
  $("#cekmece").classList.add("on"); $("#cekmece").setAttribute("aria-hidden","false");
  $("#golge").classList.add("on");
}
function cekmeceKapat(){
  $("#cekmece").classList.remove("on"); $("#cekmece").setAttribute("aria-hidden","true");
  $("#golge").classList.remove("on");
}
$("#ckapat").onclick = cekmeceKapat; $("#golge").onclick = cekmeceKapat;
$("#cgeri").onclick = () => cekmeceGeri && cekmeceGeri();

function ogeHtml(i, repo, gecikme=0){
  return \`<div class="oge" data-id="\${esc(i.id)}" data-repo="\${esc(repo)}" tabindex="0"
       style="animation-delay:\${Math.min(gecikme,12)*18}ms">
    <div class="t">\${esc(i.title || i.id)}</div>
    <div class="m">
      <span class="hap">\${esc(i.type)}</span>
      <span class="hap \${esc(i.status)}">\${esc(i.status)}</span>
      \${i.priority ? \`<span class="hap \${esc(i.priority)}">\${esc(i.priority)}</span>\` : ""}
      \${(i.module||[]).map(m => \`<span class="mono">\${esc(m)}</span>\`).join("")}
      <span class="sp"></span><span class="mono">\${esc((i.updated_at||"").slice(0,10))}</span>
    </div>
    \${i.snippet ? \`<div class="m" style="margin-top:6px;color:var(--dim2);display:block">\${esc(i.snippet.slice(0,150))}…</div>\` : ""}
  </div>\`;
}

async function kayitlariAc(repo, tip="", filtre=""){
  const p = bul(repo);
  const d = await jget(\`/api/objects?repo=\${encodeURIComponent(repo)}&type=\${tip}&q=\${encodeURIComponent(filtre)}\`);
  const sek = [["","tümü"],["decision","kararlar"],["bug","bug'lar"],["note","notlar"],["plan","planlar"]]
    .map(([v,l]) => \`<button class="ufak \${v===tip?'on':''}" data-tip="\${v}">\${l}</button>\`).join("");
  cekmeceAc(p.name, \`
    <div class="sekmeler">\${sek}</div>
    <input id="filtre" placeholder="Bu projede filtrele…" value="\${esc(filtre)}" style="width:100%;margin-bottom:13px">
    <div style="color:var(--dim2);font-size:11.5px;margin-bottom:10px" class="num">\${d.count} / \${d.total} kayıt</div>
    <div>\${d.items.map((i,ix) => ogeHtml(i, repo, ix)).join("") || '<div class="bos">Kayıt yok.</div>'}</div>\`);
  $("#cgovde").querySelectorAll("button[data-tip]").forEach(b =>
    b.onclick = () => kayitlariAc(repo, b.dataset.tip, $("#filtre").value));
  let t; $("#filtre").oninput = e => { clearTimeout(t);
    t = setTimeout(() => kayitlariAc(repo, tip, e.target.value), 200); };
}

document.addEventListener("click", async e => {
  const o = e.target.closest(".oge"); if (!o) return;
  const d = await jget(\`/api/object?repo=\${encodeURIComponent(o.dataset.repo)}&id=\${encodeURIComponent(o.dataset.id)}\`);
  if (!d || d.error) return;
  const fm = d.frontmatter || {};
  cekmeceAc(fm.title || d.id, \`
    <div class="m" style="margin-bottom:14px;display:flex;gap:7px;flex-wrap:wrap;align-items:center">
      <span class="hap">\${esc(fm.type)}</span>
      <span class="hap \${esc(fm.status)}">\${esc(fm.status)}</span>
      \${fm.priority ? \`<span class="hap \${esc(fm.priority)}">\${esc(fm.priority)}</span>\` : ""}
      <span class="mono" style="color:var(--dim2)">\${esc(fm.id)}</span>
    </div>
    <pre class="md">\${esc(d.body || "(gövde yok)")}</pre>
    <div class="mono" style="margin-top:12px;color:var(--dim2)">\${esc(d.path || "")}</div>\`,
    () => kayitlariAc(o.dataset.repo));
});

async function gunlukAc(repo){
  const p = bul(repo);
  const d = await jget("/api/logs?repo=" + encodeURIComponent(repo));
  cekmeceAc(p.name + " — günlük",
    \`<pre class="md gunluk">\${esc(d.lines.map(l => l.line).join("\\n")) || "(çıktı yok)"}</pre>\`);
}

/* ── Arama ── */
let at;
$("#ara").oninput = e => {
  clearTimeout(at);
  const q = e.target.value.trim();
  at = setTimeout(async () => {
    if (!q) return cekmeceKapat();
    const d = await jget("/api/search?q=" + encodeURIComponent(q));
    let proje = "", html = "";
    d.results.forEach((r, ix) => {
      if (r.project !== proje) { proje = r.project;
        html += \`<div class="bolum" style="margin:16px 0 9px">\${esc(proje)}</div>\`; }
      html += ogeHtml(r, r.repo, ix);
    });
    cekmeceAc(\`"\${q}" — \${d.results.length} sonuç\`, html || '<div class="bos">Sonuç yok.</div>');
  }, 240);
};

/* ── Komut paleti (⌘K) ── */
let pSecili = 0, pKayit = [];
function paletAc(){
  $("#palet").classList.add("on"); $("#pgiris").value = ""; $("#pgiris").focus(); paletCiz("");
}
function paletKapat(){ $("#palet").classList.remove("on"); }
function paletKomutlari(q){
  const t = q.toLowerCase();
  const out = [];
  for (const p of [...(DATA?.active||[]), ...(DATA?.archived||[])]) {
    if (t && !p.name.toLowerCase().includes(t)) continue;
    const s = p.proc || {};
    out.push({ ad: p.name, ipucu: "kayıtları aç", yap: () => { paletKapat(); kayitlariAc(p.repo); } });
    if (p.run && !s.running)
      out.push({ ad: p.name, ipucu: "başlat", yap: async () => { paletKapat();
        await jpost("/api/start",{repo:p.repo}); yukle(false,true); } });
    if (s.running)
      out.push({ ad: p.name, ipucu: "durdur", yap: async () => { paletKapat();
        await jpost("/api/stop",{repo:p.repo}); yukle(false,true); } });
  }
  return out.slice(0, 40);
}
function paletCiz(q){
  pKayit = paletKomutlari(q); pSecili = 0;
  $("#pliste").innerHTML = pKayit.map((k,i) =>
    \`<div class="psatir" data-i="\${i}" aria-selected="\${i===0}">
       <span>\${esc(k.ad)}</span><span class="sag">\${esc(k.ipucu)}</span></div>\`).join("")
    || '<div class="bos" style="padding:26px">Eşleşme yok.</div>';
}
$("#pgiris").oninput = e => paletCiz(e.target.value);
$("#pliste").onclick = e => { const s = e.target.closest(".psatir"); if (s) pKayit[+s.dataset.i]?.yap(); };
function paletGez(d){
  if (!pKayit.length) return;
  pSecili = (pSecili + d + pKayit.length) % pKayit.length;
  $("#pliste").querySelectorAll(".psatir").forEach((el,i) => {
    el.setAttribute("aria-selected", i === pSecili);
    if (i === pSecili) el.scrollIntoView({ block: "nearest" });
  });
}

/* ── Klavye ── */
document.addEventListener("keydown", e => {
  const yaziyor = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"){ e.preventDefault();
    $("#palet").classList.contains("on") ? paletKapat() : paletAc(); return; }
  if ($("#palet").classList.contains("on")){
    if (e.key === "Escape") return paletKapat();
    if (e.key === "ArrowDown"){ e.preventDefault(); return paletGez(1); }
    if (e.key === "ArrowUp"){ e.preventDefault(); return paletGez(-1); }
    if (e.key === "Enter"){ e.preventDefault(); return pKayit[pSecili]?.yap(); }
    return;
  }
  if (e.key === "Escape"){ if ($("#onay").open) return; cekmeceKapat(); $("#ara").blur(); return; }
  if (yaziyor) return;
  if (e.key === "/"){ e.preventDefault(); $("#ara").focus(); return; }
  if (e.key.toLowerCase() === "r"){ yukle(true, true); return; }
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.classList?.contains("oge")) e.target.click();
});

$("#yenile").onclick = e => {
  const s = e.currentTarget.querySelector("svg");
  s.animate([{transform:"rotate(0)"},{transform:"rotate(360deg)"}],{duration:600,easing:"cubic-bezier(.22,1,.36,1)"});
  yukle(true, true);
};
$("#ipucu").onclick = paletAc;

// Cekmece acikken yenileme DOM'a dokunmaz: okudugun kayit altindan kaymasin.
function otoBasla(){
  clearInterval(oto);
  oto = setInterval(() => { if (!$("#cekmece").classList.contains("on")) yukle(false); }, 5000);
}
yukle(true, true).then(otoBasla);
</script></body></html>`;
}
