// Faz: Bug Signatures — edit-ani risk skoru + bug clustering.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreRisk, formatRisk } from "../src/query/risk.mjs";
import { clusterBugs, formatClusters } from "../src/query/cluster.mjs";

function bug(id, fm = {}) {
  return { frontmatter: { id, type: "bug", title: id, status: "open", ...fm }, body: fm.body || "" };
}

test("risk: seffaf agirlikli skor + seviye", () => {
  const r = scoreRisk({ churn: 2, dependents: 3, module_open_bugs: 1, file_bug_history: 1, signature_hits: 1 });
  // 2*2 + 1*3 + 3*1 + 4*1 + 5*1 = 4+3+3+4+5 = 19 -> high
  assert.equal(r.score, 19);
  assert.equal(r.level, "high");
  assert.equal(r.factors.signature_hits, 5);
});

test("risk: sifir sinyal -> low", () => {
  const r = scoreRisk({});
  assert.equal(r.score, 0);
  assert.equal(r.level, "low");
  assert.match(formatRisk(r, { file: "x.ts" }), /LOW/);
});

test("risk: dosya-gecmis-bug en agir tekil katki (×4) + critical esigi", () => {
  const r = scoreRisk({ file_bug_history: 8 }); // 32 -> critical
  assert.equal(r.level, "critical");
  assert.match(formatRisk(r, { file: "x.ts" }), /Dikkatli/);
});

test("cluster: paylasilan modul+metin ayni gruba koyar", () => {
  const bugs = [
    bug("b1", { module: "auth", body: "login token refresh fails on expiry" }),
    bug("b2", { module: "auth", body: "token refresh expiry login broken again" }),
    bug("b3", { module: "billing", body: "invoice pdf generation error" }),
  ];
  const clusters = clusterBugs(bugs, { threshold: 3 });
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].size, 2);
  const ids = clusters[0].members.map((m) => m.id).sort();
  assert.deepEqual(ids, ["b1", "b2"]);
});

test("cluster: benzemeyen bug'lar gruplanmaz", () => {
  const bugs = [
    bug("x", { module: "a", body: "completely unrelated alpha" }),
    bug("y", { module: "b", body: "totally different beta words" }),
  ];
  assert.deepEqual(clusterBugs(bugs, { threshold: 5 }), []);
  assert.match(formatClusters([]), /tekil/);
});

test("cluster: tek bug -> bos (clustering icin >=2 lazim)", () => {
  assert.deepEqual(clusterBugs([bug("solo")], {}), []);
});
