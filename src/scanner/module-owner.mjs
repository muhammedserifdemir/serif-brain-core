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

export function moduleStats(files) {
  const byMod = new Map();
  for (const f of files) {
    const m = ownerOf(f.rel_path);
    if (!byMod.has(m)) byMod.set(m, { files: 0, kinds: {}, loc: 0 });
    const s = byMod.get(m);
    s.files++;
    s.kinds[f.kind] = (s.kinds[f.kind] || 0) + 1;
  }
  return byMod;
}
