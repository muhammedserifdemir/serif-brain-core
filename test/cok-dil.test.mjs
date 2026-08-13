// COK DILLI TARAMA.
//
// Once yalniz 6 uzanti taraniyordu (.ts/.tsx/.js/.jsx/.mjs/.cjs). Sonucu
// olculdu: avatarx'te 65 Python dosyasi HIC gorulmuyordu — guard/touch/risk/
// hotspot/graph o projede tamamen oluydu ve kullanici hicbir hata gormuyordu.
//
// En kritik sozlesme: "her dili destekle" her dilde AYNI SEY DEMEK DEGILDIR.
// Swift/C#/Java'da ayni modul icindeki dosyalar birbirini import ETMEZ; oraya
// dosya-dosya kenari uretmek UYDURMAKTIR ve "kimse import etmiyor, guvenle
// degistir" gibi TEHLIKELI bir cumle uretir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGraph } from "../src/graph/build.mjs";
import { scanFiles, EXCLUDED_DIRS } from "../src/scanner/scan-files.mjs";
import { parseImports, parseImportsFor } from "../src/scanner/parse-imports.mjs";
import { resolvePythonImport } from "../src/scanner/resolve-import.mjs";
import { languageOf, isResolvable, ALL_EXTS } from "../src/scanner/languages.mjs";

function mkProject(files) {
  const root = mkdtempSync(join(tmpdir(), "sbc-dil-"));
  mkdirSync(join(root, ".serif-brain"), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

const graphOf = (root) => buildGraph({ projectRoot: root, brainRoot: join(root, ".serif-brain"), projectId: "t", config: {} });
const importEdges = (g) => g.edges.filter((e) => e.type === "imports").map((e) => `${e.source} → ${e.target}`);

// ── REGRESYON: JS/TS yolu birebir korunmali ────────────────────────────────

test("REGRESYON: JS import ayristirmasi degismedi", () => {
  const kod = 'import a from "./a";\nconst b = require("./b");\nexport * from "./c";\n';
  assert.deepEqual(parseImports(kod).sort(), ["./a", "./b", "./c"]);
  assert.deepEqual(parseImportsFor("x.ts", kod).sort(), ["./a", "./b", "./c"], "yol verilince de ayni");
});

test("REGRESYON: JS grafi hala dosya-dosya kenari uretiyor", async () => {
  const root = mkProject({
    "src/a.mjs": 'import { b } from "./b.mjs";\nexport const a = b;\n',
    "src/b.mjs": "export const b = 1;\n",
  });
  const kenar = importEdges(await graphOf(root));
  assert.deepEqual(kenar, ["file:src/a.mjs → file:src/b.mjs"]);
});

// ── Python ─────────────────────────────────────────────────────────────────

test("Python: from/import ifadeleri ayristirilir, yorum sayilmaz", () => {
  const kod = "from .util import x\nimport os, sys\nfrom ..pkg.mod import y\n# import yorum_degil\n";
  const spec = parseImportsFor("a/b.py", kod);
  assert.ok(spec.includes(".util"));
  assert.ok(spec.includes("..pkg.mod"));
  assert.ok(spec.includes("os") && spec.includes("sys"), "virgullu import bolunmeli");
  assert.ok(!spec.includes("yorum_degil"), "# yorumu import degildir");
});

test("Python: goreli import dosyaya cozulur (tek ve cift nokta)", () => {
  const root = mkProject({
    "pkg/__init__.py": "",
    "pkg/util.py": "X = 1\n",
    "pkg/alt/mod.py": "from ..util import X\n",
  });
  const r = resolvePythonImport("..util", join(root, "pkg", "alt", "mod.py"), root);
  assert.equal(r.kind, "file");
  assert.equal(r.rel, "pkg/util.py");
});

test("Python: mutlak paket yolu cozulur; stdlib ile 3. parti AYRISIR", () => {
  const root = mkProject({ "core/analiz.py": "X = 1\n", "cli.py": "from core.analiz import X\n" });
  assert.equal(resolvePythonImport("core.analiz", join(root, "cli.py"), root).rel, "core/analiz.py");
  // Ikisi de "cozulemedi HATASI" degildir; ama ayni sey de degiller:
  // stdlib dille gelir (bagimlilik degil), 3. parti kurulur (bagimliliktir).
  assert.equal(resolvePythonImport("os", join(root, "cli.py"), root).kind, "stdlib");
  assert.equal(resolvePythonImport("os.path", join(root, "cli.py"), root).kind, "stdlib",
    "alt modul de stdlib'dir: kok'e bakilir");
  assert.equal(resolvePythonImport("numpy", join(root, "cli.py"), root).kind, "external");
});

test("Python: yanindaki dosyayi cip-adiyla import etmek KENAR urer (sys.path[0])", async () => {
  // `python tests/rapor.py` calistiginda sys.path[0] = tests/. Bu deneme
  // yapilmazsa `from yardimci import x` proje disi sanilir: gercek kenar
  // kaybolur ve ustune sahte bir "bagimlilik" dugumu uretilir.
  const root = mkProject({
    "tests/yardimci.py": "def x(): pass\n",
    "tests/rapor.py": "from yardimci import x\n",
  });
  const g = await graphOf(root);
  assert.deepEqual(importEdges(g), ["file:tests/rapor.py → file:tests/yardimci.py"]);
  assert.equal(g.nodes.filter(n => n.type === "dependency").length, 0,
    "proje dosyasi 'bagimlilik' olarak etiketlenmemeli");
});

test("Python: stdlib+3.parti import 'unresolved' SAYILMAZ, bagimlilik dugumu urer", async () => {
  // Regresyon: build.mjs "external" dalini hic ele almiyordu; hepsi son
  // else'e dusup unresolved sayiliyordu. avatarx'te 536 import'un 383'u
  // "cozulemedi" gorunuyor, numpy/torch ise hic dugum olmuyordu.
  const root = mkProject({
    "cli.py": "import os\nimport sys\nfrom pathlib import Path\nimport numpy as np\nfrom scipy.linalg import inv\nfrom core.analiz import X\n",
    "core/__init__.py": "",
    "core/analiz.py": "X = 1\n",
  });
  const g = await graphOf(root);
  assert.equal(g.stats.unresolved_imports, 0, "stdlib/3.parti yanlis alarm uretmemeli");
  assert.equal(g.stats.external_refs, 2, "numpy + scipy sayilmali (stdlib sayilmaz)");
  const paketler = g.nodes.filter(n => n.type === "dependency").map(n => n.label).sort();
  assert.deepEqual(paketler, ["numpy", "scipy"], "os/sys/pathlib bagimlilik DEGILDIR");
});

test("Python: cozulemeyen PROJE modulu sahte 'bagimlilik' olmaz", async () => {
  // `cli.py` icindeki `from server import main`; dosya ise `ui/server.py`
  // (sys.path hilesi). Bunu 3. parti sanmak `server` adinda olmayan bir pip
  // paketi uydurmakti. Dogrusu: cozulemedi say, sinyali koru.
  const root = mkProject({ "ui/server.py": "def main(): pass\n", "cli.py": "from server import main\n" });
  const g = await graphOf(root);
  assert.equal(g.nodes.filter(n => n.type === "dependency").length, 0);
  assert.equal(g.stats.unresolved_imports, 1, "gercek cozulememe sinyali kalmali");
});

test("Ruby: cip-adi require stdlib'den ayrilir", async () => {
  const root = mkProject({
    "app.rb": "require 'json'\nrequire 'nokogiri'\nrequire_relative 'lib/util'\n",
    "lib/util.rb": "X = 1\n",
  });
  const g = await graphOf(root);
  assert.equal(g.stats.unresolved_imports, 0);
  const paketler = g.nodes.filter(n => n.type === "dependency").map(n => n.label);
  assert.deepEqual(paketler, ["nokogiri"], "json stdlib'dir, nokogiri bagimliliktir");
});

test("PHP: require bir YOLDUR — paket adi UYDURULMAZ", async () => {
  // `require 'vendor/autoload.php'` bir paket degil, repoda olmayan bir
  // dosyadir. Yol'dan "vendor" adinda bagimlilik uretmek yanlis dugum olurdu.
  const root = mkProject({ "index.php": "<?php\nrequire 'vendor/autoload.php';\nrequire 'lib/db.php';\n", "lib/db.php": "<?php\n" });
  const g = await graphOf(root);
  assert.equal(g.nodes.filter(n => n.type === "dependency").length, 0);
  assert.equal(g.stats.unresolved_imports, 0, "repo disi dosya 'cozulemedi HATASI' degil");
});

test("Python: graf gercek kenar uretir", async () => {
  const root = mkProject({
    "cli.py": "from core.analiz import X\n",
    "core/__init__.py": "",
    "core/analiz.py": "X = 1\n",
  });
  assert.deepEqual(importEdges(await graphOf(root)), ["file:cli.py → file:core/analiz.py"]);
});

// ── Modul-tabanli diller: UYDURMA YOK ──────────────────────────────────────

test("Swift: dosyalar indekslenir ama import KENARI URETILMEZ", async () => {
  const root = mkProject({
    "Sources/App.swift": "import Foundation\nimport SwiftUI\nstruct App {}\n",
    "Sources/View.swift": "import SwiftUI\nstruct View {}\n",
  });
  const g = await graphOf(root);
  assert.equal(g.nodes.filter((n) => n.type === "file").length, 2, "dosyalar GORULMELI");
  assert.deepEqual(importEdges(g), [],
    "Swift'te ayni hedefteki dosyalar birbirini import etmez — kenar uydurmak yanlis 'yaprak dosya' uretir");
  assert.deepEqual(parseImportsFor("A.swift", "import Foundation"), []);
});

test("C#/Java/Go/Rust: ayni sozlesme (indekslenir, kenar yok)", () => {
  for (const f of ["A.cs", "A.java", "a.go", "a.rs", "A.kt"]) {
    assert.equal(isResolvable(f), false, `${f} icin kenar uretilmemeli`);
    assert.ok(languageOf(f), `${f} yine de TANINMALI (indekslenir)`);
  }
});

// ── PHP / Ruby ─────────────────────────────────────────────────────────────

test("PHP: require/include yolu alinir; 'use' namespace'i ALINMAZ", () => {
  const kod = '<?php\nrequire_once "lib/db.php";\ninclude("../ortak.php");\nuse App\\Models\\User;\n';
  const spec = parseImportsFor("x.php", kod);
  assert.ok(spec.includes("lib/db.php"));
  assert.ok(spec.includes("../ortak.php"));
  assert.ok(!spec.some((s) => s.includes("App")),
    "namespace dosyaya cozulemez; spec uretmek 'cozulemeyen import' sayacini sisirir");
});

test("Ruby: require_relative alinir", () => {
  assert.ok(parseImportsFor("a.rb", 'require_relative "helper"\nrequire "json"\n').includes("helper"));
});

// ── Bagimlilik dizinleri ───────────────────────────────────────────────────

test("Her dilin KENDI 'node_modules'u KOSULSUZ dislanir", () => {
  // Bu adlar hicbir ekosistemde kaynak dizini degildir → sart aranmaz.
  for (const d of ["venv", ".venv", "site-packages", "__pycache__", "Pods", "Carthage",
                   "vendor", "target", ".gradle", "node_modules"]) {
    assert.ok(EXCLUDED_DIRS.has(d), `${d} kosulsuz dislanmali`);
  }
  // Belirsiz olanlar burada OLMAMALI — kanit isterler (bkz. asagidaki testler).
  for (const d of ["bin", "obj", "packages", "Library", "Temp"]) {
    assert.ok(!EXCLUDED_DIRS.has(d),
      `${d} kosulsuz dislanmamali — baska ekosistemde KAYNAK dizinidir`);
  }
});

test("OLCUM: sanal ortam taranmaz (avatarx'te 19.151 → 67 dosya farki)", () => {
  const root = mkProject({
    "kod.py": "X = 1\n",
    "venv/lib/site-packages/numpy/core.py": "# 3. parti\n",
    ".venv/lib/paket.py": "# 3. parti\n",
    "__pycache__/kod.cpython-311.pyc": "",
  });
  const dosyalar = scanFiles(root).map((f) => f.rel_path);
  assert.deepEqual(dosyalar, ["kod.py"], "yalniz projenin kendi kodu");
});

test("ALL_EXTS: yeni diller gercekten kayitli", () => {
  for (const e of [".py", ".swift", ".cs", ".php", ".rb", ".go", ".rs", ".kt", ".java", ".vue", ".ts"]) {
    assert.ok(ALL_EXTS.has(e), `${e} taranmali`);
  }
});

// ── BELIRSIZ dizin adlari ──────────────────────────────────────────────────
// `packages/` .NET'te NuGet ciktisi, JS monorepo'sunda KAYNAK. Isimden dislamak
// olculdu ve yanlis cikti: GameX'te 147, serif-platform'da ~100 kaynak dosya
// taranmaz oluyordu. Isim yeterli kanit degil — ekosistem isareti aranir.
// Kural: emin degilsen TARA. Fazladan dosya gurultudur; taranmayan kaynak
// dosya SESSIZ KOR NOKTADIR.
test("packages/ JS monorepo'sunda TARANIR (.NET isareti yoksa)", () => {
  const root = mkProject({
    "package.json": '{"name":"mono","workspaces":["packages/*"]}',
    "packages/oyun/index.mjs": "export const x = 1;\n",
  });
  assert.deepEqual(scanFiles(root).map((f) => f.rel_path).sort(),
    ["packages/oyun/index.mjs"], "monorepo kaynagi atlanmamali");
});

test("packages/ .NET projesinde ATLANIR (.sln isareti var)", () => {
  const root = mkProject({
    "Uygulama.sln": "Microsoft Visual Studio Solution File\n",
    "packages/Newtonsoft.Json/lib/x.cs": "// 3. parti\n",
    "Kaynak/Program.cs": "class P {}\n",
  });
  assert.deepEqual(scanFiles(root).map((f) => f.rel_path), ["Kaynak/Program.cs"]);
});

test("bin/ ve obj/ yalniz .csproj varken atlanir", () => {
  const jsProje = mkProject({ "package.json": "{}", "bin/arac.mjs": "export const a = 1;\n" });
  assert.deepEqual(scanFiles(jsProje).map((f) => f.rel_path), ["bin/arac.mjs"],
    "JS projesinde bin/ bir kaynak dizini olabilir");

  const netProje = mkProject({ "App.csproj": "<Project/>", "bin/Debug/App.cs": "class A {}\n", "Program.cs": "class P {}\n" });
  assert.deepEqual(scanFiles(netProje).map((f) => f.rel_path), ["Program.cs"]);
});

test("Unity Library/ yalniz Unity isaretiyle atlanir", () => {
  const unity = mkProject({
    "ProjectSettings/Ayar.asset": "x",
    "Assets/Kod.cs": "class K {}\n",
    "Library/PackageCache/paket/A.cs": "class Cache {}\n",
  });
  assert.deepEqual(scanFiles(unity).map((f) => f.rel_path), ["Assets/Kod.cs"]);
});

test("TypeScript ESM: './x.js' yazimi './x.ts' dosyasina cozulur", async () => {
  // TS'in NodeNext/ESM kurali KAYNAK degil CIKTI uzantisi yazdirir: dosya
  // `oda.ts` iken import `"./oda.js"` olur. Bunu bilmeyen cozucu kenari
  // sessizce dusurur ve graf EN TEHLIKELI bicimde yalan soyler: kenari
  // kaybolan dosya "yaprak" gorunur, guard "kimse import etmiyor, nispeten
  // guvenli" der. klavye-savas'ta gercekten oldu (37 import'un 11'i kayip;
  // src/oyun/oda.ts iki dosya tarafindan import edilirken "yaprak" deniyordu).
  const root = mkProject({
    "src/oyun/oda.ts": "export const oda = 1;\n",
    "src/ag/protokol.ts": "export type P = string;\n",
    "src/oyun/odalar.ts": 'import { oda } from "./oda.js";\nimport type { P } from "../ag/protokol.js";\nexport const x = oda;\n',
    "src/bilesen.tsx": "export const B = () => null;\n",
    "src/kullan.tsx": 'import { B } from "./bilesen.jsx";\nexport const C = B;\n',
  });
  const g = await graphOf(root);
  assert.equal(g.stats.unresolved_imports, 0);
  assert.deepEqual(importEdges(g).sort(), [
    "file:src/kullan.tsx → file:src/bilesen.tsx",
    "file:src/oyun/odalar.ts → file:src/ag/protokol.ts",
    "file:src/oyun/odalar.ts → file:src/oyun/oda.ts",
  ]);
});

test("TypeScript ESM: GERCEK .js dosyasi varsa O kazanir (.ts'e kaymaz)", async () => {
  // Ayni dizinde hem `util.js` hem `util.ts` bulunabilir (derlenmis cikti yanda
  // duruyor olabilir). Kaynak dosyayi tahmin etmek, VAR OLAN dosyayi es gecmek
  // demektir — once gercek yol denenir, uzanti takasi yalniz SON caredir.
  const root = mkProject({
    "util.js": "export const u = 1;\n",
    "util.ts": "export const u: number = 1;\n",
    "ana.ts": 'import { u } from "./util.js";\nexport const v = u;\n',
  });
  assert.deepEqual(importEdges(await graphOf(root)), ["file:ana.ts → file:util.js"]);
});
