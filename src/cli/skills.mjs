// serif-brain skills — paketle gelen Claude skill'lerini projeye tasi/guncelle.
// Alt komutlar: status (varsayilan) | list | update
//
// init var olan skill dosyasini ASLA ezmez (yerel duzenleme korunur). Bunun yan
// etkisi: paketteki skill guncellenince, o skill'i zaten olan projeye yeni surum
// gitmez. Bu komut o bosllugu kapatir. prune/capture ile ayni sozlesme:
// DRY-RUN VARSAYILAN, yazmak icin --apply.
import { resolve } from "node:path";
import { planSkillSync, applySkillSync, listPackageSkills, readManifest, MANIFEST_NAME } from "../skills/sync.mjs";

function summarize(plan) {
  const totals = { missing: 0, stale: 0, edited: 0, same: 0 };
  for (const skill of plan.skills) {
    for (const file of skill.files) totals[file.status]++;
  }
  return totals;
}

function statusLabel(files) {
  if (files.some(f => f.status === "edited")) return "YEREL DUZENLEME";
  if (files.some(f => f.status === "missing")) {
    return files.every(f => f.status === "missing") ? "EKSIK" : "KISMEN EKSIK";
  }
  if (files.some(f => f.status === "stale")) return "BAYAT";
  return "GUNCEL";
}

const FILE_MARK = { missing: "eksik", stale: "bayat", edited: "duzenlenmis" };

// Diskteki dosya pakete birebir esit ama manifest'te kaydi yok mu? Bu, manifest
// ozelligi oncesi kurulmus projelerin durumu; icerik esit oldugu icin koken
// KESIN olarak bilinir ve guvenle yazilabilir.
function eksikKokenIzi(plan) {
  const mf = readManifest(plan.dstRoot);
  return plan.skills.some(s => s.files.some(f => f.status === "same" && !mf[f.label]));
}

function printStatus(projectRoot, plan, json) {
  if (json) {
    console.log(JSON.stringify({
      project: projectRoot,
      skills_dir: plan.dstRoot,
      totals: summarize(plan),
      skills: plan.skills.map(s => ({
        name: s.name,
        state: statusLabel(s.files),
        files: s.files.map(f => ({ path: f.rel, status: f.status })),
      })),
    }, null, 2));
    return 0;
  }

  console.log(`[serif-brain skills]`);
  console.log(`  Project:    ${projectRoot}`);
  console.log(`  Skills dir: ${plan.dstRoot}`);
  console.log(``);
  for (const skill of plan.skills) {
    const state = statusLabel(skill.files);
    console.log(`  ${state.padEnd(16)} ${skill.name}`);
    for (const file of skill.files) {
      if (file.status === "same") continue;
      console.log(`      ${(FILE_MARK[file.status] || file.status).padEnd(12)} ${file.rel}`);
    }
  }
  const t = summarize(plan);
  console.log(``);
  console.log(`  Dosya: ${t.same} guncel, ${t.stale} bayat, ${t.edited} yerel duzenleme, ${t.missing} eksik`);
  if (!plan.has_manifest && (t.stale || t.edited)) {
    console.log(`  NOT: kurulum manifesti yok — kokeni bilinmeyen farklar YEREL DUZENLEME sayildi (emek korunur).`);
  }
  if (t.missing || t.stale) {
    console.log(`  Guncellemek icin: serif-brain skills update --apply`);
  }
  if (t.edited) {
    console.log(`  Yerel duzenlemeleri paket surumuyle EZMEK icin: serif-brain skills update --apply --force`);
  }
  return 0;
}

function runUpdate(projectRoot, plan, flags) {
  const apply = flags.apply === true;
  const force = flags.force === true;
  const t = summarize(plan);

  console.log(`[serif-brain skills update]${apply ? "" : " (DRY-RUN — yazmak icin --apply)"}${force ? " --force" : ""}`);
  console.log(`  Project:    ${projectRoot}`);
  console.log(`  Skills dir: ${plan.dstRoot}`);
  console.log(``);

  const yapilacak = t.missing + t.stale + (force ? t.edited : 0);
  if (!yapilacak) {
    console.log(`  Yapilacak is yok. (${t.same} guncel${t.edited ? `, ${t.edited} yerel duzenleme korunuyor` : ""})`);
    // Dosya yazilacak is olmasa bile KOKEN IZI eksik olabilir: pakete birebir
    // esit ama manifestsiz kurulumlar (manifest ozelligi oncesi kurulanlar) tam
    // burada kalir. Erken donulseydi onarim hic calismazdi — yani ozellik en cok
    // ihtiyac duyan projede devreye girmezdi.
    if (apply && eksikKokenIzi(plan)) {
      applySkillSync(plan, { mode: "sync", apply, force, log: () => {} });
      console.log(`  ↻ Koken izi yazildi (${plan.dstRoot}/${MANIFEST_NAME}) — bundan sonra bayat/yerel-duzenleme ayrimi yapilabilir.`);
    }
    if (t.edited) console.log(`  Yerel duzenlemeleri EZMEK icin: --force ekle.`);
    return 0;
  }

  const counts = applySkillSync(plan, { mode: "sync", apply, force, log: msg => console.log(msg) });

  console.log(``);
  const fiil = apply
    ? `${counts.created} kuruldu, ${counts.updated} guncellendi`
    : `${counts.created} kurulacak, ${counts.updated} guncellenecek`;
  console.log(`  ${fiil}, ${counts.unchanged} zaten guncel.`);
  if (counts.kept) {
    console.log(`  ⊘ ${counts.kept} dosya YEREL DUZENLEME oldugu icin ${apply ? "korundu" : "korunacak"} — --force ile ezilir.`);
  }
  if (counts.overwritten) {
    console.log(`  ! ${counts.overwritten} yerel duzenleme ${apply ? "EZILDI" : "EZILECEK"}.`);
  }
  if (!apply) console.log(`  Uygulamak icin: serif-brain skills update --apply${force ? " --force" : ""}`);
  return 0;
}

export async function skillsCommand({ args, subcommand }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const sub = (subcommand && subcommand[0]) || "status";

  if (listPackageSkills().length === 0) {
    console.error(`[serif-brain skills] Pakette skill bulunamadi (skill/ dizini bos veya yok).`);
    return 1;
  }

  if (sub === "list") {
    const names = listPackageSkills();
    if (args.flags.json) console.log(JSON.stringify({ skills: names }, null, 2));
    else {
      console.log(`Paketle gelen skill'ler (${names.length}):`);
      for (const n of names) console.log(`  ${n}`);
    }
    return 0;
  }

  const plan = planSkillSync(projectRoot);

  if (sub === "status") return printStatus(projectRoot, plan, args.flags.json === true);
  if (sub === "update") return runUpdate(projectRoot, plan, args.flags);

  console.error(`[serif-brain skills] bilinmeyen alt komut: ${sub}`);
  console.error(`Kullanim: serif-brain skills [status|list|update] [--apply] [--force] [--json]`);
  return 1;
}
