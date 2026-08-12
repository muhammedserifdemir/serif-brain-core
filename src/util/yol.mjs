// Yol ayraci normalizasyonu — TEK KAYNAK.
//
// NEDEN VAR: `path.relative()` Windows'ta ters bolu doner ("src\\api\\x.js"),
// oysa bu projedeki TUM onek eslemeleri egik bolu ile yazilir:
//   · config.module_paths  → "src/api/": api
//   · config.scan_exclude_paths → "uploads/"
//   · module-owner RULES   → "apps/contentx/"
//   · capture              → ".serif-brain/"
//   · classifyFile desenleri → /\/components?\//
//
// Sonuc: Windows'ta hicbir onek tutmaz, her dosya "unknown" module duser ve
// guard/touch/impact/module_paths SESSIZCE ise yaramaz hale gelir. Kullanici
// hata gormez — yalnizca aracin "hicbir sey bilmedigini" gorur.
//
// Kural: dis dunyaya (kullaniciya, config'e, hafizaya) giden her goreli yol
// POSIX bicimindedir. Isletim sistemine ozgu ayrac yalniz dosya sistemi
// cagrilarinda kullanilir.
export function posixYol(p) {
  return typeof p === "string" ? p.split("\\").join("/") : p;
}
