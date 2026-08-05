// Panel arayuzu — tek dosya, sifir bagimlilik, CDN yok (Electron'da da calisir).
// Eski statik panelden farki: veriyi /api/*'dan CANLI ceker, surec baslatip
// durdurabilir, brain icerigini (karar/bug govdesi) gosterir ve arar.
export function renderApp() {
  return `<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>serif-brain — Merkezi Panel</title>
<style>
:root{
  --bg:#0b0d10; --panel:#14181d; --panel2:#1a1f26; --line:#252c35;
  --tx:#e6edf3; --dim:#8b97a6; --dim2:#5d6875;
  --ok:#2ea043; --warn:#d29922; --err:#f85149; --acc:#4493f8;
}
@media (prefers-color-scheme: light){
  :root{ --bg:#f6f8fa; --panel:#fff; --panel2:#f0f3f6; --line:#d6dde5;
         --tx:#1f2328; --dim:#59636e; --dim2:#8c959f; }
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);
  font:14px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif}
button{font:inherit;cursor:pointer;border:1px solid var(--line);background:var(--panel2);
  color:var(--tx);border-radius:7px;padding:5px 11px}
button:hover{border-color:var(--acc)}
button:disabled{opacity:.4;cursor:not-allowed}
button.pri{background:var(--acc);border-color:var(--acc);color:#fff}
button.dan{background:transparent;border-color:var(--err);color:var(--err)}
input,select{font:inherit;background:var(--panel);color:var(--tx);
  border:1px solid var(--line);border-radius:7px;padding:7px 10px}
input:focus,select:focus{outline:none;border-color:var(--acc)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}

header{position:sticky;top:0;z-index:20;background:var(--bg);
  border-bottom:1px solid var(--line);padding:12px 18px;
  display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header h1{font-size:15px;margin:0;font-weight:650;letter-spacing:-.2px}
header .sp{flex:1}
#q{width:min(380px,42vw)}
.badge{font-size:11px;padding:2px 8px;border-radius:99px;background:var(--panel2);
  color:var(--dim);border:1px solid var(--line)}

main{padding:18px;max-width:1500px;margin:0 auto}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(330px,1fr))}

.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;
  padding:14px;display:flex;flex-direction:column;gap:10px}
.card.run{border-color:var(--ok)}
.card h3{margin:0;font-size:15px;font-weight:620;display:flex;align-items:center;gap:8px}
.dot{width:8px;height:8px;border-radius:99px;background:var(--dim2);flex:none}
.dot.on{background:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 25%,transparent)}
.dot.foreign{background:var(--warn)}
.path{font-size:11px;color:var(--dim2);word-break:break-all}
.bar{height:5px;background:var(--panel2);border-radius:99px;overflow:hidden}
.bar>i{display:block;height:100%;background:var(--acc)}
.stats{display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dim)}
.stats b{color:var(--tx);font-weight:600}
.crit{color:var(--err)}
.row{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.muted{color:var(--dim);font-size:12px}
/* Calistirma komutu bazen cok uzun (monorepo concurrently zinciri) — kirpilmazsa
   kart sisip izgarayi bozuyor. Iki satira kirp, tamamini title'da tut. */
.cmd{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden;color:var(--dim);font-size:11.5px;background:var(--panel2);
  border:1px solid var(--line);border-radius:6px;padding:5px 8px;margin-top:auto}
.card{min-height:230px}

/* Detay cekmecesi */
#drawer{position:fixed;inset:0 0 0 auto;width:min(760px,94vw);background:var(--panel);
  border-left:1px solid var(--line);transform:translateX(100%);transition:transform .18s ease;
  z-index:40;display:flex;flex-direction:column}
#drawer.open{transform:none}
#drawer header{position:static;border-bottom:1px solid var(--line)}
#drawer .body{overflow:auto;padding:16px;flex:1}
#scrim{position:fixed;inset:0;background:#0008;opacity:0;pointer-events:none;
  transition:opacity .18s;z-index:30}
#scrim.on{opacity:1;pointer-events:auto}

.item{border:1px solid var(--line);border-radius:9px;padding:10px 12px;margin-bottom:8px;
  background:var(--panel2);cursor:pointer}
.item:hover{border-color:var(--acc)}
.item .t{font-weight:560;margin-bottom:3px}
.item .m{font-size:11px;color:var(--dim);display:flex;gap:7px;flex-wrap:wrap}
.pill{font-size:10px;padding:1px 7px;border-radius:99px;border:1px solid var(--line);
  background:var(--panel);text-transform:uppercase;letter-spacing:.3px}
.pill.critical,.pill.high{color:var(--err);border-color:var(--err)}
.pill.open{color:var(--warn);border-color:var(--warn)}
.pill.closed,.pill.done{color:var(--ok);border-color:var(--ok)}
pre.md{white-space:pre-wrap;word-wrap:break-word;background:var(--panel2);
  border:1px solid var(--line);border-radius:9px;padding:13px;font-size:12.5px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:0}
pre.log{max-height:300px;overflow:auto;font-size:11.5px}
.err{color:var(--err)}
.empty{color:var(--dim);padding:40px;text-align:center}
.tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.tabs button.on{background:var(--acc);border-color:var(--acc);color:#fff}
dialog{background:var(--panel);color:var(--tx);border:1px solid var(--line);
  border-radius:12px;padding:18px;max-width:560px}
dialog::backdrop{background:#000a}
</style></head><body>

<header>
  <h1>serif-brain</h1>
  <span class="badge" id="sayac">—</span>
  <input id="q" placeholder="Tüm brain'lerde ara: karar, bug, not…" autocomplete="off">
  <span class="sp"></span>
  <span class="muted" id="tarama"></span>
  <button id="yenile">Yenile</button>
  <label class="muted"><input type="checkbox" id="oto" checked style="vertical-align:-2px"> oto</label>
</header>

<main>
  <div id="uyari"></div>
  <div class="grid" id="grid"><div class="empty">Yükleniyor…</div></div>
  <h2 style="font-size:13px;color:var(--dim);margin:26px 0 10px;font-weight:600">ARŞİV</h2>
  <div class="grid" id="ars"></div>
</main>

<div id="scrim"></div>
<aside id="drawer">
  <header>
    <h1 id="dbaslik">—</h1><span class="sp"></span>
    <button id="dkapat">Kapat ✕</button>
  </header>
  <div class="body" id="dgovde"></div>
</aside>

<dialog id="onay">
  <h3 style="margin:0 0 8px">Yabancı süreci kapat?</h3>
  <p class="muted" id="onayMetin"></p>
  <pre class="md" id="onayPid"></pre>
  <p class="muted">Bu süreci <b>panel başlatmadı</b> — terminalde veya başka bir uygulamada
  açılmış olabilir. Kapatmak, oradaki işi de sonlandırır.</p>
  <div class="row" style="justify-content:flex-end;margin-top:12px">
    <button id="onayHayir">Vazgeç</button>
    <button class="dan" id="onayEvet">Evet, kapat</button>
  </div>
</dialog>

<script>
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const jget = (u) => fetch(u).then(r => r.json());
const jpost = (u, b) => fetch(u, {method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify(b)}).then(r => r.json());

let DATA = null, seciliRepo = null, oto = null;

function kart(p){
  const s = p.proc || {};
  const durum = s.running ? "on" : (s.foreign ? "foreign" : "");
  const calisiyor = s.running || s.listening;
  const yuzde = p.percent == null ? 0 : p.percent;
  return \`<div class="card \${calisiyor?'run':''}" data-repo="\${esc(p.repo)}">
    <h3><span class="dot \${durum}"></span>\${esc(p.name)}
      \${p.criticalOpen ? \`<span class="pill critical">\${p.criticalOpen} kritik</span>\` : ""}</h3>
    <div class="path">\${esc(p.repo)}</div>
    \${p.error
      ? \`<div class="err">⚠ \${esc(p.error)}</div>\`
      : \`<div class="bar"><i style="width:\${yuzde}%"></i></div>
    <div class="stats">
      <span><b>%\${p.percent ?? "—"}</b> ilerleme</span>
      <span><b>\${p.objCount ?? 0}</b> kayıt</span>
      <span><b>\${p.open ?? 0}</b> açık</span>
      <span><b>\${p.done ?? 0}</b> biten</span>
      <span>son: <b>\${esc(p.last || "—")}</b></span>
    </div>\`}
    <div class="stats">
      <span>port: <b>\${p.port || "—"}</b></span>
      \${s.foreign ? '<span style="color:var(--warn)">yabancı süreç tutuyor</span>' : ""}
      \${s.running ? \`<span style="color:var(--ok)">panel çalıştırdı · pid \${s.pid}</span>\` : ""}
    </div>
    <div class="row">
      <button class="pri" data-act="start" \${(s.running||!p.run)?"disabled":""}>Başlat</button>
      <button data-act="stop" \${!s.running?"disabled":""}>Durdur</button>
      \${s.foreign ? '<button class="dan" data-act="force">Zorla kapat</button>' : ""}
      <button data-act="ac">Kayıtlar</button>
      \${s.running ? '<button data-act="log">Günlük</button>' : ""}
      \${p.port && calisiyor ? \`<a href="http://localhost:\${p.port}" target="_blank"><button>Aç ↗</button></a>\` : ""}
    </div>
    \${p.run ? \`<code class="cmd" title="\${esc(p.run)}">\${esc(p.run)}</code>\`
             : '<code class="cmd">— çalıştırma komutu tanımsız</code>'}
  </div>\`;
}

let sonImza = "";
async function yukle(sync=true, zorla=false){
  DATA = await jget("/api/projects?sync=" + (sync?"1":"0"));

  // DOM'u KOSULSUZ yeniden cizmek, oto-yenileme acikken tiklamak istedigin
  // dugmeyi elinin altindan kaydiriyordu (5sn'de bir tum kartlar yok edilip
  // yeniden yaratiliyordu). Veri degismediyse DOM'a hic dokunma.
  const imza = JSON.stringify([DATA.active, DATA.archived]);
  if (!zorla && imza === sonImza) return;
  sonImza = imza;

  $("#grid").innerHTML = DATA.active.map(kart).join("") || '<div class="empty">Brain bulunamadı.</div>';
  $("#ars").innerHTML = DATA.archived.map(kart).join("");
  $("#sayac").textContent = DATA.active.length + " aktif · " + DATA.archived.length + " arşiv";
  $("#tarama").textContent = "tarama: " + DATA.scanRoots.join(", ");
  $("#uyari").innerHTML = DATA.newlyDiscovered.length
    ? \`<div class="card" style="margin-bottom:14px;border-color:var(--ok)">
         ✓ Yeni brain bulundu ve eklendi: <b>\${DATA.newlyDiscovered.map(p=>esc(p.split("/").pop())).join(", ")}</b></div>\`
    : "";
}

// ── Kart eylemleri ──
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const card = btn.closest(".card");
  const repo = card.dataset.repo;
  const act = btn.dataset.act;

  if (act === "start"){ btn.disabled = true; const r = await jpost("/api/start",{repo});
    if (!r.ok) alert("Başlatılamadı: " + r.error); await yukle(false, true); return; }
  if (act === "stop"){ btn.disabled = true; await jpost("/api/stop",{repo}); await yukle(false, true); return; }
  if (act === "force"){ return zorlaKapatOnayi(repo); }
  if (act === "ac"){ return kayitlariAc(repo); }
  if (act === "log"){ return gunlukAc(repo); }
});

// ── Zorla kapatma: ONAY ZORUNLU ──
async function zorlaKapatOnayi(repo){
  const p = [...DATA.active, ...DATA.archived].find(x => x.repo === repo);
  const bilgi = await jget("/api/port-owner?port=" + p.port);
  $("#onayMetin").innerHTML = \`<b>\${esc(p.name)}</b> için <b>\${p.port}</b> portunu tutan süreç:\`;
  $("#onayPid").textContent = bilgi.pids.map(x => "pid " + x.pid + "  " + x.cmd).join("\\n") || "(bulunamadı)";
  $("#onay").returnValue = "";
  $("#onay").showModal();
  $("#onayEvet").onclick = async () => {
    $("#onay").close();
    const r = await jpost("/api/force-kill", { port: p.port, confirm: true });
    if (!r.ok) alert("Kapatılamadı: " + r.error);
    await yukle(false, true);
  };
}
$("#onayHayir").onclick = () => $("#onay").close();

// ── Çekmece: kayıtlar / detay / günlük ──
function cekmeceAc(baslik, html){
  $("#dbaslik").textContent = baslik;
  $("#dgovde").innerHTML = html;
  $("#drawer").classList.add("open"); $("#scrim").classList.add("on");
}
function cekmeceKapat(){ $("#drawer").classList.remove("open"); $("#scrim").classList.remove("on"); }
$("#dkapat").onclick = cekmeceKapat; $("#scrim").onclick = cekmeceKapat;
document.addEventListener("keydown", e => { if (e.key === "Escape") cekmeceKapat(); });

function itemHtml(i, repo){
  return \`<div class="item" data-id="\${esc(i.id)}" data-repo="\${esc(repo)}">
    <div class="t">\${esc(i.title || i.id)}</div>
    <div class="m">
      <span class="pill">\${esc(i.type)}</span>
      <span class="pill \${esc(i.status)}">\${esc(i.status)}</span>
      \${i.priority ? \`<span class="pill \${esc(i.priority)}">\${esc(i.priority)}</span>\` : ""}
      \${(i.module||[]).map(m => \`<span>\${esc(m)}</span>\`).join("")}
      <span>\${esc((i.updated_at||"").slice(0,10))}</span>
    </div>
    \${i.snippet ? \`<div class="m" style="margin-top:5px;color:var(--dim2)">\${esc(i.snippet.slice(0,140))}…</div>\` : ""}
  </div>\`;
}

async function kayitlariAc(repo, tip="", filtre=""){
  seciliRepo = repo;
  const p = [...DATA.active, ...DATA.archived].find(x => x.repo === repo);
  const d = await jget(\`/api/objects?repo=\${encodeURIComponent(repo)}&type=\${tip}&q=\${encodeURIComponent(filtre)}\`);
  const tabs = [["","tümü"],["decision","kararlar"],["bug","bug'lar"],["note","notlar"],["plan","planlar"]]
    .map(([v,l]) => \`<button data-tip="\${v}" class="\${v===tip?'on':''}">\${l}</button>\`).join("");
  cekmeceAc(p.name, \`
    <div class="tabs">\${tabs}</div>
    <input id="ffiltre" placeholder="Bu projede filtrele…" value="\${esc(filtre)}" style="width:100%;margin-bottom:12px">
    <div class="muted" style="margin-bottom:8px">\${d.count} / \${d.total} kayıt</div>
    <div id="liste">\${d.items.map(i => itemHtml(i, repo)).join("") || '<div class="empty">Kayıt yok.</div>'}</div>\`);

  $("#dgovde").querySelectorAll("button[data-tip]").forEach(b =>
    b.onclick = () => kayitlariAc(repo, b.dataset.tip, $("#ffiltre").value));
  let tmr; $("#ffiltre").oninput = (e) => { clearTimeout(tmr);
    tmr = setTimeout(() => kayitlariAc(repo, tip, e.target.value), 220); };
}

document.addEventListener("click", async (e) => {
  const it = e.target.closest(".item");
  if (!it) return;
  const d = await jget(\`/api/object?repo=\${encodeURIComponent(it.dataset.repo)}&id=\${encodeURIComponent(it.dataset.id)}\`);
  if (!d || d.error) return;
  const fm = d.frontmatter || {};
  cekmeceAc(fm.title || d.id, \`
    <div class="m" style="margin-bottom:12px;display:flex;gap:7px;flex-wrap:wrap">
      <span class="pill">\${esc(fm.type)}</span>
      <span class="pill \${esc(fm.status)}">\${esc(fm.status)}</span>
      \${fm.priority ? \`<span class="pill \${esc(fm.priority)}">\${esc(fm.priority)}</span>\` : ""}
      <span class="muted">\${esc(fm.id)}</span>
    </div>
    <pre class="md">\${esc(d.body || "(gövde yok)")}</pre>
    <div class="muted" style="margin-top:10px">\${esc(d.path || "")}</div>
    <button style="margin-top:12px" id="geri">← Listeye dön</button>\`);
  $("#geri").onclick = () => kayitlariAc(it.dataset.repo);
});

async function gunlukAc(repo){
  const p = [...DATA.active, ...DATA.archived].find(x => x.repo === repo);
  const d = await jget("/api/logs?repo=" + encodeURIComponent(repo));
  cekmeceAc(p.name + " — günlük", \`<pre class="md log">\${
    esc(d.lines.map(l => l.line).join("\\n")) || "(çıktı yok)"}</pre>\`);
}

// ── Global arama ──
let atmr;
$("#q").oninput = (e) => {
  clearTimeout(atmr);
  const q = e.target.value.trim();
  atmr = setTimeout(async () => {
    if (!q) return cekmeceKapat();
    const d = await jget("/api/search?q=" + encodeURIComponent(q));
    cekmeceAc(\`"\${q}" — \${d.results.length} sonuç\`,
      d.results.map(r => \`<div class="muted" style="margin:10px 0 3px">\${esc(r.project)}</div>\`
        + itemHtml(r, r.repo)).join("") || '<div class="empty">Sonuç yok.</div>');
  }, 260);
};

$("#yenile").onclick = () => yukle(true, true);
$("#oto").onchange = (e) => { if (e.target.checked) otoBasla(); else clearInterval(oto); };
function otoBasla(){
  clearInterval(oto);
  // Cekmece acikken yenileme DOM'a dokunmaz: okudugun kayit altindan kaymasin.
  oto = setInterval(() => { if (!$("#drawer").classList.contains("open")) yukle(false); }, 5000);
}

yukle(true, true).then(otoBasla);
</script></body></html>`;
}
