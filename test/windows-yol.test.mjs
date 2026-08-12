// WINDOWS YOL AYRACI.
//
// `path.relative()` Windows'ta ters bolu doner ("src\\api\\x.js"), oysa bu
// projedeki TUM onek eslemeleri egik bolu ile yazilir: config.module_paths,
// scan_exclude_paths, module-owner RULES, capture'in ".serif-brain/" kontrolu,
// classifyFile desenleri.
//
// Sonuc: Windows'ta hicbir onek tutmaz → HER dosya "unknown" module duser →
// guard/touch/impact/module_paths sessizce ise yaramaz olur. Kullanici hata
// gormez; yalnizca aracin "hicbir sey bilmedigini" gorur.
//
// Windows makinesi olmadan da bu kilitlenebilir: ayrac normalizasyonu SAF bir
// donusumdur, ters bolulu girdiyle dogrudan test edilir. "Windows'ta denenmedi"
// demek yerine, Windows'un URETECEGI girdiyi burada uretiyoruz.
import { test } from "node:test";
import assert from "node:assert/strict";
import { posixYol } from "../src/util/yol.mjs";
import { ownerOfConfigured, resolveModule } from "../src/scanner/module-owner.mjs";
import { classifyFile } from "../src/scanner/scan-files.mjs";
import { isMemoryOnlyCommit } from "../src/query/capture.mjs";

const CONFIG = { module_paths: { "src/api/": "api", "src/ui/": "ui" } };

test("posixYol: ters bolu egik boluye cevrilir, egik bolu bozulmaz", () => {
  assert.equal(posixYol("src\\api\\users.js"), "src/api/users.js");
  assert.equal(posixYol("src/api/users.js"), "src/api/users.js");
  assert.equal(posixYol("C:\\proje\\src\\a.ts"), "C:/proje/src/a.ts");
  assert.equal(posixYol(undefined), undefined, "bos girdide cokmemeli");
});

test("module_paths: Windows bicimli yol NORMALIZE EDILINCE eslesir", () => {
  // Ham Windows yolu — eskiden burasi sessizce "unknown" donuyordu:
  assert.equal(ownerOfConfigured("src\\api\\users.js", CONFIG), "unknown",
    "ham ters bolulu yol eslesmez (sorunun kendisi)");
  // Tarayici artik normalize ettigi icin uretimde bu deger gelir:
  assert.equal(ownerOfConfigured(posixYol("src\\api\\users.js"), CONFIG), "api");
});

test("resolveModule: normalize edilmis Windows yolunda config kazanir", () => {
  assert.equal(resolveModule("unknown", posixYol("src\\ui\\btn.tsx"), CONFIG), "ui");
});

test("classifyFile: test/route desenleri normalize yolda calisir", () => {
  assert.equal(classifyFile(posixYol("src\\components\\Btn.tsx")), "component");
  assert.equal(classifyFile(posixYol("src\\__tests__\\a.test.ts")), "test");
});

test("capture: '.serif-brain/' kontrolu normalize yolda calisir", () => {
  // git zaten egik bolu verir; yine de normalize edilmis girdi bozulmamali.
  assert.equal(isMemoryOnlyCommit([".serif-brain/objects/x.md"]), true);
  assert.equal(isMemoryOnlyCommit([posixYol(".serif-brain\\objects\\x.md")]), true);
});

test("SOZLESME: dis dunyaya giden goreli yollarda ters bolu OLMAZ", () => {
  for (const girdi of ["a\\b\\c.ts", "src\\x.py", "Sources\\App.swift"]) {
    assert.ok(!posixYol(girdi).includes("\\"), `${girdi} normalize edilmeli`);
  }
});
