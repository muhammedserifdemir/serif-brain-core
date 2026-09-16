# Yayın zinciri — serif-brain-core

Bu paket **git üzerinden kurulur**, npm'e yayınlanmaz (`package.json` → `"private": true`;
karar sahibindir, kaldırılmadı). "Yayın" = etiketli commit + CHANGELOG.

## Sıra (her sürümde aynı)
1. **Test** — `npm test` yeşil (396). `belge-dogrulugu` README'deki test sayısını
   denetler; sayı değiştiyse `README.md` / `README.tr.md` / `docs/GELISTIRME-PLANI.md`
   güncellenir, yoksa test kırmızı.
2. **Sürüm** — `package.json` `version` (SemVer: kırık davranış → major, yeni
   özellik → minor, düzeltme → patch). `npm version` KULLANMA: otomatik commit +
   tag atar, CHANGELOG'dan önce.
3. **CHANGELOG** — `## [X.Y.Z] — YYYY-MM-DD` bölümü, `git log vÖNCEKİ..HEAD` taranarak;
   başlıklar: Eklendi / Değiştirildi / Düzeltildi / Test. Her madde "neden" taşır
   (ölçüm ya da gözlem), yalnız "ne" değil.
4. **Commit** — `chore(release): vX.Y.Z` (CHANGELOG + package.json birlikte).
5. **Tag** — `git tag -a vX.Y.Z -m "vX.Y.Z"` → `git push origin main --tags`.
   (Tag ve push sahibin onayıyla; ajan tek başına atmaz.)
6. **Doğrulama** — temiz klonda:
   ```bash
   git clone <repo> /tmp/sbc && cd /tmp/sbc && node bin/serif-brain.mjs --help && node bin/serif-brain.mjs doctor
   ```
   Paket yazarının makine düzenine bağlı yol kalmadığının kanıtı bu adımdır
   (`grep -rn Desktop src/` yalnız koşullu `varsayilanKok`/`dashboardKaynagi` bloklarını göstermeli).
7. **Kurulum tarafı** — kullanıcılar `git pull` + `serif-brain skills update`;
   `serif-brain --version` hangi kopyanın çalıştığını basar.

## Yayınlanmayanlar
- `private: true` kalır → `npm publish` reddedilir; `prepublishOnly` testi yine de bağlıdır.
- `dashboard app` (Electron) ayrı pakettir; çekirdek sıfır bağımlılık garantisini korur.
