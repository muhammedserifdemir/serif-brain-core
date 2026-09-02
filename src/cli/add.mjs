// serif-brain add bug | decision | plan | record
// Ince CLI sarmalayici — yazma mantigi markdown/write-ops.mjs'te (MCP ile ORTAK).
import { resolve, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { createObject, TYPE_DEFAULTS } from "../markdown/write-ops.mjs";

export async function addCommand({ args, subcommand }) {
  const type = subcommand[0];
  if (!type || !TYPE_DEFAULTS[type]) {
    console.error(`[serif-brain add] kullanim: serif-brain add <bug|decision|plan|record> --title "..." (--body "..."|--stdin|--sablon) [--module testx] [--priority high] [--files a,b]`);
    console.error(`  plan   = yol haritasi/faz plani (status: active dogar, plans/ altina yazilir)`);
    console.error(`  record = yapilmis is kaydi (status: done dogar, decisions/ altina yazilir)`);
    console.error(`  --body = kaydin govdesi (ZORUNLU; bilgi su an sende, sonra olmayacak)`);
    console.error(`  --stdin = govdeyi borudan oku:  echo "..." | serif-brain add record --title "..." --stdin`);
    console.error(`  --sablon = bilerek bos sablon yaz (sonra elle dolduracaksin) — varsayilan DEGIL`);
    return 1;
  }

  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  }
  const config = loadConfig(brainRoot);

  if (!args.flags.title) {
    console.error(`[serif-brain add ${type}] --title zorunlu`);
    return 1;
  }

  const govde = typeof args.flags.body === "string" && args.flags.body
    ? args.flags.body
    : (args.flags.stdin ? readFileSync(0, "utf8") : null);

  // GOVDESIZ KAYIT VARSAYILAN OLARAK REDDEDILIR. Uyari yetmedi: uyari basildigi
  // halde kayitlar bos kaldi (EduX 2026-09-02: son iki haftanin 24 kaydi
  // basliktan ibaretti, kritik devir ve onarim plani dahil). Kayit acan o anda
  // bilgiye SAHIPTIR; sonra doldurulmuyor. Bos sablon yalnizca acikca
  // istenirse (--sablon) yazilir.
  if (!govde || !String(govde).trim()) {
    if (!args.flags.sablon) {
      console.error(`[serif-brain add ${type}] GOVDE YOK — kayit yazilmadi.`);
      console.error(`  Basliktan ibaret kayit hicbir sey ogretmez; "ne yapildi" sorusu cevapsiz kalir.`);
      console.error(`  Secenekler:`);
      console.error(`    --body "Baglam / karar / kanit..."     (tek satir yeter, sonra buyutulebilir)`);
      console.error(`    echo "..." | serif-brain add ${type} --title "..." --stdin`);
      console.error(`    --sablon                               (bilerek bos sablon; sonra elle doldur)`);
      return 1;
    }
  }

  const r = createObject({
    brainRoot, projectRoot, config, type,
    title: args.flags.title,
    module: args.flags.module,
    priority: args.flags.priority,
    severity: args.flags.severity,
    status: args.flags.status,
    tags: args.flags.tags,
    // --stdin: govdeyi borudan oku. Cok satirli icerigi kabuk tirnaklariyla
    // bogusmadan gecirmenin tek pratik yolu; ajanlar da bunu kullanabilir.
    body: govde && String(govde).trim() ? govde : null,
    files: typeof args.flags.files === "string"
      ? args.flags.files.split(",").map((s) => s.trim()).filter(Boolean)
      : null,
    projectId: args.flags.project_id || null,
    id: args.flags.id || null,
    force: !!args.flags.force,
  });

  if (!r.ok) {
    console.error(`[serif-brain add ${type}] HATA: ${r.error}`);
    if (r.suggestId) {
      console.error(``);
      console.error(`  Secenekler:`);
      console.error(`    1) Alternatif ID kullan:  --id ${r.suggestId}`);
      console.error(`    2) Farkli baslik dene:    (slug degisir)`);
      console.error(`    3) Mevcudu uzerine yaz:   --force  (DIKKAT: kalici)`);
    }
    return 1;
  }

  if (r.hint) console.error(`[serif-brain add] IPUCU: ${r.hint}`);
  console.log(`[serif-brain add ${type}]`);
  console.log(`  + ${r.path}`);
  console.log(`    id: ${r.id}`);
  console.log(`    status: ${r.status}, priority: ${r.priority}, module: ${r.module}`);
  if (r.autoFilled) {
    console.log(`  relations.files: ${r.autoFilled} dosya git'ten otomatik dolduruldu (--files ile ezebilirsin)`);
  }
  for (const w of r.warnings) console.log(`    ⚠ ${w}`);

  // Gövdesiz kayit, baslıktan baska bilgi tasimayan bir kabuktur: context'e
  // girer, yer kaplar, hicbir sey ogretmez. `record` icin daha agir — 'done'
  // dogdugu icin hicbir is akisinda tekrar onune gelmez.
  if (r.govdesiz) {
    console.log(``);
    console.log(`  ⚠ Bu kayit GOVDESIZ — bos sablon yazildi.`);
    if (type === "record") {
      console.log(`    record 'done' dogar: bu dosya bir daha karsina CIKMAZ. Simdi doldur:`);
      console.log(`      serif-brain close ${r.id} --note "ne yapildi / neden / kanit"`);
    } else {
      console.log(`    Doldur: ${r.path}`);
    }
  }

  // Dosyaya baglanmamis kayit, kapinin o dosyada SUSMASI demektir.
  if (r.dosyasiz) {
    console.log(``);
    console.log(`  ⚠ Bu kayit hicbir DOSYAYA bagli degil.`);
    console.log(`    Dosyaya bagli olmayan kayit, o dosyaya dokunulurken kapida GORUNMEZ.`);
    if (r.adaylar.length) {
      console.log(`    Son commit'lerdeki adaylar:`);
      for (const f of r.adaylar.slice(0, 5)) console.log(`      · ${f}`);
      console.log(`    Bagla: serif-brain add ... --files ${r.adaylar.slice(0, 2).join(",")}`);
      console.log(`    (ya da mevcut kaydi duzenle: ${r.path})`);
    }
  }

  console.log(``);
  console.log(`  Sonraki: serif-brain rebuild-indexes`);
  return 0;
}
