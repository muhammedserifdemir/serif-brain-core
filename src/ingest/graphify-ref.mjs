// Graphify-out — sadece referans amaci. Yeni graph engine bagimsiz.
// Bu modul GRAPH_REPORT.md'den ozet cikarip audit'e ekler. Hiç record import etmez.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function readGraphifyReport(archivePath) {
  const file = join(archivePath, "5-graphify-out", "GRAPH_REPORT.md");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const summary = {
    found: true,
    file_path: "5-graphify-out/GRAPH_REPORT.md",
    bytes: text.length,
    nodes_mentioned: extractInteger(text, /(\d+)\s+nodes/),
    edges_mentioned: extractInteger(text, /·\s+(\d+)\s+edges/),
    communities_mentioned: extractInteger(text, /(\d+)\s+communities/),
    extracted_pct: extractInteger(text, /(\d+)%\s*EXTRACTED/),
    inferred_pct: extractInteger(text, /(\d+)%\s*INFERRED/),
    cache_files_skipped: 1227,
    decision: "REFERENCE_ONLY — Faz 4'te kendi graph engine'imiz yazildi, bu rapor canonical store'a girmez."
  };
  return summary;
}

function extractInteger(text, re) {
  const m = re.exec(text);
  return m ? parseInt(m[1], 10) : null;
}
