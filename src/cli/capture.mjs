// serif-brain capture [--days N] [--apply] [--json] [--project_id X]
// Git commit'lerinden aday bug/karar onerir. Default DRY-RUN (yazmaz); --apply yazar.
// Auto-capture (write-back): `add`'i unutma sorununu cozer, hafiza kendiliginden dolar.
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { listAllObjects, listProjects, writeObject, makeId } from "../markdown/object.mjs";
import { ownerOfConfigured } from "../scanner/module-owner.mjs";
import { getRecentCommits } from "../query/git-activity.mjs";
import { proposeFromCommits, dominantModule } from "../query/capture.mjs";

// Daha once capture edilmis commit hash'lerini topla (source.kind === git).
function collectCapturedHashes(brainRoot) {
  const set = new Set();
  for (const project of listProjects(brainRoot)) {
    for (const o of listAllObjects(brainRoot, project)) {
      const src = o.frontmatter?.source;
      if (src && src.kind === "git" && src.path) {
        set.add(src.path);
        set.add(String(src.path).slice(0, 7));
      }
    }
  }
  return set;
}

export async function captureCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);
  const config = loadConfig(brainRoot);

  const days = parseInt(args.flags.days, 10) || 7;
  const apply = !!args.flags.apply;

  const configProjects = config?.projects || [];
  const project =
    (typeof args.flags.project_id === "string" && args.flags.project_id) ||
    configProjects.find((p) => p.active)?.id ||
    configProjects[0]?.id;

  const commits = getRecentCommits(projectRoot, days);
  const existingHashes = collectCapturedHashes(brainRoot);
  const ownerFor = (files) => dominantModule(files, (f) => ownerOfConfigured(f, config));
  const proposals = proposeFromCommits(commits, {
    existingHashes,
    ownerFor,
    limit: args.flags.limit ? parseInt(args.flags.limit, 10) : 20,
  });

  if (args.flags.json) {
    console.log(JSON.stringify({ scanned: commits.length, project, apply, proposals }, null, 2));
    if (apply) applyAll(brainRoot, project, proposals);
    return 0;
  }

  console.log(`[serif-brain capture] ${commits.length} commit tarandi (son ${days} gun) → ${proposals.length} aday`);
  if (!proposals.length) {
    console.log(`  (yeni yakalanacak commit yok — hepsi zaten kayitli ya da hafiza-degeri yok)`);
    return 0;
  }
  for (const p of proposals) {
    console.log(`\n  ${p.type.toUpperCase()} [${p.status}] ${p.module}`);
    console.log(`    ${p.title}`);
    console.log(`    ${p.evidence}`);
  }
  console.log(``);
  if (apply) {
    const written = applyAll(brainRoot, project, proposals);
    console.log(`  ✓ ${written} obje yazildi (proje: ${project}). Sonraki: serif-brain rebuild-indexes`);
  } else {
    console.log(`  DRY-RUN — yazilmadi. Yazmak icin: serif-brain capture --days ${days} --apply`);
  }
  return 0;
}

function applyAll(brainRoot, project, proposals) {
  let written = 0;
  for (const p of proposals) {
    const id = makeId(p.type, p.title);
    const module = p.module || "unknown";
    const now = new Date().toISOString();
    const fm = {
      id, type: p.type, project, module,
      title: p.title, status: p.status, priority: p.priority,
      ...(p.type === "bug" ? { severity: p.severity || p.priority, owner: "" } : {}),
      created_at: now, updated_at: now,
      source: { kind: "git", path: p.hash },
      relations: { files: [], decisions: [], bugs: [], modules: [module] },
      tags: ["auto-capture"],
      ...(p.type === "bug" ? { summary: p.title } : {}),
    };
    const body = `\n# ${p.title}\n\n## Kaynak\n${p.evidence}\n\n> Auto-capture ile git commit'inden olusturuldu. Gerektiginde golendir.\n`;
    try {
      writeObject(brainRoot, fm, body);
      written++;
    } catch (e) {
      console.error(`    ⚠ yazilamadi (${id}): ${e.message}`);
    }
  }
  return written;
}
