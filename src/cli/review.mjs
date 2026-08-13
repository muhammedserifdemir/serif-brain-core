// serif-brain review [--ref REF] [--json]
// Pre-commit yapisal kapi: degisen dosyalar uzerinde check (katman/dongu/god) +
// lint (bug imzalari). Faz: Bug Signatures — "commit'ten once neyi bozdum?".
import { resolve, join, relative } from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { getChangedFiles } from "../query/git-activity.mjs";
import { resolveFileNode } from "../query/impact.mjs";
import { checkFile } from "../query/check.mjs";
import { lintContent } from "../query/signatures.mjs";
import { readFileSafe, classifyFile } from "../scanner/scan-files.mjs";

const SRC_RE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/;
const STALE_GRAPH_MIN = 7 * 24 * 60; // 7 gun — bunun otesinde graf "bayat" sayilir
// Tarayicinin (scan-files.mjs) grafa ALMADIGI siniflar. Bunlar icin "grafta yok"
// bir eksiklik degil, tasarim karari — "graph build kos" demek eyleme donusmez.
const GRAPH_EXCLUDED_KINDS = new Set(["test", "type-declaration"]);

export async function reviewCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) throw new Error(`Brain root missing: ${brainRoot} — run 'serif-brain init' first`);

  const config = loadConfig(brainRoot);
  const rules = config?.layer_rules || [];
  const signatures = config?.bug_signatures || [];

  const graphPath = join(brainRoot, "graph", "graph.json");
  const graph = existsSync(graphPath) ? JSON.parse(readFileSync(graphPath, "utf8")) : null;

  const ref = typeof args.flags.ref === "string" ? args.flags.ref : "HEAD";
  const changed = getChangedFiles(projectRoot, ref).filter((f) => SRC_RE.test(f));

  // KAPSAM: yapisal denetim sadece grafta OLAN dosyalar icin calisir. Grafta
  // olmayan (yeni/yeni-adlandirilmis) dosyalar sessizce "temiz" gorunmesin —
  // denetlenemeyen dosya, denetlenip temiz cikan dosya DEGILDIR. Sayilir ve
  // raporlanir; yoksa kapi yanlis guven uretir.
  //
  // AMA "grafta yok" IKI AYRI sey demekti ve kapi ikisini karistiriyordu
  // (2026-08-05'te olculdu):
  //   a) DENETLENEMEDI — grafta OLMASI GEREKEN kaynak dosya orada degil
  //      (yeni eklendi, graf bayat). Gercek sinyal; uyarilmali.
  //   b) KAPSAM DISI — grafa ZATEN girmeyecek dosya. scan-files.mjs
  //      `kind === "test"` ve `type-declaration` olanlari BILEREK almiyor
  //      (olcum: serif-platform grafi 2537 dugum, 0 test dosyasi).
  //      Bunlara "graph build kos" demek eyleme donusmez — graf onlari
  //      hicbir zaman indekslemeyecek.
  // (b)'yi uyari saymak kapinin degerini sifirliyordu: test yazilan HER
  // oturumda ayni satir tekrarlaniyor, okunmaz hale geliyordu (bir oturumda
  // ~40 ayni satir olculdu). Artik ayrilar: (a) uyarir, (b) yalnizca sayilir.
  //
  // Sinifi classifyFile'dan okur — desen kopyalanmaz, tarayici politikasi
  // degisince rapor kendiliginden uyar (ikiz kod yok).
  const uncovered = [];
  const outOfScope = [];

  // Projeye ozgu tarama disi yollar — graph build ile AYNI config anahtari
  // (scan-files.mjs `exclude_paths`). Buradaki dosya da grafa girmez; onun
  // icin "graph build kos" demek yine eyleme donusmez.
  const excludePaths = (config?.scan_exclude_paths || []).filter((p) => typeof p === "string" && p);
  const taramaDisiYol = (rel) =>
    excludePaths.some((p) => { const q = p.replace(/\/$/, ""); return rel === q || rel.startsWith(q + "/"); });

  const report = [];
  for (const rel of changed) {
    const abs = join(projectRoot, rel);
    const issues = [];
    const grafaGirmez = GRAPH_EXCLUDED_KINDS.has(classifyFile(rel)) || taramaDisiYol(rel);

    if (graph) {
      const node = resolveFileNode(graph, rel);
      if (node) {
        const c = checkFile(graph, node.id, { rules, god_threshold: config?.god_threshold, god_file_exempt: config?.god_file_exempt });
        if (!c.ok) for (const i of c.issues) issues.push({ kind: "graph", detail: i });
      } else if (grafaGirmez) {
        outOfScope.push(rel);
      } else {
        uncovered.push(rel);
      }
    } else if (grafaGirmez) {
      outOfScope.push(rel);
    } else {
      uncovered.push(rel);
    }
    const findings = lintContent(rel, readFileSafe(abs), signatures);
    for (const f of findings) issues.push({ kind: "signature", detail: `${f.name} @${f.line}: ${f.message}`, severity: f.severity });

    if (issues.length) report.push({ file: rel, issues });
  }

  const coverage = {
    checked: changed.length - uncovered.length - outOfScope.length,
    uncovered: uncovered.length,
    uncovered_files: uncovered,
    /** Grafa tasarim geregi girmeyen dosyalar (test/type-decl) — uyari DEGIL. */
    out_of_scope: outOfScope.length,
    out_of_scope_files: outOfScope,
    graph_missing: !graph,
    graph_age_min: graphAgeMin(graphPath),
  };

  if (args.flags.json) {
    console.log(JSON.stringify({ ref, changed: changed.length, flagged: report.length, coverage, report }, null, 2));
    return report.length ? 2 : 0;
  }

  if (!changed.length) { console.log(`[serif-brain review] degisen kaynak dosya yok (ref: ${ref}).`); return 0; }

  if (report.length) {
    console.log(`[serif-brain review] ⚠ ${report.length}/${changed.length} degisen dosyada sorun`);
    for (const r of report) {
      console.log(`\n  ${r.file}`);
      for (const i of r.issues) console.log(`    ✗ [${i.kind}${i.severity ? `:${i.severity}` : ""}] ${i.detail}`);
    }
  } else if (coverage.checked === 0) {
    // Hicbir dosya yapisal denetimden gecmediyse "yapisal sorun yok" DENMEZ —
    // sorun aramamak, sorun bulamamak degildir.
    console.log(`[serif-brain review] ✓ ${changed.length} degisen dosya — imza taramasi temiz (yapisal denetim CALISMADI).`);
  } else {
    console.log(`[serif-brain review] ✓ ${changed.length} degisen dosya — yapisal/imza sorunu yok.`);
  }

  printCoverage(coverage);
  return report.length ? 2 : 0; // CI: non-zero
}

function graphAgeMin(graphPath) {
  try { return Math.round((Date.now() - statSync(graphPath).mtimeMs) / 60000); } catch { return null; }
}

// Kapsam etiketi: iddianin NE KADARINI kapsadigini soyler. "sorun yok" ile
// "sorun aramadim" ayri seylerdir; kullanici karari buna gore verir.
function printCoverage(cov) {
  if (cov.graph_missing) {
    console.log(`  ⚠ KAPSAM: graph.json yok — YAPISAL denetim hic calismadi (sadece imza taramasi).`);
    console.log(`    Duzelt: serif-brain graph build`);
    return;
  }
  if (cov.uncovered) {
    console.log(`  ⚠ KAPSAM: ${cov.checked}/${cov.checked + cov.uncovered} dosya yapisal denetimden gecti.`);
    console.log(`    ${cov.uncovered} dosya grafta YOK — bu dosyalar icin katman/dongu/god sonucu YOK:`);
    for (const f of cov.uncovered_files) console.log(`      · ${f}`);
    console.log(`    Duzelt: serif-brain graph build`);
  }
  // Kapsam disi dosyalar UYARI degil — bilgi. Graf onlari hicbir zaman
  // indekslemeyecegi icin "duzelt" onerisi de yok.
  if (cov.out_of_scope) {
    console.log(`  · ${cov.out_of_scope} dosya yapisal denetim KAPSAMI DISINDA (test / tip bildirimi / scan_exclude_paths) — grafa tasarim geregi girmez.`);
  }
  if (cov.graph_age_min != null && cov.graph_age_min > STALE_GRAPH_MIN) {
    const days = Math.round(cov.graph_age_min / 1440);
    console.log(`  ⚠ KAPSAM: graf ${days} gun eski — yapisal sonuc bayat anlik goruntuye ait.`);
    console.log(`    Duzelt: serif-brain graph build`);
  }
}
