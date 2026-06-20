// serif-brain brief [--module X] [--days N] [--json]
// Oturum-acilisi "neredeyiz" ozeti. SessionStart hook'u bunu cagirir.
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { loadObjects } from "../query/search.mjs";
import { compileBrief, formatBrief } from "../query/brief.mjs";
import { gitActivity } from "../query/git-activity.mjs";

export async function briefCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    // Hook-dostu: brain yoksa sessiz cik (oturumu bozma).
    if (args.flags.json) console.log(JSON.stringify({ brain: false }));
    return 0;
  }
  const config = loadConfig(brainRoot);

  const module = typeof args.flags.module === "string" ? args.flags.module : null;
  if (module && config?.valid_modules && !config.valid_modules.includes(module)) {
    console.error(`[serif-brain brief] HATA: bilinmeyen module: ${module}`);
    console.error(`  Gecerli moduller: ${config.valid_modules.join(", ")}`);
    return 1;
  }

  const days = parseInt(args.flags.days, 10) || 7;
  const objects = loadObjects(brainRoot, {
    project: typeof args.flags.project_id === "string" ? args.flags.project_id : undefined,
  });
  const git = args.flags["no-git"] ? null : gitActivity(projectRoot, days);
  const brief = compileBrief(objects, { days, module, git });

  if (args.flags.json) {
    console.log(JSON.stringify(brief, null, 2));
    return 0;
  }
  console.log(formatBrief(brief));
  return 0;
}
