// Dashboard registry — hangi brain'lerin izleneceğini ve kullanıcı override'larını
// merkezi tek dosyada tutar: ~/.serif-brain-registry.json
// (SERIF_BRAIN_REGISTRY env ile değiştirilebilir). Brain objelerine DOKUNMAZ.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";

export function registryPath() {
  return process.env.SERIF_BRAIN_REGISTRY || join(homedir(), ".serif-brain-registry.json");
}

export function loadRegistry() {
  const p = registryPath();
  if (!existsSync(p)) return { schema: 1, brains: [] };
  try {
    const r = JSON.parse(readFileSync(p, "utf8"));
    if (!Array.isArray(r.brains)) r.brains = [];
    return r;
  } catch {
    return { schema: 1, brains: [] };
  }
}

export function saveRegistry(reg) {
  writeFileSync(registryPath(), JSON.stringify(reg, null, 2));
  return registryPath();
}

/** Proje kökü (repo) → brain root. Var olduğunu doğrular. */
export function brainRootOf(repo) {
  const r = resolve(repo);
  // kullanıcı ister repo kökü ister doğrudan .serif-brain verebilir
  if (basename(r) === ".serif-brain") return r;
  return join(r, ".serif-brain");
}

export function repoOf(brainRoot) {
  return resolve(brainRoot, "..");
}

/** Registry'ye bir brain ekle/güncelle. entry: {repo, name?, override?, archived?} */
export function upsertBrain(reg, entry) {
  const brainRoot = brainRootOf(entry.repo);
  const repo = repoOf(brainRoot);
  const idx = reg.brains.findIndex((b) => brainRootOf(b.repo) === brainRoot);
  const base = idx >= 0 ? reg.brains[idx] : { repo, override: {}, archived: false };
  const merged = {
    ...base,
    repo,
    name: entry.name ?? base.name ?? basename(repo),
    archived: entry.archived ?? base.archived ?? false,
    override: { ...(base.override || {}), ...(entry.override || {}) },
  };
  if (idx >= 0) reg.brains[idx] = merged;
  else reg.brains.push(merged);
  return merged;
}

export function findBrain(reg, nameOrRepo) {
  const q = String(nameOrRepo).toLowerCase();
  return reg.brains.find(
    (b) => (b.name && b.name.toLowerCase() === q) ||
           basename(resolve(b.repo)).toLowerCase() === q ||
           resolve(b.repo).toLowerCase() === resolve(nameOrRepo).toLowerCase()
  );
}
