// "Hangi commit'ler hafizaya gecmemis?" — I/O tarafi (git + objeler).
// Saf siniflandirma query/capture.mjs'te; burasi onu diske baglar.
//
// TEK KAYNAK OLMASININ SEBEBI: ayni hesabi iki tuketici soruyor —
//   · serif-brain capture   (listeler / --apply ile yazar)
//   · serif-brain brief     (oturum acilisinda sayiyi gosterir)
//   · claude-gate stop      (brief/capture'i CLI uzerinden cagirir)
// Ikinci bir kopya yazilsaydi "9 aday" ile "7 aday" ayri yerlerde cikip
// hangisinin dogru oldugu tartisilirdi.
import { listAllObjects, listProjects } from "../markdown/object.mjs";
import { ownerOfConfigured } from "../scanner/module-owner.mjs";
import { getRecentCommits } from "./git-activity.mjs";
import { proposeFromCommits, dominantModule } from "./capture.mjs";

/** Daha once capture edilmis commit hash'leri (source.kind === "git"). */
export function collectCapturedHashes(brainRoot) {
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

/**
 * Son `days` gunun commit'lerinden hafizada karsiligi OLMAYAN adaylar.
 * @returns { scanned, proposals }
 */
export function scanUncaptured({ projectRoot, brainRoot, config, days = 14, limit = 20 }) {
  const commits = getRecentCommits(projectRoot, days);
  const existingHashes = collectCapturedHashes(brainRoot);
  const ownerFor = (files) => dominantModule(files, (f) => ownerOfConfigured(f, config));
  const proposals = proposeFromCommits(commits, { existingHashes, ownerFor, limit });
  return { scanned: commits.length, proposals };
}
