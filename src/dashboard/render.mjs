// Toplanan kayıtlardan tek dosyalık statik HTML üretir (açık tema, sıfır bağımlılık).
// Veri JSON olarak gömülür, istemci tarafı çizer (mock ile birebir görünüm).

function fmtDate(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function renderDashboard(data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const stamp = fmtDate(data.generatedAt || Date.now());
  return `<!DOCTYPE html>
<html lang="tr"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Serif Brain · Yönetici Dashboard</title>
<style>
:root{--bg:#f5f6f8;--card:#fff;--line:#e7e9ee;--line-2:#eef0f4;--txt:#16181d;--muted:#6b7280;--faint:#9aa1ad;
--accent:#4f46e5;--accent-soft:#eef0fe;--green:#16a34a;--amber:#d97706;--red:#e11d48;
--mono:'SF Mono',ui-monospace,'JetBrains Mono',monospace;--sans:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--txt);font-family:var(--sans);min-height:100vh;padding:44px clamp(20px,5vw,76px) 90px;letter-spacing:-.01em;-webkit-font-smoothing:antialiased}
header.top{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:6px}
.brand{display:flex;align-items:center;gap:13px}.brand .dot{width:10px;height:10px;border-radius:50%;background:var(--accent)}
h1{font-size:clamp(24px,3.2vw,36px);font-weight:760;letter-spacing:-.03em;line-height:1}h1 span{color:var(--faint);font-weight:500}
.sub{color:var(--muted);font-size:13px;margin-top:9px;font-family:var(--mono)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:32px 0 8px}@media(max-width:820px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px 22px}
.kpi .v{font-size:36px;font-weight:780;letter-spacing:-.04em;line-height:1}.kpi .l{color:var(--muted);font-size:12px;margin-top:8px;text-transform:uppercase;letter-spacing:.07em}
.kpi.green .v{color:var(--green)}.kpi.amber .v{color:var(--amber)}.kpi.red .v{color:var(--red)}.kpi.cy .v{color:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(348px,1fr));gap:16px;margin-top:22px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px 22px 16px;transition:.2s}
.card:hover{border-color:#d4d8e0;box-shadow:0 14px 34px -22px rgba(20,24,40,.32);transform:translateY(-2px)}
.chead{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
.pname{font-size:18px;font-weight:680;letter-spacing:-.02em;display:flex;align-items:center;gap:9px}
.pname .sdot{width:8px;height:8px;border-radius:50%;flex-shrink:0}.sdot.active{background:var(--green)}.sdot.idle{background:var(--faint)}
.ptag{color:var(--faint);font-family:var(--mono);font-size:11px;margin-top:4px}
.ring text{font-family:var(--sans);font-weight:780;fill:var(--txt)}.ring .pct{font-size:14px}.ring .na{font-size:11px;fill:var(--faint)}
.info{display:flex;align-items:center;gap:8px;margin:16px 0 0;color:var(--muted);font-family:var(--mono);font-size:11.5px;flex-wrap:wrap}
.info b{color:var(--accent);font-weight:600}.info a{color:var(--muted);text-decoration:none;border-bottom:1px dotted #c3c8d2}.info a:hover{color:var(--accent)}
.runrow{display:flex;align-items:center;gap:10px;margin-top:13px;background:#f7f8fa;border:1px solid var(--line-2);border-radius:10px;padding:9px 11px}
.runrow code{font-family:var(--mono);font-size:11.5px;color:#3a3f4b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}.runrow .nope{color:var(--faint)}
.copy{cursor:pointer;border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:7px;padding:5px 9px;font-family:var(--mono);font-size:11px;transition:.15s;flex-shrink:0}
.copy:hover{color:var(--txt);border-color:#cdd2db}.copy.ok{color:var(--green);border-color:#bfe3cb}
.warn{margin-top:11px;font-family:var(--mono);font-size:11px;color:var(--amber);display:flex;gap:6px}
.foot{display:flex;align-items:center;gap:20px;margin-top:15px;padding-top:13px;border-top:1px solid var(--line-2)}
.stat{font-family:var(--mono);font-size:12px;color:var(--muted)}.stat b{font-size:15px;font-weight:700;color:var(--txt);font-family:var(--sans)}
.stat.done b{color:var(--green)}.stat.crit b{color:var(--red)}
.expand summary{cursor:pointer;list-style:none;font-family:var(--mono);font-size:11.5px;color:var(--accent)}.expand summary::-webkit-details-marker{display:none}.expand summary:hover{opacity:.7}
.more{margin-left:auto}
.tasklist{margin-top:12px;display:flex;flex-direction:column;gap:7px;padding-top:12px;border-top:1px solid var(--line-2)}
.task{display:flex;gap:10px;align-items:baseline;font-size:13px;line-height:1.4}
.task .tk{font-family:var(--mono);font-size:9.5px;padding:2px 6px;border-radius:5px;flex-shrink:0;font-weight:600}
.tk.done{color:var(--green);background:#e8f6ec}.tk.crit{color:var(--red);background:#fdeaef}
.task .when{margin-left:auto;color:var(--faint);font-family:var(--mono);font-size:10px;flex-shrink:0;white-space:nowrap}
.addcard{border:1.5px dashed #d3d7e0;border-radius:18px;padding:24px 22px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:11px;transition:.2s}
.addcard:hover{border-color:var(--accent);background:var(--accent-soft)}
.addcard .plus{width:34px;height:34px;border-radius:50%;border:1.5px solid #d3d7e0;display:grid;place-items:center;color:var(--accent);font-size:20px}
.addcard h3{font-size:15px;font-weight:680}.addcard p{color:var(--muted);font-size:12.5px;line-height:1.5}
.addcard .cmd{font-family:var(--mono);font-size:11px;color:var(--accent);background:var(--accent-soft);border:1px solid #dfe2fb;border-radius:8px;padding:8px 11px;width:100%}
.arcsec{margin-top:46px}.arctitle{font-family:var(--mono);font-size:12px;color:var(--faint);text-transform:uppercase;letter-spacing:.1em;display:flex;align-items:center;gap:12px;margin-bottom:16px}
.arctitle::after{content:"";flex:1;height:1px;background:var(--line)}
.arcgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.arccard{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;opacity:.78;transition:.2s}.arccard:hover{opacity:1}
.arccard .an{font-size:15px;font-weight:640;display:flex;align-items:center;gap:9px}
.arccard .stamp{font-family:var(--mono);font-size:9.5px;padding:3px 8px;border-radius:6px;margin-left:auto;font-weight:600}
.stamp.cancel{color:var(--red);background:#fdeaef}.stamp.old{color:var(--faint);background:#f0f1f4}
.arccard .aid{font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:6px}.arccard p.n{color:var(--muted);font-size:12px;margin-top:8px;line-height:1.5}
footer{margin-top:52px;color:var(--faint);font-family:var(--mono);font-size:11px;text-align:center;line-height:1.7}
</style></head><body>
<header class="top"><div>
<div class="brand"><span class="dot"></span><h1>Serif Brain <span>/ yönetici dashboard</span></h1></div>
<div class="sub" id="sub"></div></div></header>
<section class="kpis" id="kpis"></section>
<section class="grid" id="grid"></section>
<section class="arcsec" id="arcsec" style="display:none"><div class="arctitle">Arşiv · İptal</div><div class="arcgrid" id="arc"></div></section>
<footer>serif-brain dashboard · statik HTML · sıfır bağımlılık · <code>serif-brain dashboard</code> ile yeniden üretilir</footer>
<script>
const DATA=${json};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const RING=(pct)=>{const r=21,c=2*Math.PI*r;if(pct==null)return '<svg class="ring" width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r="'+r+'" fill="none" stroke="#eceef2" stroke-width="5"/><text class="na" x="27" y="31" text-anchor="middle">—</text></svg>';
const col=pct>=75?'var(--green)':pct>=50?'var(--accent)':'var(--amber)';const off=c*(1-pct/100);
return '<svg class="ring" width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r="'+r+'" fill="none" stroke="#eceef2" stroke-width="5"/><circle cx="27" cy="27" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'" transform="rotate(-90 27 27)"/><text class="pct" x="27" y="32" text-anchor="middle">'+pct+'%</text></svg>'};

document.getElementById('sub').innerHTML=DATA.active.length+' aktif proje · '+DATA.archived.length+' arşiv · son tarama '+'${stamp}'+' · <span style="color:var(--green)">●</span> canlı okuma';
const t=DATA.totals;
document.getElementById('kpis').innerHTML=[
 ['cy',t.active,'Aktif Proje'],['green',t.activeDev,'Aktif Geliştirme'],
 ['amber',t.deployWaiting,'Deploy / Onay Bekliyor'],['red',t.criticalOpen,'Açık Kritik']
].map(k=>'<div class="kpi '+k[0]+'"><div class="v">'+k[1]+'</div><div class="l">'+k[2]+'</div></div>').join('');

document.getElementById('grid').innerHTML=DATA.active.map((p,i)=>{
 const tasks=[...(p.doneItems||[]).map(d=>['done',d.title,d.when]),...(p.critItems||[]).map(c=>['crit',c.title,c.status||'açık'])];
 return '<div class="card"><div class="chead"><div>'
 +'<div class="pname"><span class="sdot '+(p.activeDev?'active':'idle')+'"></span>'+esc(p.name)+'</div>'
 +'<div class="ptag">'+esc(p.projectId||p.repo.split('/').pop())+'</div></div>'+RING(p.percent)+'</div>'
 +'<div class="info">'+(p.port&&p.port!=='—'?'<span>port <b>'+esc(p.port)+'</b></span> ':'')
   +'<span>· '+esc(p.last)+'</span>'
   +(p.liveUrl?' <span>· <a href="https://'+esc(p.liveUrl)+'" target="_blank">'+esc(p.liveUrl)+' ↗</a></span>':'')+'</div>'
 +'<div class="runrow">'+(p.run?'<code>'+esc(p.run)+'</code><button class="copy" data-cmd="'+esc(p.run)+'">kopyala</button>':'<code class="nope">— çalıştırma komutu tanımsız (override ekle)</code>')+'</div>'
 +(p.note?'<div class="warn">⚠ '+esc(p.note)+'</div>':'')
 +(p.statusHealthWarn?'<div class="warn">⚠ status bakımı gerek ('+p.open+' açık, 0 biten)</div>':'')
 +'<div class="foot"><span class="stat done"><b>'+p.done+'</b> biten</span>'
   +'<span class="stat"><b>'+p.open+'</b> açık</span>'
   +(p.criticalOpen?'<span class="stat crit"><b>'+p.criticalOpen+'</b> kritik</span>':'')
   +(tasks.length?'<details class="expand more" data-i="'+i+'"><summary>detay</summary></details>':'')+'</div>'
 +'<div class="taskwrap" id="tw'+i+'"></div></div>';
}).join('')
+'<div class="addcard"><div class="plus">+</div><h3>Projeyi dashboard\\'a ekle</h3>'
+'<p>Claude\\'a <b>"şu projeyi dashboard\\'a ekle"</b> de — güncel durumu (git, port, brain objeleri) okuyup kart oluşturur.</p>'
+'<div class="cmd">serif-brain dashboard add ~/Desktop/&lt;proje&gt;</div></div>';

DATA.active.forEach((p,i)=>{
 const det=document.querySelector('.expand[data-i="'+i+'"]');if(!det)return;
 const tasks=[...(p.doneItems||[]).map(d=>['done',d.title,d.when]),...(p.critItems||[]).map(c=>['crit',c.title,c.status||'açık'])];
 det.addEventListener('toggle',()=>{const w=document.getElementById('tw'+i);
  w.innerHTML=det.open?'<div class="tasklist">'+tasks.map(x=>'<div class="task"><span class="tk '+x[0]+'">'+(x[0]==='done'?'✓':'●')+'</span><span>'+esc(x[1])+'</span><span class="when">'+esc(rel(x[2]))+'</span></div>').join('')+'</div>':'';});
});
function rel(w){if(!w)return '';if(!/^\\d{4}-/.test(String(w)))return w;const d=Math.floor((Date.now()-new Date(w))/86400000);return d<=0?'bugün':d<14?d+'g':d<60?Math.floor(d/7)+'hf':Math.floor(d/30)+'ay';}

if(DATA.archived.length){document.getElementById('arcsec').style.display='';
 document.getElementById('arc').innerHTML=DATA.archived.map(a=>{const cancel=/iptal|cancel/i.test(a.archiveReason||a.note||'');
 return '<div class="arccard"><div class="an">'+esc(a.name)+'<span class="stamp '+(cancel?'cancel':'old')+'">'+(cancel?'İPTAL':'ESKİ')+'</span></div>'
 +'<div class="aid">'+esc(a.projectId||a.repo.split('/').pop())+'</div>'
 +'<p class="n">'+esc(a.archiveReason||a.note||'')+'</p></div>';}).join('');}

document.addEventListener('click',e=>{const b=e.target.closest('.copy');if(!b)return;
 navigator.clipboard&&navigator.clipboard.writeText(b.dataset.cmd);b.textContent='✓';b.classList.add('ok');setTimeout(()=>{b.textContent='kopyala';b.classList.remove('ok')},1300);});
</script></body></html>`;
}
