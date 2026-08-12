// File walker — code source dosyalarini topla, build/cache/test atla.
import { readdirSync, statSync, readFileSync } from "node:fs";
import { ALL_EXTS, languageOf } from "./languages.mjs";
import { join, relative, extname, basename } from "node:path";
import { posixYol } from "../util/yol.mjs";

// Bagimlilik/uretim dizinleri. Liste eskiden yalniz JS ekosistemini taniyordu;
// cok-dilli tarama acilinca bu HEMEN patladi: avatarx'te (Python) 19.151 dosya
// ve 5,2 milyon satir tarandi — neredeyse tamami sanal ortamdaki 3. parti kod.
// Olcum olmasa "Python destegi eklendi" denip birakilacakti; kullanici acsa
// 4.613 TODO'nun hepsi kutuphanelerden gelirdi.
//
// Kural: her dilin KENDI "node_modules"u vardir. Yeni dil eklerken onun
// bagimlilik dizini de buraya eklenir.
export const EXCLUDED_DIRS = new Set([
  // JS/TS
  "node_modules", ".next", ".vite", ".turbo", ".vercel", ".parcel-cache",
  // Python
  "venv", ".venv", "env", ".env.d", "__pycache__", ".pytest_cache", ".mypy_cache",
  ".ruff_cache", ".tox", "site-packages", "eggs", ".eggs", "wheels",
  // Swift / Xcode / CocoaPods
  "Pods", "Carthage", ".build", "DerivedData", "xcuserdata",
  // Ruby / PHP / Java / Go / Rust
  "vendor", "bundle", ".bundle", "target", ".gradle", "Godeps",
  // Genel
  ".git", "dist", "build", "out", ".cache", "coverage", ".serif-brain",
  "graphify-out", ".idea", ".vscode", ".obsidian", ".claude", "backups",
]);

// Taranan uzantilar artik scanner/languages.mjs'ten gelir (tek kaynak).
// Eskiden burada 6 uzanti sabitti; Python/Swift/C# projelerinde tarayici HIC
// dosya gormuyordu, dolayisiyla guard/touch/risk/hotspot/graph o projelerde
// tamamen oluydu — kullanici hicbir hata gormeden.
// Geriye-uyumluluk: eski adi disa aktarmaya devam ediyoruz.
export const INCLUDED_EXTS = ALL_EXTS;

// BELIRSIZ dizin adlari: bir ekosistemde uretim ciktisi, digerinde KAYNAK.
//   bin/obj/packages → .NET'te cikti; JS monorepo'sunda `packages/` KAYNAKTIR
//   Library/Temp     → Unity'de cikti; baska yerde siradan bir klasor
//
// Bunlari isimden dislamak olculdu ve YANLIS cikti: GameX'te 147 kaynak dosya,
// serif-platform'da ~500 dosya taranmaz oluyordu. Isim yeterli kanit degildir;
// o dizinin GERCEKTEN o ekosisteme ait oldugunu gosteren bir isaret aranir.
//
// Kural: emin degilsen TARA. Fazladan taranan dosya gurultudur; taranmayan
// kaynak dosya SESSIZ KOR NOKTADIR — ve kullanici bunu hicbir zaman gormez.
const BELIRSIZ_DIZINLER = {
  bin: ["*.csproj", "*.sln", "*.vbproj", "*.fsproj"],
  obj: ["*.csproj", "*.sln", "*.vbproj", "*.fsproj"],
  packages: ["packages.config", "*.sln", "*.csproj"],
  Library: ["ProjectSettings", "Assets"],
  Temp: ["ProjectSettings", "Assets"],
};

// Ust dizinde isaret var mi? ("*.csproj" gibi desenler icin basit son-ek eslemesi)
function isaretVar(parentDir, desenler) {
  let girdiler;
  try { girdiler = readdirSync(parentDir); } catch { return false; }
  return desenler.some((d) =>
    d.startsWith("*.") ? girdiler.some((g) => g.endsWith(d.slice(1))) : girdiler.includes(d));
}

/** Bu dizin atlanmali mi? Belirsiz adlarda ekosistem isareti aranir. */
export function dizinAtlanir(ad, parentDir) {
  if (EXCLUDED_DIRS.has(ad)) return true;
  const desenler = BELIRSIZ_DIZINLER[ad];
  return desenler ? isaretVar(parentDir, desenler) : false;
}

export const TEST_PATTERNS = [/\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/, /__tests__/, /\.stories\.[tj]sx?$/];
export const TYPE_DECL_PATTERN = /\.d\.ts$/;

// Route/page heuristics — Next.js, SvelteKit, Astro, generic
export const ROUTE_PATTERNS = [
  /\/(page|layout|route|loading|error|not-found)\.[tj]sx?$/,
  /\/\+page\.svelte$/, /\/\+layout\.svelte$/,
  /\/pages\/[^/]+\.[tj]sx?$/
];

export function classifyFile(relPath) {
  if (TYPE_DECL_PATTERN.test(relPath)) return "type-declaration";
  if (TEST_PATTERNS.some(re => re.test(relPath))) return "test";
  if (ROUTE_PATTERNS.some(re => re.test(relPath))) return "route";
  if (/\/components?\//i.test(relPath) && /\.[tj]sx$/.test(relPath)) return "component";
  return "source";
}

export function scanFiles(root, opts = {}) {
  const out = [];
  const includeTests = opts.include_tests ?? false;
  const includeTypes = opts.include_types ?? false;
  // Projeye ozgu haric tutma: config.yaml'daki `scan_exclude_paths`. Kok-goreli
  // ONEK listesidir (ornek: "uploads/"). Calisma-zamani yuklenen icerik (SCORM
  // zip'i, kullanici dosyasi) proje kodu degildir; grafta sayilirsa hotspot/risk
  // yabanci dosyalari isaret eder.
  const excludePaths = (opts.exclude_paths || []).filter((p) => typeof p === "string" && p);

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (dizinAtlanir(entry.name, dir)) continue;
        const relDir = posixYol(relative(root, full));
        if (excludePaths.some((p) => relDir === p.replace(/\/$/, "") || relDir.startsWith(p))) continue;
        walk(full);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (!INCLUDED_EXTS.has(ext)) continue;
        const rel = posixYol(relative(root, full));
        const kind = classifyFile(rel);
        if (kind === "test" && !includeTests) continue;
        if (kind === "type-declaration" && !includeTypes) continue;
        let stat;
        try { stat = statSync(full); } catch { continue; }
        out.push({
          abs_path: full,
          rel_path: rel,
          ext,
          kind,
          size: stat.size,
          mtime: stat.mtime
        });
      }
    }
  }

  walk(root);
  return out;
}

export function readFileSafe(path) {
  try { return readFileSync(path, "utf8"); }
  catch { return ""; }
}

export function countLines(text) {
  if (!text) return 0;
  let n = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}
