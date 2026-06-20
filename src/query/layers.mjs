// Katman-ihlali kurallari — "ui → db dogrudan import edemez" gibi mimari kisitlar.
// Mevcut import grafini kullanir (sembol-parse gerektirmez). SAF fonksiyon.
// Kurallar config.yaml `layer_rules`'dan gelir: [{ from, to, reason }] — from modulundeki
// bir dosya, to modulundeki bir dosyayi import ederse IHLAL. "*" joker.
const FILE_TYPES = new Set(["file", "route", "component"]);
const strip = (id) => String(id).replace(/^(file|route|component):/, "");

function moduleOf(node) {
  const m = node?.module;
  const arr = Array.isArray(m) ? m : [m];
  return arr.find((x) => x && x !== "unknown") || arr[0] || "unknown";
}

function matchLayer(pattern, mod) {
  return pattern === "*" || pattern === mod;
}

/**
 * @param graph { nodes, edges }
 * @param rules [{ from, to, reason }]
 * @returns ihlal eden import kenarlari
 */
export function findLayerViolations(graph, rules = []) {
  if (!rules || !rules.length) return [];
  const nodeById = new Map((graph.nodes || []).map((n) => [n.id, n]));
  const out = [];
  for (const e of graph.edges || []) {
    if (e.type !== "imports") continue;
    const s = nodeById.get(e.source), t = nodeById.get(e.target);
    if (!s || !t || !FILE_TYPES.has(s.type) || !FILE_TYPES.has(t.type)) continue;
    const sm = moduleOf(s), tm = moduleOf(t);
    for (const r of rules) {
      if (matchLayer(r.from, sm) && matchLayer(r.to, tm)) {
        out.push({
          from_file: strip(e.source),
          to_file: strip(e.target),
          from_module: sm,
          to_module: tm,
          rule: `${r.from} → ${r.to}`,
          reason: r.reason || `${r.from} katmani ${r.to} katmanini import edemez`,
        });
        break; // bir kenar bir kez raporlansin
      }
    }
  }
  return out;
}

export function formatLayers(violations, { ruleCount = 0 } = {}) {
  if (!ruleCount) {
    return `[serif-brain layers] config.yaml'da 'layer_rules' tanimli degil. Ornek:\n  layer_rules:\n    - { from: ui, to: db, reason: "UI veriye dogrudan dokunmasin" }`;
  }
  if (!violations.length) return `[serif-brain layers] ${ruleCount} kural · ✓ ihlal yok.`;
  const L = [`[serif-brain layers] ⚠ ${violations.length} ihlal (${ruleCount} kural)`];
  for (const v of violations) {
    L.push(`  ✗ [${v.rule}] ${v.from_file} → ${v.to_file}`);
    L.push(`      ${v.reason}`);
  }
  return L.join("\n");
}
