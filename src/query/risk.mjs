// Edit-ani risk skoru — "bu dosyayi degistirmek ne kadar tehlikeli?" — Faz: Bug Signatures.
// hotspot tum repoyu siralar; risk TEK dosyaya derin bakar: yapisal + hafiza + imza
// sinyallerini birlestirip seffaf bir skor + seviye uretir. SAF fonksiyon.
//
// score = 2×churn + dependents              (yapisal: sik degisen + merkezi)
//       + 3×modul_acik_bug + 4×dosya_bug    (hafiza: gecmiste burada bug)
//       + 5×imza_eslesme                    (kod: bilinen kotu desen)

const WEIGHTS = { churn: 2, dependents: 1, module_bug: 3, file_bug: 4, signature: 5 };

function level(score) {
  if (score >= 30) return "critical";
  if (score >= 15) return "high";
  if (score >= 5) return "medium";
  return "low";
}

/**
 * @param f { churn, dependents, module_open_bugs, file_bug_history, signature_hits }
 */
export function scoreRisk(f = {}, weights = WEIGHTS) {
  const w = { ...WEIGHTS, ...weights };
  const churn = f.churn || 0;
  const dependents = f.dependents || 0;
  const moduleBugs = f.module_open_bugs || 0;
  const fileBugs = f.file_bug_history || 0;
  const sigs = f.signature_hits || 0;

  const factors = {
    churn: w.churn * churn,
    dependents: w.dependents * dependents,
    module_open_bugs: w.module_bug * moduleBugs,
    file_bug_history: w.file_bug * fileBugs,
    signature_hits: w.signature * sigs,
  };
  const score = Object.values(factors).reduce((a, b) => a + b, 0);
  return {
    score,
    level: level(score),
    inputs: { churn, dependents, module_open_bugs: moduleBugs, file_bug_history: fileBugs, signature_hits: sigs },
    factors,
  };
}

export function formatRisk(r, { file } = {}) {
  const icon = { critical: "⛔", high: "⚠", medium: "•", low: "✓" }[r.level] || "•";
  const L = [`[serif-brain risk] ${icon} ${file || ""} — risk: ${r.level.toUpperCase()} (skor ${r.score})`];
  const i = r.inputs;
  L.push(`    churn=${i.churn} bağımlı=${i.dependents} modül-bug=${i.module_open_bugs} dosya-geçmiş-bug=${i.file_bug_history} imza=${i.signature_hits}`);
  if (r.level === "critical" || r.level === "high") {
    L.push(`    → Dikkatli ol: serif-brain touch + impact ile detaya bak.`);
  }
  return L.join("\n");
}
