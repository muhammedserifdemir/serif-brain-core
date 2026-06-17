// Faz 1 regresyon testleri — tsconfig glob/alias çözümleme + YAML inline-object.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTsconfigPaths, resolveImport } from "../src/scanner/resolve-import.mjs";
import { parseYaml } from "../src/markdown/yaml.mjs";

test("loadTsconfigPaths: '@/*' + '**/*.ts' glob bir arada paths'i silmemeli", () => {
  // Eski naive regex yorum-sıyırma, '@/*' ile '**/*.ts' arasını blok-yorum sanıp
  // paths'i siliyordu → tüm alias'lar çözülemiyordu. Bu test o regresyonu yakalar.
  const dir = mkdtempSync(join(tmpdir(), "sbc-tsc-"));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
    compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } },
    include: ["**/*.ts", ".next/types/**/*.ts"],
  }, null, 2));
  const aliases = loadTsconfigPaths(dir);
  assert.ok(aliases["@/*"], "@/* alias yüklenmeli");
});

test("resolveImport: '@/lib/x' alias dosyaya çözülmeli", () => {
  const dir = mkdtempSync(join(tmpdir(), "sbc-res-"));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
    compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } },
  }));
  mkdirSync(join(dir, "lib"), { recursive: true });
  writeFileSync(join(dir, "lib", "x.ts"), "export const x = 1;\n");
  const aliases = loadTsconfigPaths(dir);
  const r = resolveImport("@/lib/x", join(dir, "app", "page.tsx"), dir, aliases);
  assert.equal(r.kind, "file");
});

test("loadTsconfigPaths: jsconfig.json fallback + yorum/trailing virgül", () => {
  const dir = mkdtempSync(join(tmpdir(), "sbc-jsc-"));
  writeFileSync(join(dir, "jsconfig.json"),
    `{\n  // yorum\n  "compilerOptions": { "paths": { "~/*": ["src/*"], } },\n}\n`);
  const aliases = loadTsconfigPaths(dir);
  assert.deepEqual(aliases["~/*"], ["src/*"]);
});

test("parseYaml: inline object { kind: manual, path: \"\" } parse edilmeli", () => {
  const r = parseYaml(`source: { kind: manual, path: "" }\ntitle: x\n`);
  assert.deepEqual(r.source, { kind: "manual", path: "" });
  assert.equal(r.title, "x");
});

test("parseYaml: boş inline object {} -> {}", () => {
  const r = parseYaml(`meta: {}\n`);
  assert.deepEqual(r.meta, {});
});
