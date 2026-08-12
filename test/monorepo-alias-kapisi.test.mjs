// Monorepo takma ad kapısı — AYNI adın uygulamaya göre BAŞKA yeri göstermesi.
//
// Ölçülen kusur (2026-08-12): loadTsconfigPaths yalnız KÖK tsconfig'i okuyordu.
// serif-platform'da kökte `@shared/* -> shared/*`, StudioX'te `@shared/* ->
// apps/serif-studio/src/shared/*`. Kök kazanınca uygulama-içi importlar ya yanlış
// dosyaya bağlanıyor ya da "harici paket" sayılıyordu. Sonuç: impact/blast-radius
// olduğundan KÜÇÜK — bir dosyayı değiştirmenin neyi kıracağı eksik raporlanıyordu.
//
// Ayrıca isAlias() yalnız `@/ ~/ $` önekini biliyordu; `@shared/...` gibi
// tsconfig-tanımlı adlar onun için harici paketti. Takma adın ne olduğuna karar
// veren tek yetkili tsconfig'dir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTsconfigPaths, resolveImport } from "../src/scanner/resolve-import.mjs";

/** Kök + apps/uygulama şeklinde iki katmanlı, aynı adı FARKLI yere bağlayan sahte repo. */
function kurMonorepo() {
  const dir = mkdtempSync(join(tmpdir(), "sbc-mono-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "kok", workspaces: ["apps/*"] }));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
    compilerOptions: { baseUrl: ".", paths: { "@shared/*": ["shared/*"] } },
  }));
  mkdirSync(join(dir, "shared"), { recursive: true });
  writeFileSync(join(dir, "shared", "ortak.ts"), "export const a = 1;\n");
  writeFileSync(join(dir, "shared", "ad-cakisma.ts"), "export const kok = 1;\n");

  const app = join(dir, "apps", "uygulama");
  mkdirSync(join(app, "src", "shared"), { recursive: true });
  mkdirSync(join(app, "src", "modules", "canvas"), { recursive: true });
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "uygulama" }));
  writeFileSync(join(app, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "@shared/*": ["src/shared/*"],
        "@modules/*": ["src/modules/*"],
        "@root-shared/*": ["../../shared/*"],
      },
    },
  }));
  writeFileSync(join(app, "src", "shared", "ad-cakisma.ts"), "export const app = 1;\n");
  writeFileSync(join(app, "src", "modules", "canvas", "index.ts"), "export const m = 1;\n");
  writeFileSync(join(app, "src", "giris.ts"), "");
  return { dir, app };
}

test("aynı takma ad, farklı uygulama → EN YAKIN tsconfig kazanır", () => {
  const { dir, app } = kurMonorepo();
  const sets = loadTsconfigPaths(dir);

  // Uygulama içinden: @shared/* uygulamanın kendi shared'ına gitmeli.
  const icerden = resolveImport("@shared/ad-cakisma", join(app, "src", "giris.ts"), dir, sets);
  assert.equal(icerden.kind, "file");
  assert.equal(icerden.rel, "apps/uygulama/src/shared/ad-cakisma.ts");

  // Kökten: aynı ad kök shared'ına gitmeli. Aynı specifier, başka sonuç — asıl kusur buydu.
  writeFileSync(join(dir, "kok-dosya.ts"), "");
  const kokten = resolveImport("@shared/ad-cakisma", join(dir, "kok-dosya.ts"), dir, sets);
  assert.equal(kokten.kind, "file");
  assert.equal(kokten.rel, "shared/ad-cakisma.ts");
});

test("tsconfig-tanımlı ad HARİCİ PAKET sayılmaz (isAlias öneki tanımasa bile)", () => {
  const { dir, app } = kurMonorepo();
  const sets = loadTsconfigPaths(dir);
  // '@modules/...' ne `@/` ne `~/` ne `$` ile başlıyor — eski isAlias() bunu paket sanıyordu.
  const r = resolveImport("@modules/canvas", join(app, "src", "giris.ts"), dir, sets);
  assert.equal(r.kind, "file");
  assert.equal(r.rel, "apps/uygulama/src/modules/canvas/index.ts");
});

test("uzun önek kısa öneki yener (@root-shared/* ile @shared/* karışmaz)", () => {
  const { dir, app } = kurMonorepo();
  const sets = loadTsconfigPaths(dir);
  const r = resolveImport("@root-shared/ortak", join(app, "src", "giris.ts"), dir, sets);
  assert.equal(r.kind, "file");
  assert.equal(r.rel, "shared/ortak.ts");
});

test("gerçek npm paketi takma ad sanılmaz", () => {
  const { dir, app } = kurMonorepo();
  const sets = loadTsconfigPaths(dir);
  for (const spec of ["react", "@scope/paket", "lodash/merge"]) {
    const r = resolveImport(spec, join(app, "src", "giris.ts"), dir, sets);
    assert.equal(r.kind, "package", `${spec} paket kalmalı`);
  }
});

test("tanımlı ama dosyası olmayan takma ad: paket DEĞİL, alias-unresolved", () => {
  const { dir, app } = kurMonorepo();
  const sets = loadTsconfigPaths(dir);
  const r = resolveImport("@shared/yok-boyle-bir-sey", join(app, "src", "giris.ts"), dir, sets);
  assert.equal(r.kind, "alias-unresolved");
});

test("tsconfig'i olmayan projede davranış değişmez (tek katman, boş küme)", () => {
  const dir = mkdtempSync(join(tmpdir(), "sbc-notsc-"));
  writeFileSync(join(dir, "a.ts"), "");
  const sets = loadTsconfigPaths(dir);
  assert.deepEqual(sets, []);
  assert.equal(resolveImport("react", join(dir, "a.ts"), dir, sets).kind, "package");
});
