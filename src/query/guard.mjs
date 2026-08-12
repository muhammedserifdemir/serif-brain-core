// guard — edit-oncesi BIRLESIK brifing. touch + impact + risk + lint'i TEK cikti'da
// toplar; ajan dort ayri cagri yerine tek cagriyla "bu dosyaya dokunmadan once her sey"i
// gorur (token-ucuz). composeGuard SAF (I/O yok); gatherGuard sinyalleri toplar (disk+git).
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "../markdown/schema.mjs";
import { loadObjects } from "./search.mjs";
import { compileTouch } from "./touch.mjs";
import { computeImpact, resolveFileNode } from "./impact.mjs";
import { lintContent } from "./signatures.mjs";
import { scoreRisk } from "./risk.mjs";
import { ownerOfConfigured } from "../scanner/module-owner.mjs";
import { getRecentCommits } from "./git-activity.mjs";
import { readFileSafe } from "../scanner/scan-files.mjs";

const RISK_ICON = { critical: "⛔", high: "⚠", medium: "•", low: "✓" };

// Bir dosya icin tum sinyalleri topla (CLI + MCP ortak; query katmaninda kalir).
export function gatherGuard({ projectRoot, brainRoot, relPath, days = 30 }) {
  const config = loadConfig(brainRoot);
  const module = ownerOfConfigured(relPath, config);
  const objects = loadObjects(brainRoot);
  const memory = compileTouch(objects, { relPath, module });

  let impact = null, dependents = 0;
  const graphPath = join(brainRoot, "graph", "graph.json");
  if (existsSync(graphPath)) {
    const graph = JSON.parse(readFileSync(graphPath, "utf8"));
    const node = resolveFileNode(graph, relPath);
    if (node) { impact = computeImpact(graph, node.id); dependents = impact.direct_dependents.length; }
  }

  let churn = 0;
  for (const c of getRecentCommits(projectRoot, days)) if ((c.files || []).includes(relPath)) churn++;

  const signatures = lintContent(relPath, readFileSafe(join(projectRoot, relPath)), config?.bug_signatures || []);
  const moduleOpenBugs = memory.module_bugs.filter((b) => !b.closed).length;
  const fileBugHistory = memory.file_hits.filter((h) => h.type === "bug").length;
  const risk = scoreRisk({ churn, dependents, module_open_bugs: moduleOpenBugs, file_bug_history: fileBugHistory, signature_hits: signatures.length });

  return composeGuard({ file: relPath, module, risk, memory, impact, signatures });
}

/**
 * @param parts {
 *   file, module,
 *   risk:   scoreRisk() ciktisi,
 *   memory: compileTouch() ciktisi,
 *   impact: computeImpact() ciktisi | null,
 *   signatures: lintContent() ciktisi (dizi)
 * }
 */
export function composeGuard(parts = {}) {
  const risk = parts.risk || { level: "low", score: 0 };
  const memory = parts.memory || { module_decisions: [], module_bugs: [], file_hits: [] };
  const impact = parts.impact || null;
  const sigs = parts.signatures || [];

  const mustNotViolate = (memory.module_decisions || []).filter(
    (d) => d.status === "active" || d.status === "in_progress",
  );
  const openBugs = (memory.module_bugs || []).filter((b) => !b.closed);
  const scars = (memory.module_bugs || []).filter((b) => b.closed);

  // Verdict: en yuksek sinyal kazanir.
  const flags = [];
  // TAM BU DOSYAYA bagli kayitlar en degerli sinyaldir ve verdict'e GIRMIYORDU:
  // dosyaya bagli bir karar varken cikti "TEMIZ" diyordu. Ayni veriden kapi
  // "🔗 BU DOSYA: decision" derken CLI "TEMIZ" diyordu — iki yuzey iki farkli
  // cevap. (Hesaplanip cikti disinda birakma hatasinin ucuncu tekrari.)
  if (memory.file_hits?.length) flags.push(`${memory.file_hits.length} bu dosyaya bagli kayit`);
  if (risk.level === "critical" || risk.level === "high") flags.push(`risk:${risk.level}`);
  if (mustNotViolate.length) flags.push(`${mustNotViolate.length} aktif karar`);
  if (openBugs.length) flags.push(`${openBugs.length} acik bug`);
  if (sigs.length) flags.push(`${sigs.length} imza`);
  if (impact && impact.transitive_dependent_count >= 10) flags.push(`${impact.transitive_dependent_count} dosya etkilenir`);

  // "TEMIZ" ile "KAYIT YOK" AYRI SEYLERDIR.
  //
  // Olcum (20 gercek brain, degisen 1.677 dosya): kapi dosyalarin %78'inde
  // susuyor ve bunun sebebi risk olmamasi DEGIL, hafiza kapsaminin %5,8
  // olmasi. Ikisini ayni "TEMIZ" etiketiyle raporlamak, kapsam etiketi
  // hatasinin ta kendisi: "sorun bulamadim" ile "sorun aramadim" ayni
  // gorunur ve kullanici olmayan bir guvence alir.
  const hicKayit =
    !(memory.file_hits || []).length && !mustNotViolate.length &&
    !openBugs.length && !scars.length;
  const verdict = flags.length ? "DIKKAT" : hicKayit ? "KAYIT YOK" : "TEMIZ";

  return {
    file: parts.file || null,
    module: parts.module || null,
    verdict,
    // Ayri alan: makine tuketicileri (kapi, MCP) "kapsam disi" ile "temiz"i
    // ayirt edebilsin diye — metne bakmak zorunda kalmasinlar.
    hafiza_var: !hicKayit,
    risk: { level: risk.level, score: risk.score },
    // TAM BU DOSYAYA bagli kayitlar. Modul geneli kararlardan ayri tutulur:
    // per-dosya bir kapida en degerli sinyal budur, modul karari her dosyada
    // ayni ciktigi icin tekrar edip gurultuye donusur. Eskiden hesaplanip
    // cikti disinda birakiliyordu.
    file_hits: memory.file_hits || [],
    must_not_violate: mustNotViolate,
    open_bugs: openBugs,
    scars,
    blast_radius: impact
      ? {
          direct_dependents: impact.direct_dependents?.length ?? 0,
          transitive: impact.transitive_dependent_count ?? 0,
          affected_modules: impact.affected_modules ?? [],
          is_leaf: !!impact.is_leaf,
        }
      : null,
    signature_hits: sigs,
    flags,
  };
}

export function formatGuard(g) {
  const icon = RISK_ICON[g.risk.level] || "•";
  const L = [];
  L.push(`[serif-brain guard] ${g.verdict} — ${g.file || ""}${g.module ? ` (modul:${g.module})` : ""}`);
  L.push(`  ${icon} risk: ${g.risk.level.toUpperCase()} (${g.risk.score})${g.flags.length ? ` · ${g.flags.join(" · ")}` : ""}`);

  // EN DEGERLI SINYAL EN USTTE: tam bu dosyaya bagli kayitlar. Modul geneli
  // kararlar modulun HER dosyasinda ayni cikar; bu ise yalniz burada cikar.
  if (g.file_hits?.length) {
    L.push(`  🔗 TAM BU DOSYAYA bagli (${g.file_hits.length}):`);
    for (const h of g.file_hits) {
      L.push(`     [${h.type || "kayit"}${h.status ? `/${h.status}` : ""}] ${h.id} — ${h.title}`);
    }
  }
  if (g.must_not_violate.length) {
    L.push(`  📌 IHLAL ETME — aktif kararlar:`);
    for (const d of g.must_not_violate) L.push(`     ${d.id} — ${d.title}`);
  }
  if (g.open_bugs.length) {
    L.push(`  ⚠ Acik bug'lar:`);
    for (const b of g.open_bugs) L.push(`     [${b.priority || "?"}] ${b.id} — ${b.title}`);
  }
  if (g.scars.length) {
    L.push(`  🩹 Yara izi (cozulmus, dikkat):`);
    for (const b of g.scars.slice(0, 5)) L.push(`     ${b.id} — ${b.title}`);
  }
  if (g.blast_radius) {
    if (g.blast_radius.is_leaf) L.push(`  🍃 Yaprak dosya — kimse import etmiyor, nispeten guvenli.`);
    else L.push(`  💥 Blast-radius: ${g.blast_radius.transitive} dosya (dogrudan ${g.blast_radius.direct_dependents})${g.blast_radius.affected_modules.length ? ` · modul: ${g.blast_radius.affected_modules.join(",")}` : ""}`);
  }
  if (g.signature_hits.length) {
    L.push(`  🔎 Bug imzalari:`);
    for (const s of g.signature_hits.slice(0, 5)) L.push(`     [${s.severity}] ${s.name} @${s.line}: ${s.message}`);
  }
  if (g.verdict === "TEMIZ") L.push(`  ✓ Bilinen kisit/risk yok — yine de degisikligi test et.`);
  if (g.verdict === "KAYIT YOK") {
    L.push(`  · Bu dosya/modul icin HIC kayit yok — "risk yok" demek DEGIL, "bakilacak hafiza yok" demek.`);
    L.push(`    Ogrendigin seyi birak: serif-brain add bug|decision --title "..." --files ${g.file || "<dosya>"}`);
  }
  return L.join("\n");
}
