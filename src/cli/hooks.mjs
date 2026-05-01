// serif-brain hooks plan | apply
import { resolve, join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } from "node:fs";
import { buildPlan } from "../hooks/plan.mjs";

export async function hooksCommand({ args, subcommand }) {
  const sub = subcommand[0];
  const projectRoot = resolve(args.flags.project || process.cwd());
  const isApply = sub === "apply";

  if (sub !== "plan" && sub !== "apply") {
    console.error(`Kullanim: serif-brain hooks <plan|apply> [--project <yol>]`);
    return 1;
  }

  if (isApply) {
    return await runApply({ projectRoot });
  }

  const plan = buildPlan({ projectRoot });

  if (plan.error) {
    console.error(`[serif-brain hooks plan] HATA: ${plan.error}`);
    if (plan.settings_path) console.error(`  Settings path: ${plan.settings_path}`);
    return 1;
  }

  console.log(`[serif-brain hooks plan]`);
  console.log(`  Project:    ${projectRoot}`);
  console.log(`  Settings:   ${plan.settings_path} (${plan.settings_size} byte)`);
  console.log(`  Backup target: ${plan.backup_path}`);
  console.log(``);

  console.log(`══════════════════════════════════════`);
  console.log(`MEVCUT HOOKS (${plan.current_hooks.length})`);
  console.log(`══════════════════════════════════════`);
  for (const h of plan.current_hooks) {
    console.log(`  ${h.event} (matcher: "${h.matcher}")`);
    console.log(`    type: ${h.type}`);
    console.log(`    command: ${h.command.slice(0, 200)}${h.command.length > 200 ? "..." : ""}`);
    console.log(``);
  }

  console.log(`══════════════════════════════════════`);
  console.log(`LEGACY MATCHES (${plan.legacy_matches.length})`);
  console.log(`══════════════════════════════════════`);
  if (plan.legacy_matches.length === 0) console.log(`  Yok — settings.json muhtemelen elle temizlenmis.`);
  else for (const lm of plan.legacy_matches) {
    console.log(`  ${lm.event} → kinds: [${lm.legacy_kinds.join(", ")}]`);
    console.log(`    command: ${lm.command.slice(0, 150)}...`);
  }
  console.log(``);

  console.log(`══════════════════════════════════════`);
  console.log(`ONERILEN YENI HOOKS (${plan.proposed_hooks.length})`);
  console.log(`══════════════════════════════════════`);
  for (const h of plan.proposed_hooks) {
    console.log(`  ${h.event} (matcher: "${h.matcher}")`);
    console.log(`    type: ${h.type}`);
    console.log(`    command: ${h.command}`);
    console.log(``);
  }

  console.log(`══════════════════════════════════════`);
  console.log(`PLANLI DIFF (${plan.diff.length} satir degisecek)`);
  console.log(`══════════════════════════════════════`);
  for (const d of plan.diff) {
    const sign = d.type === "add" ? "+" : "-";
    console.log(`  ${sign} ${d.text}`);
  }
  console.log(``);

  console.log(`══════════════════════════════════════`);
  console.log(`SKILL DURUMU`);
  console.log(`══════════════════════════════════════`);
  console.log(`  Eski skill (${plan.skills.old_path}): ${plan.skills.old_exists ? "VAR" : "yok"}`);
  console.log(`  Yeni skill (${plan.skills.new_path}): ${plan.skills.new_exists ? "VAR" : "EKSIK"}`);
  console.log(`  Eski skill icin TAVSIYE (apply YAPILMIYOR):`);
  console.log(`    - Silme.`);
  console.log(`    - Onerilen yol: ~/.claude/skills/_archived/sherif-brain-claude.YYYYMMDD/ olarak tasi.`);
  console.log(`    - Bu sadece tavsiye, Faz 8 dry-run hicbir skill'e dokunmuyor.`);
  console.log(``);

  console.log(`══════════════════════════════════════`);
  console.log(`ROLLBACK PLANI`);
  console.log(`══════════════════════════════════════`);
  console.log(`  ${plan.rollback.description}`);
  console.log(`  Command:`);
  console.log(`    ${plan.rollback.command}`);
  console.log(``);

  console.log(`══════════════════════════════════════`);
  console.log(`RISKLER (${plan.risks.length})`);
  console.log(`══════════════════════════════════════`);
  if (plan.risks.length === 0) console.log(`  Yok.`);
  else for (const r of plan.risks) {
    const icon = r.severity === "blocker" ? "🔴" : r.severity === "warning" ? "🟡" : "ℹ️ ";
    console.log(`  ${icon} [${r.severity}] ${r.label}`);
    console.log(`     ${r.detail}`);
    console.log(``);
  }

  // Plani markdown rapor olarak da yaz.
  const reportsDir = join(projectRoot, ".serif-brain", "reports");
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, "hooks-plan.md");
  writeFileSync(reportPath, formatMarkdown(plan));

  console.log(`══════════════════════════════════════`);
  console.log(`RAPOR YAZILDI`);
  console.log(`══════════════════════════════════════`);
  console.log(`  + ${reportPath}`);
  console.log(``);
  console.log(`  HICBIR DOSYA DEGISMEDI. settings.json dokunulmadi.`);
  console.log(`  Apply icin: Faz 8 dry-run onayi sonrasi ayri komut + onay gerekir.`);
  return 0;
}

async function runApply({ projectRoot }) {
  const plan = buildPlan({ projectRoot });
  if (plan.error) {
    console.error(`[serif-brain hooks apply] HATA: ${plan.error}`);
    return 1;
  }

  // Blocker risk var mi?
  const blockers = plan.risks.filter(r => r.severity === "blocker");
  if (blockers.length > 0) {
    console.error(`[serif-brain hooks apply] HATA: ${blockers.length} blocker risk var. Apply iptal.`);
    for (const b of blockers) console.error(`  🔴 ${b.label}: ${b.detail}`);
    return 1;
  }

  console.log(`[serif-brain hooks apply]`);
  console.log(`  Project: ${projectRoot}`);
  console.log(`  Settings: ${plan.settings_path}`);
  console.log(``);

  // 1. Backup
  if (existsSync(plan.backup_path)) {
    // Timestamped fallback so we don't overwrite an existing backup
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const altBackup = `${plan.backup_path}.${ts}`;
    console.log(`  ⚠ Backup zaten var. Timestamped fallback'a yaziliyor:`);
    console.log(`    ${altBackup}`);
    copyFileSync(plan.settings_path, altBackup);
  } else {
    copyFileSync(plan.settings_path, plan.backup_path);
    console.log(`  ✓ Backup yazildi: ${plan.backup_path}`);
  }

  // 2. Write new settings
  writeFileSync(plan.settings_path, plan.proposed_settings_text + "\n");
  console.log(`  ✓ settings.json guncellendi`);
  console.log(``);

  // 3. Diff goster
  console.log(`══════════════════════════════════════`);
  console.log(`UYGULANAN DIFF (${plan.diff.length} satir)`);
  console.log(`══════════════════════════════════════`);
  for (const d of plan.diff) {
    const sign = d.type === "add" ? "+" : "-";
    console.log(`  ${sign} ${d.text}`);
  }
  console.log(``);

  // 4. Verify
  const newContent = readFileSync(plan.settings_path, "utf8");
  const newHasSerifBrain = /serif-brain-core\/bin\/serif-brain\.mjs/.test(newContent);
  const newHasLegacy = /sherif-brain-claude|graphify-out\/graph\.json/.test(newContent);
  console.log(`══════════════════════════════════════`);
  console.log(`DOGRULAMA`);
  console.log(`══════════════════════════════════════`);
  console.log(`  ✓ Backup mevcut: ${existsSync(plan.backup_path) ? "EVET" : "HAYIR"}`);
  console.log(`  ✓ Yeni hook icerigi 'serif-brain' iceriyor: ${newHasSerifBrain ? "EVET" : "HAYIR"}`);
  console.log(`  ${newHasLegacy ? "✗" : "✓"} Eski legacy referanslar temizlendi: ${newHasLegacy ? "HAYIR (hala var!)" : "EVET"}`);
  console.log(``);

  console.log(`══════════════════════════════════════`);
  console.log(`ROLLBACK KOMUTU`);
  console.log(`══════════════════════════════════════`);
  console.log(`  cp "${plan.backup_path}" "${plan.settings_path}"`);
  console.log(``);
  console.log(`Eski sherif-brain-claude skill: dokunulmadi.`);
  console.log(`Eski .claude/brain/, Obsidian-Dev-Vault/, graphify-out/: dokunulmadi.`);
  console.log(``);
  console.log(`Sonraki: serif-brain context && serif-brain doctor`);
  return 0;
}

function formatMarkdown(plan) {
  const lines = [];
  lines.push(`# Hooks Migration Plan (DRY-RUN)`);
  lines.push(``);
  lines.push(`> Auto-generated by \`serif-brain hooks plan\` at ${plan.generated_at}.`);
  lines.push(`> **NO files modified.** This is a simulation only.`);
  lines.push(`> Apply requires explicit Faz 8 user approval after this dry-run is reviewed.`);
  lines.push(``);

  lines.push(`## Settings File`);
  lines.push(``);
  lines.push(`- Path: \`${plan.settings_path}\``);
  lines.push(`- Size: ${plan.settings_size} byte`);
  lines.push(`- Backup target: \`${plan.backup_path}\``);
  lines.push(``);

  lines.push(`## Current Hooks (${plan.current_hooks.length})`);
  lines.push(``);
  for (const h of plan.current_hooks) {
    lines.push(`### ${h.event} — matcher: \`${h.matcher || "(none)"}\``);
    lines.push(`- type: \`${h.type}\``);
    lines.push(`- command:`);
    lines.push(`\`\`\`sh`);
    lines.push(h.command);
    lines.push(`\`\`\``);
  }

  lines.push(``);
  lines.push(`## Legacy Matches (${plan.legacy_matches.length})`);
  lines.push(``);
  if (plan.legacy_matches.length === 0) lines.push(`*Hicbir legacy referans bulunamadi.*`);
  else for (const lm of plan.legacy_matches) {
    lines.push(`- **${lm.event}** — ${lm.legacy_kinds.join(", ")}`);
    lines.push(`  - command: \`${lm.command.slice(0, 200)}\``);
  }

  lines.push(``);
  lines.push(`## Proposed New Hooks`);
  lines.push(``);
  for (const h of plan.proposed_hooks) {
    lines.push(`### ${h.event} — matcher: \`${h.matcher || "(none)"}\``);
    lines.push(`- type: \`${h.type}\``);
    lines.push(`- command:`);
    lines.push(`\`\`\`sh`);
    lines.push(h.command);
    lines.push(`\`\`\``);
  }

  lines.push(``);
  lines.push(`## Diff Summary`);
  lines.push(``);
  lines.push(`Toplam ${plan.diff.length} satir degisecek.`);
  lines.push(``);
  lines.push(`\`\`\`diff`);
  for (const d of plan.diff) {
    lines.push(`${d.type === "add" ? "+" : "-"} ${d.text}`);
  }
  lines.push(`\`\`\``);

  lines.push(``);
  lines.push(`## Skill Status`);
  lines.push(``);
  lines.push(`- Eski skill: \`${plan.skills.old_path}\` — **${plan.skills.old_exists ? "EXISTS (will be left untouched in this plan)" : "missing"}**`);
  lines.push(`- Yeni skill: \`${plan.skills.new_path}\` — **${plan.skills.new_exists ? "EXISTS" : "MISSING — Faz 7 must be complete"}**`);
  lines.push(``);
  lines.push(`### Old Skill Disable Recommendation (advisory only — not applied)`);
  lines.push(``);
  lines.push(`Apply faz'inda **silme**. Onerilen secenekler:`);
  lines.push(``);
  lines.push(`1. **Tasi** (önerilen): \`mv ~/.claude/skills/sherif-brain-claude ~/.claude/skills/_archived/sherif-brain-claude.YYYYMMDD\``);
  lines.push(`2. **Disable**: SKILL.md frontmatter'a \`disabled: true\` ekle (custom — Claude'un destegi varsa)`);
  lines.push(`3. **Bekle**: Hicbir sey yapma — yeni skill ayni trigger'larda matchlerse paralel calisir, yeni description'da "eski sisteme dokunma" yazili.`);
  lines.push(``);
  lines.push(`Bu Faz 8 dry-run hicbir skill'e dokunmuyor. Karar apply faz'inda verilecek.`);

  lines.push(``);
  lines.push(`## Rollback Plan`);
  lines.push(``);
  lines.push(`${plan.rollback.description}`);
  lines.push(``);
  lines.push(`\`\`\`sh`);
  lines.push(plan.rollback.command);
  lines.push(`\`\`\``);

  lines.push(``);
  lines.push(`## Pre-Apply Risks (${plan.risks.length})`);
  lines.push(``);
  for (const r of plan.risks) {
    const icon = r.severity === "blocker" ? "🔴" : r.severity === "warning" ? "🟡" : "ℹ️";
    lines.push(`### ${icon} ${r.severity.toUpperCase()}: ${r.label}`);
    lines.push(``);
    lines.push(r.detail);
    lines.push(``);
  }

  lines.push(``);
  lines.push(`## Apply Procedure (when approved)`);
  lines.push(``);
  lines.push(`1. \`cp .claude/settings.json .claude/settings.json.pre-serif-brain-core\` (backup)`);
  lines.push(`2. \`.claude/settings.json\` icindeki \`hooks\` bolumunu yeni icerikle degistir`);
  lines.push(`3. Test: yeni session ac, SessionStart hook'u 'serif-brain context' calistirmali`);
  lines.push(`4. Eski skill icin yukarida 1/2/3 secenegi uygula`);
  lines.push(`5. \`serif-brain doctor\` calistir, "Legacy Hooks" 0 olmali`);
  lines.push(``);
  lines.push(`Hicbir adim Faz 8 dry-run'da uygulanmiyor.`);

  return lines.join("\n") + "\n";
}
