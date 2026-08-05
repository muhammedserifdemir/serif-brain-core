// Liste ogesi olarak satir-ici (flow) nesne: "- { from: ui, to: db }"
//
// Bu bicimi ARACIN KENDISI oneriyor (init'in urettigi config.yaml ornegi,
// layers komutunun hata mesaji, docs/USAGE.md). Ayristirilamadiginda kural
// SESSIZCE olur: layer_rules/bug_signatures dolu gorunur ama .from/.pattern
// undefined'dir, kapilar "kural yok" diye yesil yanar. En pahali hata sinifi:
// kullanici kapinin denetledigini sanip commit eder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseYaml, serializeYaml } from "../src/markdown/yaml.mjs";
import { loadConfig } from "../src/markdown/schema.mjs";

test("parseYaml — liste ogesindeki satir-ici nesne gercek nesne olur", () => {
  const y = `layer_rules:
  - { from: ui, to: db, reason: "UI veriye dokunmasin" }
`;
  const got = parseYaml(y);
  assert.deepEqual(got.layer_rules, [{ from: "ui", to: "db", reason: "UI veriye dokunmasin" }]);
  // Asil regresyon: anahtar "{ from" DEGIL "from" olmali
  assert.equal(got.layer_rules[0].from, "ui", "'from' okunamiyorsa kural olu demektir");
});

test("parseYaml — coklu alan + tirnakli deger + sayi/bool korunur", () => {
  const y = `bug_signatures:
  - { name: rls-eksik, pattern: "create table", severity: high, esik: 3, aktif: true }
`;
  const [sig] = parseYaml(y).bug_signatures;
  assert.equal(sig.name, "rls-eksik");
  assert.equal(sig.pattern, "create table");
  assert.equal(sig.esik, 3);
  assert.equal(sig.aktif, true);
});

test("parseYaml — satir-ici deger icindeki virgul/kolon oge sinirini bozmaz", () => {
  const y = `kural:
  - { mesaj: "a, b: c", ad: x }
  - { mesaj: "ikinci", ad: y }
`;
  const got = parseYaml(y).kural;
  assert.equal(got.length, 2, "tirnak icindeki virgul yeni oge saymamali");
  assert.equal(got[0].mesaj, "a, b: c");
  assert.equal(got[1].ad, "y");
});

test("parseYaml — blok bicimi ve duz deger BOZULMADI (regresyon koruması)", () => {
  const y = `karisik:
  - { a: 1 }
  - b: 2
    c: 3
  - duz-deger
`;
  assert.deepEqual(parseYaml(y).karisik, [{ a: 1 }, { b: 2, c: 3 }, "duz-deger"]);
});

test("parseYaml — kapanmamis satir-ici nesne SESSIZ KALMAZ, hata firlatir", () => {
  const y = `layer_rules:
  - { from: ui, to: db
`;
  assert.throws(() => parseYaml(y), /kapanmamis satir-ici/,
    "okunamayan kural string'e dusurulup sessizce yutulmamali");
});

test("loadConfig — init'in ONERDIGI ornek satir gercekten yuklenir", () => {
  const tmp = mkdtempSync(join(tmpdir(), "sb-yamlcfg-"));
  try {
    mkdirSync(join(tmp, ".serif-brain"), { recursive: true });
    // init.mjs'in config.yaml'a yazdigi ornegin birebir (yorumsuz) hali
    writeFileSync(join(tmp, ".serif-brain", "config.yaml"),
      `layer_rules:
  - { from: ui, to: db, reason: "UI veriye dogrudan dokunmasin, servis katmani kullan" }
bug_signatures:
  - { name: rls-eksik, pattern: "create table", message: "Yeni tabloda RLS?", severity: high }
`);
    const cfg = loadConfig(join(tmp, ".serif-brain"));
    assert.equal(cfg.layer_rules[0].from, "ui");
    assert.equal(cfg.layer_rules[0].to, "db");
    assert.equal(cfg.bug_signatures[0].pattern, "create table");
    assert.equal(cfg.bug_signatures[0].severity, "high");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("round-trip — serialize edilen liste geri parse edilince ayni kalir", () => {
  const data = { layer_rules: [{ from: "ui", to: "db", reason: "x, y: z" }] };
  assert.deepEqual(parseYaml(serializeYaml(data)), data);
});
