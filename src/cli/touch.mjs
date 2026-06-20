// serif-brain touch <dosya> [--module X] [--json]
// "Bu dosyaya dokunmadan once ne bilmeliyim?" — PreToolUse(Edit) hook'u bunu cagirir.
import { resolve, join, relative, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { loadObjects } from "../query/search.mjs";
import { compileTouch, formatTouch } from "../query/touch.mjs";
import { ownerOfConfigured } from "../scanner/module-owner.mjs";

export async function touchCommand({ args, subcommand }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    if (args.flags.json) console.log(JSON.stringify({ brain: false }));
    return 0; // hook-dostu: sessiz cik
  }
  const config = loadConfig(brainRoot);

  const target = subcommand[0] || (typeof args.flags.file === "string" ? args.flags.file : null);
  if (!target) {
    console.error(`[serif-brain touch] kullanim: serif-brain touch <dosya-yolu> [--module X] [--json]`);
    return 1;
  }

  // Hedef yolu projeye-gore normalize et (Edit hook mutlak yol verir).
  const abs = isAbsolute(target) ? target : resolve(projectRoot, target);
  const relPath = relative(projectRoot, abs) || target;

  // Modul: acik flag > config-farkinda path cozumu.
  const module =
    (typeof args.flags.module === "string" && args.flags.module) ||
    ownerOfConfigured(relPath, config);

  const objects = loadObjects(brainRoot, {
    project: typeof args.flags.project_id === "string" ? args.flags.project_id : undefined,
  });
  const t = compileTouch(objects, { relPath, module, limit: args.flags.limit ? parseInt(args.flags.limit, 10) : 6 });

  if (args.flags.json) {
    console.log(JSON.stringify(t, null, 2));
    return 0;
  }
  console.log(formatTouch(t));
  return 0;
}
