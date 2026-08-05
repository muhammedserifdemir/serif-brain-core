// serif-brain skills — paketle gelen Claude skill'lerini projeye tasi/guncelle.
// Alt komutlar: status (varsayilan) | list | update
//
// init var olan skill dosyasini ASLA ezmez (yerel duzenleme korunur). Bunun yan
// etkisi: paketteki skill guncellenince, o skill'i zaten olan projeye yeni surum
// gitmez. Bu komut o bosllugu kapatir. prune/capture ile ayni sozlesme:
// DRY-RUN VARSAYILAN, yazmak icin --apply.
import { resolve } from "node:path";
import { planSkillSync, applySkillSync, listPackageSkills } from "../skills/sync.mjs";

function summarize(plan) {
  const totals = { missing: 0, differs: 0, same: 0 };
  for (const skill of plan.skills) {
    for (const file of skill.files) totals[file.status]++;
  }
  return totals;
}

function statusLabel(files) {
  if (files.some(f => f.status === "missing")) {
    return files.every(f => f.status === "missing") ? "EKSIK" : "KISMEN EKSIK";
  }
  if (files.some(f => f.status === "differs")) return "BAYAT/FARKLI";
  return "GUNCEL";
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
    console.log(`  ${state.padEnd(13)} ${skill.name}`);
    for (const file of skill.files) {
      if (file.status === "same") continue;
      const mark = file.status === "missing" ? "eksik" : "farkli";
      console.log(`      ${mark.padEnd(7)} ${file.rel}`);
    }
  }
  const t = summarize(plan);
  console.log(``);
  console.log(`  Dosya: ${t.same} guncel, ${t.differs} farkli, ${t.missing} eksik`);
  if (t.missing || t.differs) {
    console.log(`  Guncellemek icin: serif-brain skills update --apply`);
  }
  return 0;
}

function runUpdate(projectRoot, plan, flags) {
  const apply = flags.apply === true;
  const t = summarize(plan);

  console.log(`[serif-brain skills update]${apply ? "" : " (DRY-RUN — yazmak icin --apply)"}`);
  console.log(`  Project:    ${projectRoot}`);
  console.log(`  Skills dir: ${plan.dstRoot}`);
  console.log(``);

  if (!t.missing && !t.differs) {
    console.log(`  Tum skill'ler zaten guncel (${t.same} dosya). Yapilacak is yok.`);
    return 0;
  }

  // --differs-only degil: eksik olanlar da kurulur; amac projeyi paketle esitlemek.
  const counts = applySkillSync(plan, { mode: "sync", apply, log: msg => console.log(msg) });

  console.log(``);
  if (apply) {
    console.log(`  ${counts.created} kuruldu, ${counts.updated} guncellendi, ${counts.unchanged} zaten guncel.`);
  } else {
    console.log(`  ${counts.created} kurulacak, ${counts.updated} guncellenecek, ${counts.unchanged} dokunulmayacak.`);
    console.log(`  DIKKAT: 'updated' satirlari yerel duzenlemeyi EZER — once 'skills status' ile bak.`);
    console.log(`  Uygulamak icin: serif-brain skills update --apply`);
  }
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
  console.error(`Kullanim: serif-brain skills [status|list|update] [--apply] [--json]`);
  return 1;
}
