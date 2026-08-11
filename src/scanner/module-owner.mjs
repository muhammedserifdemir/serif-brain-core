// File path -> module mapping. Order matters: more specific prefixes first.
// Genislemek istersen .serif-brain/config.yaml'a 'module_paths' anahtarini ekle.

const RULES = [
  // ContentX (3 olasi konum)
  ["apps/contentx/", "contentx"],
  ["apps/content-studio/", "contentx"],
  ["apps/content-generator/", "contentx"],

  // PresentX (2 olasi konum)
  ["apps/presentation-designer/", "presentx"],
  ["apps/presentx/", "presentx"],

  // AnimatorX (V1 + V2)
  ["apps/animation-studio/", "animatorx"],
  ["apps/animator-x/", "animatorx"],

  // StudioX
  ["apps/serif-studio/", "studiox"],
  ["apps/studiox/", "studiox"],

  // Family-gallery / unknown apps
  ["apps/family-gallery/", "unknown"],

  // TestX (var olduğunda)
  ["apps/testx/", "testx"],
  ["apps/testlms/", "testx"],

  // Dashboard
  ["dashboard/", "dashboard"],

  // Shared / infra
  ["shared/", "shared"],
  ["public/", "shared"],
  ["scripts/", "infra"],
  [".serif-brain/", "infra"]
];

export function ownerOf(relPath) {
  for (const [prefix, mod] of RULES) {
    if (relPath.startsWith(prefix)) return mod;
  }
  // apps/<other>/ — bilinmeyen alt-uygulama
  if (relPath.startsWith("apps/")) {
    const second = relPath.split("/")[1] || "";
    return second ? `unknown` : "unknown";
  }
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
