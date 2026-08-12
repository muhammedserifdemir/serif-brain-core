// serif-brain guard <dosya> [--days N] [--json]
// Edit-oncesi BIRLESIK brifing: touch + impact + risk + lint tek cikti.
import { resolve, join, relative, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { gatherGuard, formatGuard } from "../query/guard.mjs";
import { posixYol } from "../util/yol.mjs";

export async function guardCommand({ args, subcommand }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);

  const target = subcommand[0] || (typeof args.flags.file === "string" ? args.flags.file : null);
  if (!target) {
    console.error(`[serif-brain guard] kullanim: serif-brain guard <dosya> [--days N] [--json]`);
    return 1;
  }
  const abs = isAbsolute(target) ? target : resolve(projectRoot, target);
  const relPath = posixYol(relative(projectRoot, abs)) || target;
  const days = parseInt(args.flags.days, 10) || 30;

  const g = gatherGuard({ projectRoot, brainRoot, relPath, days });

  if (args.flags.json) { console.log(JSON.stringify(g, null, 2)); return 0; }
  console.log(formatGuard(g));
  return 0;
}
