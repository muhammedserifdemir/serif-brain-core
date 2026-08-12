// Dil tanimlarinin TEK KAYNAGI: uzanti → dil, import ayristirma bicimi,
// ve en onemlisi IMPORT'UN COZULEBILIR OLUP OLMADIGI.
//
// NEDEN BU AYRIM SART
// "Her dili destekle" her dilde ayni sey demek degildir:
//
//   · JS/TS/Python/PHP → import bir YOLA isaret eder ("./utils", "pkg.mod").
//     Dosyadan dosyaya kenar cikarilabilir; graf gercektir.
//   · Swift/C#/Java/Kotlin → import bir MODULE/NAMESPACE'e isaret eder.
//     Ayni modul icindeki dosyalar birbirini IMPORT ETMEZ, hepsi otomatik
//     gorunurdur. `import Foundation` "bu dosya Foundation'a bagli" demektir;
//     "su dosyaya bagli" demez.
//
// Ikinci gruba dosya-dosya kenari uretmek UYDURMAK olur: blast-radius yanlis
// cikar, "kimse import etmiyor, guvenle degistir" gibi TEHLIKELI bir cumle
// uretilir. Bu yuzden o diller INDEKSLENIR (modul atfi, churn, risk, hafiza
// baglantisi, imza taramasi calisir) ama IMPORT KENARI URETILMEZ — ve bu
// durum `scan code` ciktisinda acikca soylenir.
//
// Yani sozlesme: sessizce yarim calismak yok. Ya gercek graf, ya "graf yok" yazisi.

/**
 * resolvable:true  → import bir dosyaya cozulur, graf kenari uretilir
 * resolvable:false → dosya indekslenir, import kenari URETILMEZ (uydurma yok)
 */
export const LANGUAGES = {
  javascript: {
    label: "JavaScript/TypeScript",
    exts: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".vue", ".svelte", ".astro"],
    parser: "js",
    resolvable: true,
  },
  python: {
    label: "Python",
    exts: [".py", ".pyi"],
    parser: "python",
    resolvable: true,
  },
  php: {
    label: "PHP",
    exts: [".php"],
    parser: "php",
    resolvable: true,
  },
  ruby: {
    label: "Ruby",
    exts: [".rb"],
    parser: "ruby",
    resolvable: true,
  },
  // ── Indekslenir, import kenari URETILMEZ ──────────────────────────────────
  swift: {
    label: "Swift",
    exts: [".swift"],
    parser: "module",
    resolvable: false,
    note: "ayni hedefteki dosyalar birbirini import etmez — dosya-dosya kenari yok",
  },
  csharp: {
    label: "C#",
    exts: [".cs"],
    parser: "module",
    resolvable: false,
    note: "using = namespace; dosya-dosya bagimliligi degil",
  },
  kotlin: { label: "Kotlin", exts: [".kt", ".kts"], parser: "module", resolvable: false, note: "import = paket/sinif" },
  java:   { label: "Java",   exts: [".java"],       parser: "module", resolvable: false, note: "import = paket/sinif" },
  go:     { label: "Go",     exts: [".go"],         parser: "module", resolvable: false, note: "import = paket (dosya degil)" },
  rust:   { label: "Rust",   exts: [".rs"],         parser: "module", resolvable: false, note: "use = modul yolu" },
  dart:   { label: "Dart",   exts: [".dart"],       parser: "module", resolvable: false, note: "package: URI" },
  objc:   { label: "Objective-C", exts: [".m", ".mm", ".h"], parser: "module", resolvable: false, note: "#import = baslik" },
  shell:  { label: "Shell",  exts: [".sh", ".bash", ".zsh"], parser: "module", resolvable: false },
  sql:    { label: "SQL",    exts: [".sql"],        parser: "module", resolvable: false },
};

const EXT_TO_LANG = new Map();
for (const [id, def] of Object.entries(LANGUAGES)) {
  for (const e of def.exts) EXT_TO_LANG.set(e, id);
}

/** Taranan TUM uzantilar. */
export const ALL_EXTS = new Set(EXT_TO_LANG.keys());

/** Import'u dosyaya cozulebilen dillerin uzantilari (graf kenari uretilir). */
export const RESOLVABLE_EXTS = new Set(
  [...EXT_TO_LANG.entries()].filter(([, id]) => LANGUAGES[id].resolvable).map(([e]) => e),
);

export function languageOf(relPath) {
  const i = String(relPath).lastIndexOf(".");
  if (i < 0) return null;
  return EXT_TO_LANG.get(String(relPath).slice(i).toLowerCase()) || null;
}

export function languageDef(relPath) {
  const id = languageOf(relPath);
  return id ? { id, ...LANGUAGES[id] } : null;
}

/** Bu dosyadan import KENARI uretilmeli mi? */
export function isResolvable(relPath) {
  return !!languageDef(relPath)?.resolvable;
}

/** Ayristirici adi (parse-imports bunu kullanir). */
export function parserOf(relPath) {
  return languageDef(relPath)?.parser || null;
}
