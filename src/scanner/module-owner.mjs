// File path -> module mapping. Order matters: more specific prefixes first.
// Genislemek istersen .serif-brain/config.yaml'a 'module_paths' anahtarini ekle.

// GENEL yerlesim kurallari. Burada bir zamanlar paket yazarinin kendi urun
// klasorleri vardi (apps/contentx/, apps/presentation-designer/, apps/serif-studio/
// ...). Sonucu olculdu: config yazmamis projelerde HICBIR kural eslesmiyor ve her
// dosya "unknown" moduline dusuyordu — 11 gercek projede besinin orani %25 ustu,
// birininki %100. O dosyalarda modul-seviyesi hafiza, hotspot ve risk sessizce
// zayif calisir.
//
// Yerine ekosistemden bagimsiz KONVANSIYON: kapsayici dizinin altindaki ilk
// segment modul adidir (`src/auth/login.ts` → auth). Bu, bir sirketin klasor
// adlarini ezberlemek yerine herkeste calisan bir kuraldir.
const KAPSAYICI = ["apps/", "packages/", "modules/", "services/", "src/", "lib/"];

// Tek-segmentli, kendiliginden modul olan tepe dizinler.
const TEKIL = [
  ["dashboard/", "dashboard"],
  ["server/", "server"],
  ["client/", "client"],
  ["public/", "shared"],
  ["shared/", "shared"],
  ["scripts/", "infra"],
  ["infra/", "infra"],
  ["docs/", "docs"],
  [".serif-brain/", "infra"],
];

export function ownerOf(relPath) {
  const yol = String(relPath || "");
  for (const [prefix, mod] of TEKIL) {
    if (yol.startsWith(prefix)) return mod;
  }
  for (const kap of KAPSAYICI) {
    if (!yol.startsWith(kap)) continue;
    const parcalar = yol.slice(kap.length).split("/");
    // Alt dizin varsa adi modul olur; dogrudan `src/a.ts` ise modul yoktur.
    if (parcalar.length > 1 && parcalar[0]) return parcalar[0].toLowerCase();
    return "unknown";
  }
  // DUZ YERLESIM (tepe dizinin kendisi modul: `engine/`, `orchestrator/`) BILEREK
  // kapsanmadi. Denendi ve uc testi kirdi — hepsi ayni kasitli kurali koruyor:
  // "ne graf ne config biliyorsa unknown kalir, YALAN URETMEZ". Her tepe dizini
  // modul saymak bir tahmindir; tahmini gercek gibi sunmak bu aracin en temel
  // sozlesmesini bozar. Duz yerlesimli projeler icin dogru yol config:
  //   module_paths: { "engine/": engine, "orchestrator/": orchestrator }
  // `init` bunu klasor yapisindan zaten turetiyor. (Olcum: cizgi-film-otomasyon
  // 118/118 unknown — bu bir yanlis alarm degil, config eksigi; doctor soyluyor.)
  return "unknown";
}

// Config-farkinda surum: once .serif-brain/config.yaml'daki `module_paths`'e bakar
// (yorumda vaat edilmis ama implement edilmemisti), sonra hardcoded RULES'a duser.
// module_paths sekli: { "src/auth/": "auth", "packages/billing/": "billing" }
// veya [["src/auth/","auth"], ...]. Mevcut ownerOf'a dokunmaz (graph build aynen calisir).
export function ownerOfConfigured(relPath, config) {
  const paths = config?.module_paths;
  if (paths) {
    const entries = Array.isArray(paths) ? paths : Object.entries(paths);
    // Daha spesifik (uzun) prefix once eslessin.
    const sorted = [...entries].sort((a, b) => String(b[0]).length - String(a[0]).length);
    for (const [prefix, mod] of sorted) {
      if (typeof prefix === "string" && relPath.startsWith(prefix)) return mod;
    }
  }
  return ownerOf(relPath);
}

// "Modul bilinmiyor" sinyali. ownerOf, eslesmeyen her yola bunu dondurur; graf
// dugumune de bu deger yazilir. Bir yerde string olarak tekrarlanmasin diye burada.
export const UNKNOWN_MODULE = "unknown";

export function isKnownModule(mod) {
  return typeof mod === "string" && mod.length > 0 && mod !== UNKNOWN_MODULE;
}

// Graf dugumunden gelen modul ile config'i BIRLESTIRIR.
//
// Cagri yerleri eskiden `node.module || ownerOfConfigured(rel, config)` yaziyordu.
// Bu yanlisti: graf dugumu eslesmeyen dosyaya "unknown" yazar ve "unknown" TRUTHY
// oldugu icin fallback HIC calismazdi — config'te dogru kural olsa bile cikti
// "modul:unknown" derdi (graf, kural yazilmadan once kurulmussa daima boyle olur).
// Kural: graf yalnizca BILINEN bir modul soyluyorsa kazanir; aksi halde config.
export function resolveModule(nodeModule, relPath, config) {
  if (isKnownModule(nodeModule)) return nodeModule;
  return ownerOfConfigured(relPath, config);
}

// config verilirse `module_paths` kurallari uygulanir; verilmezse eski davranis.
export function moduleStats(files, config) {
  const byMod = new Map();
  for (const f of files) {
    const m = ownerOfConfigured(f.rel_path, config);
    if (!byMod.has(m)) byMod.set(m, { files: 0, kinds: {}, loc: 0 });
    const s = byMod.get(m);
    s.files++;
    s.kinds[f.kind] = (s.kinds[f.kind] || 0) + 1;
  }
  return byMod;
}
