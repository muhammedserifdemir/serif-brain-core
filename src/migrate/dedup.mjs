// Duplicate detection — title + module + (date) + type cluster + vault_ref pointer.
import { createHash } from "node:crypto";

function normTitle(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function modKey(m) {
  if (Array.isArray(m)) return [...m].sort().join(",");
  return String(m || "");
}

function clusterKey(c) {
  // Same type + same project + same normalized title + same date → likely duplicate
  const t = c.proposed.type || "";
  const p = c.proposed.project || "";
  const title = normTitle(c.proposed.title);
  const date = (c.proposed.created_at || "").slice(0, 10); // YYYY-MM-DD
  return `${t}::${p}::${title}::${date}`;
}

// Specifically for legacy YAML decisions with vault_ref pointing to Obsidian file
function vaultRefKey(c) {
  if (c.vault_ref) {
    // Match basename of the obsidian file
    const base = c.vault_ref.split("/").pop() || "";
    return base.replace(/\.md$/, "");
  }
  return null;
}

export function detectDuplicates(candidates) {
  const clusters = new Map(); // key -> [candidates]
  const obsidianByBasename = new Map(); // basename(no .md) -> obsidian candidate

  for (const c of candidates) {
    if (c.error) continue;
    if (c.source.kind === "obsidian" && c.file_basename) {
      const base = c.file_basename.replace(/\.md$/, "");
      obsidianByBasename.set(base, c);
    }
  }

  // Cluster by primary key
  for (const c of candidates) {
    if (c.error) continue;
    const key = clusterKey(c);
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(c);
  }

  // Additional cluster: legacy YAML decisions with vault_ref → match obsidian
  for (const c of candidates) {
    if (c.error) continue;
    const vk = vaultRefKey(c);
    if (vk && obsidianByBasename.has(vk)) {
      // Force same cluster as the obsidian one
      const obsidian = obsidianByBasename.get(vk);
      const obsKey = clusterKey(obsidian);
      const myKey = clusterKey(c);
      if (myKey !== obsKey) {
        // Move c into obsidian's cluster
        const myCluster = clusters.get(myKey) || [];
        const newMyCluster = myCluster.filter(x => x !== c);
        if (newMyCluster.length === 0) clusters.delete(myKey);
        else clusters.set(myKey, newMyCluster);
        if (!clusters.has(obsKey)) clusters.set(obsKey, []);
        clusters.get(obsKey).push(c);
      }
    }
  }

  // Tag each candidate with its cluster info
  let clusterId = 0;
  const dupGroups = [];
  for (const [key, list] of clusters) {
    if (list.length <= 1) continue;
    const id = `dup-${++clusterId}`;
    for (const c of list) {
      c.dedup_cluster = id;
    }
    dupGroups.push({
      cluster_id: id,
      key,
      members: list.map(c => ({
        source_kind: c.source.kind,
        source_path: c.source.path,
        title: c.proposed.title,
        date: c.proposed.created_at,
        status: c.proposed.status,
        type: c.proposed.type
      }))
    });
  }

  return { clusters, dup_groups: dupGroups };
}

export function pickRepresentative(cluster) {
  // Tercih sirasi: obsidian (richer body) > legacy_yaml > diger
  const order = { obsidian: 0, legacy_yaml: 1, graphify: 2 };
  return [...cluster].sort((a, b) => (order[a.source.kind] ?? 99) - (order[b.source.kind] ?? 99))[0];
}
