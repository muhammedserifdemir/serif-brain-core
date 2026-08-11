// Kok CLAUDE.md'ye serif-brain ISARET BLOGU yazar.
//
// NEDEN: `context` uzun suredir `.serif-brain/context/CLAUDE.generated.md`
// uretiyordu — ama Claude Code KOK dizindeki CLAUDE.md'yi okur, o dizini degil.
// Ureteni olan, okuyani olmayan bir dosyaydi. Ayrica bu paketin ust klasorundeki
// CLAUDE.md 07.04.2026 tarihliydi ve EMEKLI `.claude/brain/journal/` sistemine
// isaret ediyordu: ajanin ilk baktigi yer, olmayan bir sisteme yonlendiriyordu.
//
// NE YAZILIR: yalnizca SABIT isaret — "burada bir hafiza var, sunu calistir".
// Aktif bug/karar listesi buraya YAZILMAZ; o SessionStart hook'undan taze gelir.
// Dosyaya yazilan bagliam yazildigi anda bayatlamaya baslar ve CLAUDE.md her
// oturuma girdigi icin bayat bilgi en pahali yerdedir.
//
// NASIL: iki isaret arasi degistirilir; disarisina DOKUNULMAZ. Kullanicinin
// kendi CLAUDE.md'si korunur.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const BEGIN = "<!-- serif-brain:begin — bu blok 'serif-brain context --claude-md' ile uretilir -->";
export const END = "<!-- serif-brain:end -->";

export function claudeMdPath(projectRoot) {
  return join(projectRoot, "CLAUDE.md");
}

export function blockText() {
  return [
    BEGIN,
    "## Proje hafizasi (serif-brain)",
    "",
    "Bu projede kararlarin/bug'larin kaydi `.serif-brain/` altinda tutulur ve kod",
    "grafina baglidir. Once hafizaya bak, sonra kod yaz.",
    "",
    "```bash",
    "serif-brain brief                 # neredeyiz: aktif plan/bug/karar + yakalanmamis commit",
    "serif-brain guard <dosya>         # DOKUNMADAN ONCE: o dosyanin kararlari, yara izleri, blast",
    "serif-brain add bug --title \"...\" --module <X>    # yasanan hata",
    "serif-brain add decision --title \"...\"            # verilen karar (ihlal edilmeyecek)",
    "serif-brain close <id> --note \"nasil cozuldu\"",
    "serif-brain capture --days 14     # commit'lerden hafizaya gecmemisleri oner",
    "```",
    "",
    "Kurulu ise kapi bunlari kendiliginden yapar (`serif-brain hooks status`).",
    "Aktif isin LISTESI buraya yazilmaz — bayatlar; oturum acilisinda taze gelir.",
    END,
  ].join("\n");
}

/** Hicbir sey yazmaz: { path, exists, state: missing|same|stale } */
export function planClaudeMd(projectRoot) {
  const path = claudeMdPath(projectRoot);
  if (!existsSync(path)) return { path, exists: false, state: "missing" };
  const raw = readFileSync(path, "utf8");
  const i = raw.indexOf(BEGIN);
  const j = raw.indexOf(END);
  if (i === -1 || j === -1 || j < i) return { path, exists: true, state: "missing" };
  const current = raw.slice(i, j + END.length);
  return { path, exists: true, state: current === blockText() ? "same" : "stale" };
}

/** Blogu yazar/gunceller. Isaretlerin DISINDAKI icerik korunur. */
export function applyClaudeMd(projectRoot) {
  const plan = planClaudeMd(projectRoot);
  if (plan.state === "same") return { ...plan, written: false };

  const block = blockText();
  let next;
  if (!plan.exists) {
    next = `${block}\n`;
  } else {
    const raw = readFileSync(plan.path, "utf8");
    const i = raw.indexOf(BEGIN);
    const j = raw.indexOf(END);
    next = (i !== -1 && j !== -1 && j > i)
      ? raw.slice(0, i) + block + raw.slice(j + END.length)
      : raw.replace(/\s*$/, "") + `\n\n${block}\n`;
  }
  writeFileSync(plan.path, next);
  return { ...plan, written: true };
}
