// Durum sozlugunun TEK KAYNAGI.
//
// NEDEN AYRI DOSYA: "hangi durum acik is sayilir" gercegi alti ayri dosyada elle
// yazilmisti (prune, stale, hotspot, touch, migrate/normalize, migrate/apply) ve
// ZATEN AYRISMISTI — olcum (2026-08-15):
//   prune:   open active in_progress blocked queued
//   stale:   open active in_progress        queued   ← blocked yok
//   hotspot: open active in_progress blocked         ← queued yok
//   touch:   open active in_progress blocked         ← queued yok
// Ayni soruya dort farkli cevap. `standing`i alti yere ayri ayri eklemek bu
// ayrismayi buyuturdu; sozluk buraya tasindi.
//
// ── standing NEDIR ──────────────────────────────────────────────────────────
// Yururlukteki KURAL / SOZLESME / INVARIANT: politika, yasak, kanonik format,
// mimari invariant, kapi sarti, urun hedefi.
//
// Neden kendi durumu var: `active` iki UYUSMAZ anlami birden tasiyordu —
// "bunun uzerinde calisiyorum" ve "bu kural yururlukte". Bu karisiklik uc seyi
// ayni anda bozuyordu:
//   1. prune yasa gore siluyordu → olcum: 83 adayin 30'u yururlukteki kuraldi
//      ("Legacy cleanup policy — silmek YASAK" kaydi arsive tasinacakti),
//   2. active-work.md okunmaz oluyordu (kural ile is ayni listede),
//   3. WIP sayaci anlamsizdi ("17 acik is"in bir kismi is degil, kural).
// Kural yaslanmaz: dokunulmamis olmasi UNUTULDUGUNU degil YERLESTIGINI gosterir.
//
// Sozlesmesi: prune'a YAKALANMAZ, WIP'e SAYILMAZ, context'te KALIR.
export const STANDING = "standing";

// Uzerinde calisilan is. `standing` BILEREK disaridadir.
export const ACIK_IS = Object.freeze(["open", "active", "in_progress", "blocked", "queued"]);

// Kapanmis/arsivlenmis. Context bunlari disarida birakir.
export const KAPALI = Object.freeze(["done", "rejected", "archived"]);

// Semanin ve init'in urettigi config'in tanidigi tum durumlar.
export const TUM_DURUMLAR = Object.freeze([...ACIK_IS, STANDING, ...KAPALI]);

// Yaslanma/temizlik taramalarina giren durumlar — `standing` burada YOKTUR.
export const acikIsKumesi = () => new Set(ACIK_IS);

export function acikIsMi(status) {
  return ACIK_IS.includes(status);
}

export function yururluktekiKuralMi(status) {
  return status === STANDING;
}
