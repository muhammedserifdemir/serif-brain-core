// "Son bakisimdan beri ne oldu?" — devralinan oturumun ILK sorusu; brief'te
// karsiligi yoktu. Sabit `--days 7` penceresi bu soruya CEVAP DEGILDIR: iki gun
// ara verdiysen zaten bildiklerini tekrar gosterir, bir hafta ara verdiysen
// kacirdigini hic gostermez.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLastSeen, stampLastSeen, diffSince } from "../src/query/since.mjs";

const iso = (gunOnce) => new Date(Date.now() - gunOnce * 86400000).toISOString();
const obj = (fm) => ({ frontmatter: fm });

function mkBrain() {
  const brainRoot = join(mkdtempSync(join(tmpdir(), "sbc-since-")), ".serif-brain");
  mkdirSync(brainRoot, { recursive: true });
  return brainRoot;
}

test("isaret: yokken null, damgalandiktan sonra okunur", () => {
  const brainRoot = mkBrain();
  assert.equal(readLastSeen(brainRoot), null, "hic bakilmamis brain'de isaret olmamali");
  assert.equal(stampLastSeen(brainRoot), true);
  assert.ok(Date.parse(readLastSeen(brainRoot)) > 0);
});

test("diffSince: isaret yoksa null (ILK bakista 'hicbir sey olmadi' DEMEZ)", () => {
  assert.equal(diffSince([obj({ id: "bug-1", created_at: iso(1) })], null), null);
});

test("diffSince: isaretten SONRA olusan kayit yeni sayilir, oncesi sayilmaz", () => {
  const d = diffSince([
    obj({ id: "bug-yeni", type: "bug", title: "yeni", created_at: iso(1) }),
    obj({ id: "bug-eski", type: "bug", title: "eski", created_at: iso(30) }),
  ], iso(7));
  assert.equal(d.yeni_kayit, 1);
  assert.deepEqual(d.ornek_yeni.map(x => x.id), ["bug-yeni"]);
});

test("diffSince: AYNI GUN kapatilan kayit 'kapanmadi' gorunmez (gun hassasiyeti tuzagi)", () => {
  // completed_at YYYY-MM-DD'dir → gece yarisi olarak parse edilir. Isaret o
  // gunun ogleninde konmussa naif karsilastirma kaydi kacirir.
  const bugun = new Date().toISOString().slice(0, 10);
  const d = diffSince(
    [obj({ id: "bug-1", type: "bug", title: "bugun kapandi", created_at: iso(10), completed_at: bugun })],
    new Date().toISOString(),
  );
  assert.equal(d.kapanan_kayit, 1);
});

test("diffSince: hicbir sey olmadiysa sessiz:true (kapi bunu gorunce SUSAR)", () => {
  const d = diffSince([obj({ id: "bug-1", created_at: iso(30) })], iso(1));
  assert.equal(d.sessiz, true);
  assert.equal(d.commit, 0);
});

test("diffSince: commit sayisi disaridan gelir (saf fonksiyon, git'e kendisi bakmaz)", () => {
  const d = diffSince([], iso(2), { commits: [{ hash: "a" }, { hash: "b" }] });
  assert.equal(d.commit, 2);
  assert.equal(d.sessiz, false, "kayit yok ama commit varsa sessiz DEGIL");
});

test("diffSince: bir kayit hem yeni hem kapanan sayilmaz (cift sayim yok)", () => {
  const bugun = new Date().toISOString().slice(0, 10);
  const d = diffSince([obj({ id: "b", type: "bug", title: "t", created_at: iso(0.1), completed_at: bugun })], iso(1));
  assert.equal(d.yeni_kayit + d.kapanan_kayit, 1);
});
