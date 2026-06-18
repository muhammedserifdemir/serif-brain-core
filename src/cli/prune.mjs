// serif-brain prune — hijyen otomasyonu. Stale + otomasyon (churn) objelerini
// bulur; varsayılan DRY-RUN (sadece listeler), --apply ile .serif-brain/archive/
// altına GÜVENLE TAŞIR (silmez) + manifest yazar + indexleri yeniler.
// Bridge gürültüsünü elle temizlemek yerine tek komutla, geri alınabilir biçimde.
import { resolve, join, dirname, relative } from "node:path";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { loadObjects } from "../query/search.mjs";

function toRe(p) { try { return p instanceof RegExp ? p : new RegExp(p); } catch { return null; } }

const ACTIVE = new Set(["open", "active", "in_progress", "blocked", "queued"]);

export async function pruneCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  const cfg = loadConfig(brainRoot);
  const apply = args.flags.apply === true;
  const staleDays = args.flags.days ? parseInt(args.flags.days, 10) : (cfg?.prune_stale_days || 120);
  const autoRes = (cfg?.automation_id_patterns || ["-bridge-"]).map(toRe).filter(Boolean);
  const now = Date.now();

  const all = loadObjects(brainRoot);
  const candidates = [];
  for (const o of all) {
    const fm = o.frontmatter || {};
    const isAuto = autoRes.some((re) => re.test(fm.id || ""));
    const updMs = fm.updated_at || fm.created_at ? new Date(fm.updated_at || fm.created_at).getTime() : 0;
    const ageDays = updMs ? Math.floor((now - updMs) / 86400000) : null;
    const isStale = ACTIVE.has(fm.status) && ageDays !== null && ageDays > staleDays;
    if (isAuto || isStale) {
      const reasons = [];
      if (isAuto) reasons.push("otomasyon-churn");
      if (isStale) reasons.push(`stale>${staleDays}g (${ageDays}g)`);
      candidates.push({ id: fm.id, type: fm.type, title: fm.title, file: o.file_path, reasons });
    }
  }

  console.log(`[serif-brain prune] ${apply ? "APPLY" : "DRY-RUN"} — brain: ${brainRoot}`);
  console.log(`  Eşik: stale > ${staleDays} gün · otomasyon: ${autoRes.length} desen`);
  console.log(`  Aday: ${candidates.length} obje`);
  if (candidates.length === 0) { console.log(`  ✓ Temizlenecek bir şey yok.`); return 0; }

  for (const c of candidates) {
    console.log(`    - ${c.type}/${c.id} — ${c.reasons.join(", ")}`);
  }

  if (!apply) {
    console.log(`\n  (DRY-RUN — hiçbir şey taşınmadı. Uygulamak için: prune --apply)`);
    return 0;
  }

  // APPLY — dosyaları archive/prune-<ts>/ altına TAŞI (sil değil) + manifest.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDir = join(brainRoot, "archive", `prune-${stamp}`);
  const moved = [];
  for (const c of candidates) {
    try {
      const rel = relative(join(brainRoot, "objects"), c.file);
      const dest = join(archiveDir, rel);
      mkdirSync(dirname(dest), { recursive: true });
      renameSync(c.file, dest);
      moved.push({ ...c, archived_to: relative(brainRoot, dest) });
    } catch (e) {
      console.error(`    ✗ taşınamadı: ${c.id} — ${e.message}`);
    }
  }
  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(join(archiveDir, "manifest.json"),
    JSON.stringify({ prunedAt: stamp, staleDays, count: moved.length, items: moved }, null, 2));

  // Indexleri + grafı yenile ki türetilmiş veriler tutarlı kalsın.
  const { rebuildIndexesCommand } = await import("./rebuild-indexes.mjs");
  await rebuildIndexesCommand({ args: { flags: { project: projectRoot } } });

  console.log(`\n  ✓ ${moved.length} obje arşivlendi → ${relative(projectRoot, archiveDir)}`);
  console.log(`  (Geri almak için manifest.json'daki dosyaları objects/ altına taşı.)`);
  return 0;
}
