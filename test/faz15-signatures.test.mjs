// Faz: Bug Signatures — projeye-ozel imza linter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lintContent, globMatch, globToRe, formatLint } from "../src/query/signatures.mjs";

const SIGS = [
  { name: "rls-eksik", pattern: "create table", message: "yeni tabloda RLS?", severity: "high" },
  { name: "console-log", pattern: "console\\.log", message: "debug log unutuldu", severity: "low", glob: "src/**/*.ts" },
];

test("lint: pattern satir bazinda eslesir + satir no", () => {
  const text = "line one\nCREATE TABLE users (id int)\nline three";
  const f = lintContent("db/schema.sql", text, SIGS);
  assert.equal(f.length, 1);
  assert.equal(f[0].name, "rls-eksik");
  assert.equal(f[0].line, 2);
  assert.equal(f[0].severity, "high");
});

test("lint: glob filtresi uygulanir (console-log sadece src/**/*.ts)", () => {
  const text = "console.log('x')";
  assert.equal(lintContent("src/app/x.ts", text, SIGS).length, 1); // glob eslesir
  assert.equal(lintContent("scripts/y.js", text, SIGS).length, 0); // glob eslesmez
});

test("lint: imza yoksa / icerik bossa bos", () => {
  assert.deepEqual(lintContent("a.ts", "x", []), []);
  assert.deepEqual(lintContent("a.ts", null, SIGS), []);
});

test("lint: gecersiz regex pattern atlanir (patlamaz)", () => {
  const bad = [{ name: "bad", pattern: "(unclosed" }];
  assert.deepEqual(lintContent("a.ts", "(unclosed text", bad), []);
});

test("globToRe / globMatch: ** ve * semantigi", () => {
  assert.ok(globMatch("src/**/*.ts", "src/a/b/c.ts"));
  assert.ok(globMatch("src/*.ts", "src/x.ts"));
  assert.ok(!globMatch("src/*.ts", "src/a/x.ts")); // * /-disi
  assert.ok(globMatch(null, "anything"));          // glob yoksa hep eslesir
});

test("formatLint: imza yok -> ornek, eslesme yok -> temiz", () => {
  assert.match(formatLint([], { sigCount: 0 }), /bug_signatures/);
  assert.match(formatLint([], { sigCount: 2, fileCount: 5 }), /eslesme yok/);
});
