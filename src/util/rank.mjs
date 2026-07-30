/**
 * Kayit siralamasinin TEK KAYNAGI.
 *
 * NEDEN AYRI DOSYA — 2026-07-30'da bulunan hata:
 * `active-work.md`'nin "Now" listesi haziran kayitlarini gosteriyordu, oysa
 * ayni veriden uretilen `CLAUDE.generated.md` en gunceli en uste koyuyordu.
 * Sebep: "Now" listesi YALNIZ oncelige bakan bir karsilastirici kullaniyordu:
 *
 *     .sort((a, b) => pri(a.priority) - pri(b.priority))
 *
 * Tum kayitlar `critical` oldugunda bu karsilastirici hep 0 doner. V8'in sort'u
 * KARARLI (stable) oldugu icin esitlikte giris sirasi korunur — o da dosya adi
 * sirasidir, yani EN ESKI kayit basa gecer. Yani hata "yanlis siralama" degil,
 * "esitlik durumunda karar verilmemis olmasi"ydi.
 *
 * Dogru anahtar (pinned > oncelik > tazelik) `compile.mjs` icinde ZATEN vardi
 * ama yalniz iki cagri yeri onu kullaniyordu; digerleri kendi kopyalarini
 * tasiyordu. Bu yuzden anahtar buraya tasindi: ikinci bir gercek uretmesin.
 *
 * Kural: kayit listesi siralayan HER yer bu modulu kullanir. Yerel
 * `.sort((a,b) => pri(...) - pri(...))` yazma.
 */

export const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

/** Bilinmeyen oncelik en sona. */
export function pri(p) {
  return PRIORITY_ORDER[p] ?? 4;
}

/** Kaydin yasi (gun). Tarih yoksa "cok eski" say — basa gecmesin. */
export function daysSince(iso) {
  if (!iso) return 9999;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 9999;
  return (Date.now() - t) / 86400000;
}

/**
 * Siralama anahtari: sabitlenmis > oncelik > tazelik.
 *
 * `pinned: true` olan kayit butceden bagimsiz HER ZAMAN gorunur — kullanicinin
 * "bu hep gozumun onunde dursun" dedigi anayasa maddeleri icin kacis kapagi.
 *
 * Tazelik `updated_at` yoksa `created_at`'e duser. Ucuncu anahtar SART:
 * onceligi ayni olan kayitlar arasinda karar verilmezse kararli sort giris
 * sirasini birakir ve liste sessizce eskiye kayar.
 */
export function compareObjects(a, b) {
  const pa = a.pinned ? 0 : 1;
  const pb = b.pinned ? 0 : 1;
  if (pa !== pb) return pa - pb;

  const ra = pri(a.priority);
  const rb = pri(b.priority);
  if (ra !== rb) return ra - rb;

  return (
    daysSince(a.updated_at || a.created_at) -
    daysSince(b.updated_at || b.created_at)
  );
}

/** Yeni dizi doner — cagiranin listesini DEGISTIRMEZ. */
export function rankObjects(list) {
  return [...list].sort(compareObjects);
}
