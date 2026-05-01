// Store engine secimi: node:sqlite > JSONL fallback
// Native dependency yok; Node 22.5+ varsa SQLite, yoksa JSONL.

const MIN_SQLITE_NODE_MAJOR = 22;
const MIN_SQLITE_NODE_MINOR = 5;

export async function detectStoreEngine() {
  const nodeVersion = process.versions.node;
  const [major, minor] = nodeVersion.split(".").map(Number);

  const versionOk =
    major > MIN_SQLITE_NODE_MAJOR ||
    (major === MIN_SQLITE_NODE_MAJOR && minor >= MIN_SQLITE_NODE_MINOR);

  if (!versionOk) {
    return {
      engine: "jsonl",
      reason: `Node ${nodeVersion} < ${MIN_SQLITE_NODE_MAJOR}.${MIN_SQLITE_NODE_MINOR}, node:sqlite unavailable`,
      node_version: nodeVersion,
      sqlite_available: false
    };
  }

  try {
    const sqlite = await import("node:sqlite");
    const db = new sqlite.DatabaseSync(":memory:");
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)");
    db.prepare("INSERT INTO t (v) VALUES (?)").run("smoke-test");
    const row = db.prepare("SELECT v FROM t WHERE id=1").get();
    db.close();
    if (row?.v !== "smoke-test") throw new Error("smoke test failed");
    return {
      engine: "node:sqlite",
      reason: `Node ${nodeVersion} >= ${MIN_SQLITE_NODE_MAJOR}.${MIN_SQLITE_NODE_MINOR}, smoke test passed`,
      node_version: nodeVersion,
      sqlite_available: true
    };
  } catch (err) {
    return {
      engine: "jsonl",
      reason: `node:sqlite import/smoke failed: ${err.message}`,
      node_version: nodeVersion,
      sqlite_available: false
    };
  }
}
