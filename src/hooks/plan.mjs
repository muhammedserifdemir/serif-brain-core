// Hook migration planner — settings.json'i SADECE OKUR.
// Mevcut hooklari analiz eder, yeni hook'lari onerir, diff + backup + rollback uretir.
// Hicbir dosya yazilmaz, hicbir dosya degistirilmez.

import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const SBC_BIN = "/Users/muhammedserifdemir/Desktop/seriftech-packages/serif-brain-core/bin/serif-brain.mjs";

const LEGACY_PATTERNS = {
  sherif_brain_skill: /sherif-brain-claude\/scripts\/load-context\.mjs/,
  generate_claude_md: /generate-claude-md\.sh/,
  graphify_check: /graphify-out\/graph\.json/,
  claude_brain_hooks: /claude-brain\/hooks/
};

export function buildPlan({ projectRoot }) {
  const settingsPath = join(projectRoot, ".claude", "settings.json");
  const backupPath = join(projectRoot, ".claude", "settings.json.pre-serif-brain-core");

  if (!existsSync(settingsPath)) {
    return {
      error: `settings.json not found at ${settingsPath}`,
      settings_path: settingsPath
    };
  }

  const rawText = readFileSync(settingsPath, "utf8");
  let settings;
  try {
    settings = JSON.parse(rawText);
  } catch (e) {
    return { error: `Failed to parse settings.json: ${e.message}`, settings_path: settingsPath };
  }

  // ─── Mevcut hooklari analiz et ───
  const currentHooks = extractHooks(settings);
  const legacyMatches = [];
  for (const h of currentHooks) {
    const matchedKeys = [];
    for (const [key, re] of Object.entries(LEGACY_PATTERNS)) {
      if (re.test(h.command)) matchedKeys.push(key);
    }
    if (matchedKeys.length > 0) {
      legacyMatches.push({ ...h, legacy_kinds: matchedKeys });
    }
  }

  // ─── Onerilen yeni settings.json icerigi ───
  const proposedSettings = buildProposedSettings(settings);
  const proposedText = JSON.stringify(proposedSettings, null, 2);

  // ─── Diff (basit line-by-line) ───
  const diff = computeDiff(rawText, proposedText);

  // ─── Skill durumu (tavsiye) ───
  const oldSkillPath = "/Users/muhammedserifdemir/.claude/skills/sherif-brain-claude";
  const oldSkillExists = existsSync(oldSkillPath);
  const newSkillPath = "/Users/muhammedserifdemir/.claude/skills/serif-brain-core";
  const newSkillExists = existsSync(join(newSkillPath, "SKILL.md"));

  // ─── Risk tespiti ───
  const risks = [];

  if (!newSkillExists) {
    risks.push({
      severity: "blocker",
      label: "Yeni skill yok",
      detail: `${newSkillPath}/SKILL.md mevcut degil — apply oncesi Faz 7 tamamlanmali.`
    });
  }

  // serif-brain CLI calisir mi?
  if (!existsSync(SBC_BIN)) {
    risks.push({
      severity: "blocker",
      label: "serif-brain CLI binary bulunamadi",
      detail: `${SBC_BIN} mevcut degil — Faz 2 tamamlanmali.`
    });
  }

  // .serif-brain initialized mi?
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    risks.push({
      severity: "blocker",
      label: ".serif-brain/ yok",
      detail: `${brainRoot} mevcut degil — 'serif-brain init' calistirilmali.`
    });
  }

  // Migration apply yapildi mi? (Faz 5 apply pending)
  const drPath = join(brainRoot, "archive-index", "migration-dry-run.json");
  if (existsSync(drPath)) {
    risks.push({
      severity: "info",
      label: "Migration apply henuz yapilmadi",
      detail: `Hook apply'dan sonra session basinda 'serif-brain context' canonical store'u okuyacak. Su an canonical'da sadece elle eklenmis 4 obje var (210 dry-run candidate canonical'a girmedi). Yeni hook bu durumda da temiz calisir, ama context o ana kadar dar olur. Migration apply oncesi hook apply yapilabilir; sonrasinda context daha zenginlesir.`
    });
  }

  // Eski hook bagimliligi
  if (legacyMatches.length === 0) {
    risks.push({
      severity: "info",
      label: "Mevcut settings.json'da legacy hook bulunamadi",
      detail: "Belki manuel temizlenmis. Apply gereksiz olabilir."
    });
  }

  // Backup yazilabilir mi?
  if (existsSync(backupPath)) {
    risks.push({
      severity: "warning",
      label: "Backup zaten var",
      detail: `${backupPath} mevcut. Apply tekrar yazarsa eskini silmis olur. Onerilen: timestamped backup ekle.`
    });
  }

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    project_root: projectRoot,
    settings_path: settingsPath,
    settings_size: statSync(settingsPath).size,
    backup_path: backupPath,
    current_hooks: currentHooks,
    legacy_matches: legacyMatches,
    proposed_hooks: extractHooks(proposedSettings),
    proposed_settings_text: proposedText,
    current_settings_text: rawText,
    diff,
    skills: {
      old_path: oldSkillPath,
      old_exists: oldSkillExists,
      new_path: newSkillPath,
      new_exists: newSkillExists
    },
    risks,
    rollback: {
      command: `cp "${backupPath}" "${settingsPath}"`,
      description: "Backup'i geri kopyala. Eski hooklar 1 saniyede geri gelir."
    }
  };
}

function extractHooks(settings) {
  const out = [];
  const hooks = settings?.hooks || {};
  for (const [eventType, list] of Object.entries(hooks)) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const matcher = entry.matcher || "";
      for (const h of (entry.hooks || [])) {
        out.push({
          event: eventType,
          matcher,
          type: h.type || "unknown",
          command: h.command || ""
        });
      }
    }
  }
  return out;
}

function buildProposedSettings(currentSettings) {
  // Deep-clone mevcut ayarlari, sonra hook bolumunu degistir.
  const clone = JSON.parse(JSON.stringify(currentSettings));

  clone.hooks = {
    SessionStart: [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: `cd "$CLAUDE_PROJECT_DIR" && node "${SBC_BIN}" context --project "$CLAUDE_PROJECT_DIR" 2>&1 || true`
          }
        ]
      }
    ]
  };

  return clone;
}

// Cok basit line-based diff (no extra dep). Sadece okunabilirlik icin.
function computeDiff(oldText, newText) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const out = [];
  // Cok basit LCS yerine line-by-line karsilaştırma
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const a = oldLines[i];
    const b = newLines[i];
    if (a === b) continue;
    if (a !== undefined) out.push({ type: "remove", line: i + 1, text: a });
    if (b !== undefined) out.push({ type: "add", line: i + 1, text: b });
  }
  return out;
}
