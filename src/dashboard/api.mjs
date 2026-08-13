// Panel veri katmani — SAF veri, HTTP/Electron'dan bagimsiz.
// Ayni fonksiyonlari hem 'dashboard serve' hem Electron kabugu kullanir;
// ikinci bir kopya cikarilmaz.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";
import { loadRegistry, saveRegistry, upsertBrain, brainRootOf, repoOf } from "./registry.mjs";
import { collectAll } from "./collect.mjs";
import { loadObjects, searchObjects, toResult } from "../query/search.mjs";
import * as proc from "./proc.mjs";

const SKIP = new Set(["node_modules", "dist", "build", "out", ".git", "Library", "Applications"]);

/**
 * Otomatik kesif kokleri. SERIF_BRAIN_SCAN_ROOTS verilirse varsayilanin
 * YERINE gecer (eklenmez). Boylece kok kumesi tam olarak denetlenebilir —
 * demo/ekran-goruntusu ve test icin gercek projelerin panele sizmamasi sart.
 * Verilmezse ~/Desktop taranir.
 */
export function scanRoots() {
  const ozel = (process.env.SERIF_BRAIN_SCAN_ROOTS || "").split(":").map(s => s.trim()).filter(Boolean);
  return ozel.length ? ozel : [join(homedir(), "Desktop")];
}

/** Bir kok altinda .serif-brain iceren repo'lari bul (maxdepth 4). */
export function findBrains(root, depth = 0, acc = []) {
  if (depth > 4 || !existsSync(root)) return acc;
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === ".serif-brain") { acc.push(root); continue; }
    if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
    findBrains(join(root, e.name), depth + 1, acc);
  }
  return acc;
}

/**
 * Diskteki brain'leri registry'ye islе — "yeni projeye init attim, panelde
 * kendiliginden cikmali" istegi burada karsilanir. Var olan kayitlarin
 * override/archived alanlarina DOKUNMAZ; sadece eksikleri ekler.
 * @returns eklenen repo yollari
 */
export function syncRegistry() {
  const reg = loadRegistry();
  const bilinen = new Set(reg.brains.map(b => resolve(repoOf(brainRootOf(b.repo)))));
  const eklenen = [];
  for (const root of scanRoots()) {
    for (const repo of findBrains(root)) {
      const abs = resolve(repo);
      if (bilinen.has(abs)) continue;
      upsertBrain(reg, { repo: abs, name: basename(abs) });
      bilinen.add(abs);
      eklenen.push(abs);
    }
  }
  if (eklenen.length) saveRegistry(reg);
  return eklenen;
}

/** Panel ana verisi: projeler + canli surec durumu. */
export function listProjects({ sync = true, now = Date.now() } = {}) {
  const eklenen = sync ? syncRegistry() : [];
  const data = collectAll(loadRegistry(), now);
  const canli = (p) => ({ ...p, proc: proc.status(p.repo, p.port) });
  return {
    ...data,
    active: data.active.map(canli),
    archived: data.archived.map(canli),
    newlyDiscovered: eklenen,
    scanRoots: scanRoots(),
  };
}

function objectsOf(repo) {
  const brainRoot = brainRootOf(repo);
  if (!existsSync(brainRoot)) return [];
  try { return loadObjects(brainRoot); } catch { return []; }
}

/** Tek projenin kararlari/bug'lari — liste (govde YOK, hafif). */
export function projectObjects(repo, { type = null, status = null, q = "", limit = 200 } = {}) {
  const objects = objectsOf(repo);
  const hits = searchObjects(objects, {
    text: q || undefined,
    type: type || undefined,
    status: status || undefined,
  });
  return {
    repo,
    total: objects.length,
    count: hits.length,
    items: hits.slice(0, limit).map(o => toResult(o, { snippet: true })),
  };
}

/** Tek objenin TAM govdesi — detay panelinde gosterilir. */
export function objectDetail(repo, id) {
  const o = objectsOf(repo).find(x => x.frontmatter?.id === id);
  if (!o) return null;
  const fm = o.frontmatter || {};
  let body = o.body ?? "";
  const path = o.file_path || null;
  if (!body && path && existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf8");
      // \r\n TOLERE EDILIR: Windows'ta git autocrlf ile checkout edilen ya da
      // Windows editoruyle kaydedilen obje dosyalari CRLF olur; katı \n kalıbı
      // boyle bir dosyayi "frontmatter yok" sayip sessizce atliyordu.
      const m = raw.match(/^---\r?\n[\s\S]*?\n---\r?\n?([\s\S]*)$/);
      body = m ? m[1] : raw;
    } catch { /* okunamadi */ }
  }
  return { repo, id, frontmatter: fm, body, path };
}

/** TUM brain'lerde arama — merkezi panelin en cok istenen ozelligi. */
export function searchAll(q, { limit = 60 } = {}) {
  if (!q || !q.trim()) return { q: "", results: [] };
  const reg = loadRegistry();
  const results = [];
  for (const b of reg.brains) {
    const repo = repoOf(brainRootOf(b.repo));
    if (b.archived) continue;
    const hits = searchObjects(objectsOf(repo), { text: q });
    for (const o of hits.slice(0, 12)) {
      results.push({ project: b.name || basename(repo), repo, ...toResult(o, { snippet: true }) });
    }
  }
  return { q, results: results.slice(0, limit) };
}

/**
 * Bir projeyi panelden kaldirir (registry kaydini siler).
 *
 * NEDEN OTOMATIK DEGIL: klasor diskte yok diye kaydi kendiliginden silmek,
 * harici disk cikarildiginda / klasor yeniden adlandirildiginda kullanicinin
 * AYARLARINI (port, calistirma komutu, ilerleme hedefi, arsiv gerekcesi)
 * sessizce yok ederdi. Kayip proje arayuzde "KAYIP" olarak isaretlenir,
 * silme kararini kullanici verir — tek tikla.
 */
export function forgetProject(repo) {
  const abs = knownRepo(repo);
  if (!abs) return { ok: false, error: "bilinmeyen proje" };
  const reg = loadRegistry();
  const once = reg.brains.length;
  reg.brains = reg.brains.filter(b => resolve(repoOf(brainRootOf(b.repo))) !== abs);
  saveRegistry(reg);
  return { ok: true, removed: once - reg.brains.length };
}

/** Registry'de kayitli ama diskte brain'i olmayan projeler. */
export function missingProjects() {
  return loadRegistry().brains
    .map(b => ({ name: b.name, repo: repoOf(brainRootOf(b.repo)) }))
    .filter(p => !existsSync(brainRootOf(p.repo)));
}

/** Bir repo gercekten registry'de mi — API'ye gelen yolu dogrulamak icin. */
export function knownRepo(repo) {
  if (!repo) return null;
  const abs = resolve(repo);
  const reg = loadRegistry();
  const hit = reg.brains.find(b => resolve(repoOf(brainRootOf(b.repo))) === abs);
  return hit ? abs : null;
}

/** Bir repo'nun panel kaydi (port/run komutu icin). */
export function projectRecord(repo) {
  const data = collectAll(loadRegistry());
  return [...data.active, ...data.archived].find(p => resolve(p.repo) === resolve(repo)) || null;
}

/** Panelden proje ayari (port/run/note) guncelle — override katmanina yazar. */
export function setOverride(repo, patch = {}) {
  const abs = knownRepo(repo);
  if (!abs) return { ok: false, error: "bilinmeyen proje" };
  const reg = loadRegistry();
  const hit = reg.brains.find(b => resolve(repoOf(brainRootOf(b.repo))) === abs);
  hit.override = { ...(hit.override || {}), ...patch };
  for (const [k, v] of Object.entries(patch)) if (v === "" || v == null) delete hit.override[k];
  saveRegistry(reg);
  return { ok: true, override: hit.override };
}

/** Son degisiklik zamani — arayuzun "yenile" gerekiyor mu kararina yardim eder. */
export function brainMtime(repo) {
  const root = join(brainRootOf(repo), "objects");
  try { return statSync(root).mtimeMs; } catch { return 0; }
}
