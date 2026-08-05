// serif-brain dashboard — tüm brain'leri tarayıp tek statik HTML yönetici paneli üretir.
// Alt komutlar: build (varsayılan) | add <yol> | scan [dir] | list | archive <ad> | rm <ad>
import { writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { loadRegistry, saveRegistry, upsertBrain, findBrain, brainRootOf, repoOf } from "../dashboard/registry.mjs";
import { detectProject } from "../dashboard/detect.mjs";
import { collectAll } from "../dashboard/collect.mjs";
import { renderDashboard } from "../dashboard/render.mjs";
import { serve } from "../dashboard/server.mjs";
import * as proc from "../dashboard/proc.mjs";
import { sunucuyuGarantile, tarayicidaAc, ayaktaMi, VARSAYILAN_PORT } from "../dashboard/launch.mjs";

// Canli panel: statik HTML'in yapamadigi uc sey burada olur — surec baslat/durdur,
// canli brain sorgusu, yeni projeyi kendiliginden kesfetme.
async function cmdServe(flags) {
  const port = Number(flags.port) || 4700;
  const { port: gercek } = await serve({ port });
  console.log(`[dashboard] canli panel: http://127.0.0.1:${gercek}`);
  console.log(`[dashboard] durdurmak icin Ctrl+C`);
  const kapat = async () => {
    const n = await proc.stopAll();          // panelin baslattigi surecleri birak
    if (n) console.log(`[dashboard] ${n} surec durduruldu`);
    process.exit(0);
  };
  process.on("SIGINT", kapat);
  process.on("SIGTERM", kapat);
  return new Promise(() => {});              // sunucu acik kalir
}

// Dock uygulamasi (Electron) AYRI pakette: cekirdek "sifir bagimlilik"
// garantisini korusun diye. Bu komut kabugu bulur, kuruluysa acar; degilse
// tam olarak ne yapilacagini soyler — sessizce basarisiz olmaz.
function electronAdaylari() {
  const ev = homedir();
  return [
    process.env.SERIF_BRAIN_APP,
    "/Applications/serif-brain.app",
    join(ev, "Applications", "serif-brain.app"),
    join(ev, "Desktop", "seriftech-packages", "serif-brain-dashboard", "dist", "mac-arm64", "serif-brain.app"),
    join(ev, "Desktop", "seriftech-packages", "serif-brain-dashboard", "dist", "mac-x64", "serif-brain.app"),
  ].filter(Boolean);
}

function cmdApp() {
  const bulunan = electronAdaylari().find(existsSync);
  if (bulunan) {
    execFile("open", [bulunan], () => {});
    console.log(`[dashboard] Dock uygulamasi acildi: ${bulunan}`);
    return 0;
  }
  const kaynak = join(homedir(), "Desktop", "seriftech-packages", "serif-brain-dashboard");
  console.log(`[dashboard] Dock uygulamasi bulunamadi.`);
  console.log(``);
  console.log(`Tarayici paneli her zaman calisir (kurulum gerekmez):`);
  console.log(`  serif-brain dashboard serve`);
  console.log(``);
  if (existsSync(kaynak)) {
    console.log(`Dock uygulamasini uretmek icin:`);
    console.log(`  cd ${kaynak}`);
    console.log(`  npm install && npm run dist`);
    console.log(`  open dist/mac-arm64/serif-brain.app   # sonra Dock'ta Tut`);
  } else {
    console.log(`Dock uygulamasi ayri pakette (serif-brain-dashboard) — cekirdegin`);
    console.log(`sifir bagimlilik garantisi bozulmasin diye Electron buraya konmadi.`);
    console.log(`Kaynak beklenen konum: ${kaynak}`);
  }
  console.log(``);
  console.log(`Baska konumdaysa: SERIF_BRAIN_APP=/yol/serif-brain.app serif-brain dashboard app`);
  return 0;
}

// Paneli ac: ayakta degilse arka planda baslat, sonra tarayicida goster.
async function cmdOpen(flags) {
  const port = Number(flags.port) || VARSAYILAN_PORT;
  const vardi = await ayaktaMi(port);
  const { url, hata } = await sunucuyuGarantile(port);
  if (!url) { console.error(`[dashboard] acilamadi: ${hata}`); return 1; }
  tarayicidaAc(url);
  console.log(`[dashboard] ${url}  ${vardi ? "(zaten calisiyordu)" : "(baslatildi)"}`);
  return 0;
}

function defaultOut() {
  return process.env.SERIF_BRAIN_DASHBOARD_OUT || join(homedir(), "Desktop", "serif-brain-dashboard.html");
}

// Bir kök altında (maxdepth 4) tüm .serif-brain dizinlerini bul
function findBrains(root, depth = 0, acc = []) {
  if (depth > 4 || !existsSync(root)) return acc;
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === ".serif-brain") { acc.push(join(root, e.name)); continue; }
    if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "dist" || e.name === "build") continue;
    findBrains(join(root, e.name), depth + 1, acc);
  }
  return acc;
}

function buildHtml(flags) {
  const reg = loadRegistry();
  if (!reg.brains.length) {
    console.log(`[dashboard] Registry boş. Önce ekle: 'serif-brain dashboard add <yol>' veya 'dashboard scan'`);
    return 1;
  }
  const data = collectAll(reg, Date.now());
  const html = renderDashboard(data);
  const out = resolve(flags.out || defaultOut());
  writeFileSync(out, html);
  console.log(`[dashboard] ${data.active.length} aktif + ${data.archived.length} arşiv proje → ${out}`);
  for (const p of data.active) {
    const pct = p.percent == null ? "  —" : `${String(p.percent).padStart(3)}%`;
    console.log(`  ${pct}  ${p.name.padEnd(22)} ${p.last.padEnd(5)} ${(p.port || "—").padEnd(12)} ${p.error ? "⚠ " + p.error : ""}`);
  }
  if (flags.open) execFile("open", [out], () => {});
  return 0;
}

function cmdAdd(repoArg, flags) {
  if (!repoArg) { console.error("[dashboard add] kullanım: dashboard add <proje-yolu>"); return 1; }
  const brainRoot = brainRootOf(repoArg);
  if (!existsSync(brainRoot)) { console.error(`[dashboard add] brain yok: ${brainRoot} — önce 'serif-brain init'`); return 1; }
  const repo = repoOf(brainRoot);
  const det = detectProject(repo);
  const reg = loadRegistry();
  const override = {};
  if (flags.port) override.port = String(flags.port);
  if (flags.run) override.run = String(flags.run);
  if (flags.live) override.liveUrl = String(flags.live);
  if (flags.progress) override.progressTarget = parseInt(flags.progress, 10);
  if (flags.note) override.note = String(flags.note);
  const entry = upsertBrain(reg, {
    repo,
    name: flags.name ? String(flags.name) : (det.name || basename(repo)),
    archived: !!flags.archived,
    override,
  });
  saveRegistry(reg);
  console.log(`[dashboard add] eklendi: ${entry.name}`);
  console.log(`  repo:    ${repo}`);
  console.log(`  port:    ${override.port || det.port}  (oto)`);
  console.log(`  çalıştır: ${override.run || det.run || "—"}  (oto)`);
  if (det.prereqs.length) console.log(`  prereq:  ${det.prereqs.join(", ")}  (oto)`);
  console.log(`  Override için: dashboard add ${repo} --port 3001 --run "next dev -p 3001" --live x.com --progress 60 --note "..."`);
  return 0;
}

function cmdScan(dirArg) {
  const root = resolve(dirArg || join(homedir(), "Desktop"));
  const brains = findBrains(root);
  const reg = loadRegistry();
  let added = 0;
  for (const b of brains) {
    const repo = repoOf(b);
    const det = detectProject(repo);
    const existed = !!findBrain(reg, repo);
    upsertBrain(reg, { repo, name: det.name || basename(repo) });
    if (!existed) added++;
    console.log(`  ${existed ? "·" : "+"} ${basename(repo)}`);
  }
  saveRegistry(reg);
  console.log(`[dashboard scan] ${root} → ${brains.length} brain bulundu, ${added} yeni eklendi.`);
  return 0;
}

function cmdList() {
  const reg = loadRegistry();
  if (!reg.brains.length) { console.log("[dashboard] registry boş."); return 0; }
  for (const b of reg.brains) {
    const flags = [b.archived ? "arşiv" : "aktif", ...(b.override?.progressTarget != null ? [`hedef:${b.override.progressTarget}%`] : [])];
    console.log(`  ${(b.name || basename(b.repo)).padEnd(24)} [${flags.join(", ")}]  ${b.repo}`);
  }
  return 0;
}

function cmdArchive(nameArg, flags, archived = true) {
  const reg = loadRegistry();
  const b = findBrain(reg, nameArg);
  if (!b) { console.error(`[dashboard] bulunamadı: ${nameArg}`); return 1; }
  b.archived = archived;
  if (flags.reason) { b.archiveReason = String(flags.reason); }
  saveRegistry(reg);
  console.log(`[dashboard] ${b.name} → ${archived ? "arşiv" : "aktif"}${flags.reason ? " (" + flags.reason + ")" : ""}`);
  return 0;
}

function cmdRm(nameArg) {
  const reg = loadRegistry();
  const before = reg.brains.length;
  reg.brains = reg.brains.filter((b) => !(findBrain({ brains: [b] }, nameArg)));
  saveRegistry(reg);
  console.log(`[dashboard] ${before - reg.brains.length} kayıt silindi.`);
  return 0;
}

export async function dashboardCommand({ args, subcommand }) {
  const sub = subcommand[0];
  const rest = subcommand.slice(1);
  const f = args.flags;
  switch (sub) {
    case "serve": return await cmdServe(f);
    case "open":  return await cmdOpen(f);
    case "app":   return cmdApp();
    // Argumansiz 'dashboard' ESKIDEN BERI statik HTML uretir. 'serve' bu listeye
    // sonradan eklendi; varsayilani ona cevirmek, komutu bilmeden calistiran
    // kullaniciyi bitmeyen bir sunucuya dusururdu. Varsayilan degismedi.
    case undefined:
    case "build": return buildHtml(f);
    case "add":   return cmdAdd(rest[0], f);
    case "scan":  return cmdScan(rest[0]);
    case "list":  return cmdList();
    case "archive": return cmdArchive(rest[0], f, true);
    case "unarchive": return cmdArchive(rest[0], f, false);
    case "rm":    return cmdRm(rest[0]);
    default:
      console.error(`[dashboard] bilinmeyen alt komut: ${sub} (serve|open|app|build|add|scan|list|archive|unarchive|rm)`);
      return 1;
  }
}
