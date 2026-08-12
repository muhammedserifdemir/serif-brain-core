// serif-brain impact <dosya> [--json]
// Canli blast-radius: bu dosyayi degistirirsem kac dosya/modul etkilenir + ilgili hafiza.
import { resolve, join, relative, isAbsolute } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { loadObjects } from "../query/search.mjs";
import { compileTouch } from "../query/touch.mjs";
import { computeImpact, formatImpact, resolveFileNode } from "../query/impact.mjs";
import { resolveModule } from "../scanner/module-owner.mjs";
import { posixYol } from "../util/yol.mjs";

export async function impactCommand({ args, subcommand }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);

  const graphPath = join(brainRoot, "graph", "graph.json");
  if (!existsSync(graphPath)) {
    console.error(`[serif-brain impact] graph.json yok — once: serif-brain graph build`);
    return 1;
  }
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));

  const target = subcommand[0] || (typeof args.flags.file === "string" ? args.flags.file : null);
  if (!target) {
    console.error(`[serif-brain impact] kullanim: serif-brain impact <dosya-yolu> [--json]`);
    return 1;
  }
  const abs = isAbsolute(target) ? target : resolve(projectRoot, target);
  const relPath = posixYol(relative(projectRoot, abs)) || target;

  const node = resolveFileNode(graph, relPath);
  if (!node) {
    console.error(`[serif-brain impact] '${relPath}' grafta yok. Yol projeye-goreli mi? (serif-brain graph build guncel mi?)`);
    return 1;
  }

  // Modul hafizasini capraz-referansla (touch cekirdegini yeniden kullan).
  const config = loadConfig(brainRoot);
  const module = resolveModule(node.module, relPath, config);
  // computeImpact grafin HAM cevabini verir (query katmani config bilmez); config
  // birlestirmesi burada yapilir, yoksa ekranda/JSON'da "modul:unknown" gorunur.
  const im = { ...computeImpact(graph, node.id), module };
  const objects = loadObjects(brainRoot);
  const memory = compileTouch(objects, { relPath, module });

  if (args.flags.json) {
    console.log(JSON.stringify({ ...im, memory: memory.empty ? null : memory }, null, 2));
    return 0;
  }
  console.log(formatImpact(im, { memory }));
  return 0;
}
