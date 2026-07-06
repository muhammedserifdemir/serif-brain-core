// Proje köküne bakarak dashboard meta-verisini OTOMATİK tespit eder:
// port, çalıştırma komutu, prereq (db/redis), son git aktivitesi.
// Manifest override'ı yoksa bu tahminler kullanılır. Saf-Node.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function readEnvPorts(repo) {
  const ports = new Set();
  for (const f of [".env", ".env.local"]) {
    const p = join(repo, f);
    if (!existsSync(p)) continue;
    const txt = readFileSync(p, "utf8");
    for (const m of txt.matchAll(/(?:PORT|:)\s*[=:]?\s*(\d{4})/g)) ports.add(m[1]);
    for (const m of txt.matchAll(/localhost:(\d{4})/g)) ports.add(m[1]);
  }
  return [...ports];
}

function detectPrereqs(repo) {
  const pre = [];
  for (const f of [".env", ".env.local"]) {
    const p = join(repo, f);
    if (!existsSync(p)) continue;
    const txt = readFileSync(p, "utf8");
    if (/postgres(ql)?:\/\/|DATABASE_URL/i.test(txt)) {
      const m = txt.match(/postgres(?:ql)?:\/\/[^\s"']*?:(\d{4,5})/i);
      pre.push(m ? `pg:${m[1]}` : "postgres");
    }
    if (/redis:\/\//i.test(txt)) {
      const m = txt.match(/redis:\/\/[^\s"']*?:(\d{4,5})/i);
      pre.push(m ? `redis:${m[1]}` : "redis");
    }
  }
  if (existsSync(join(repo, "docker-compose.yml")) || existsSync(join(repo, "docker-compose.yaml"))) {
    if (!pre.length) pre.push("docker-compose");
  }
  return [...new Set(pre)];
}

// "next dev -p 3001" / "vite --port 3000" → port çıkar
function portFromScript(s) {
  if (!s) return null;
  const m = s.match(/(?:-p|--port)[ =]+(\d{4})/);
  return m ? m[1] : null;
}

export function gitActivity(repo) {
  try {
    const out = execFileSync("git", ["-C", repo, "log", "-1", "--format=%ct"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const sec = parseInt(out, 10);
    if (!Number.isFinite(sec)) return { ms: 0, hasGit: true };
    return { ms: sec * 1000, hasGit: true };
  } catch {
    return { ms: 0, hasGit: false };
  }
}

/** Proje kökünü tara, dashboard meta tahminini döndür. */
export function detectProject(repo) {
  const pkg = readJson(join(repo, "package.json"));
  const dev = pkg?.scripts?.dev || "";
  // Uygulama portu: önce dev script'inden (en güvenilir). Yoksa .env portları
  // (db/redis portlarını ayıkla — onlar prereq), yoksa framework varsayılanı.
  let port = portFromScript(dev);
  if (!port) {
    const envP = readEnvPorts(repo).filter((p) => !["5432", "5433", "6379", "1025", "8025"].includes(p));
    if (envP.length) port = envP[0];
    else if (/\bvite\b/.test(dev)) port = "5173";
    else if (/\bnext\b/.test(dev)) port = "3000";
  }

  return {
    name: pkg?.name || null,
    run: dev || (pkg?.scripts?.start ? "npm start" : ""),
    port: port || "—",
    prereqs: detectPrereqs(repo),
    git: gitActivity(repo),
  };
}
