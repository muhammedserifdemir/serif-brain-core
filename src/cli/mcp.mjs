// serif-brain mcp — MCP sunucusunu stdio (newline-delimited JSON-RPC) üzerinden çalıştırır.
// Claude Code .mcp.json'a şöyle eklenir:
//   { "serif-brain": { "command": "node",
//       "args": ["<...>/bin/serif-brain.mjs", "mcp", "--project", "<proje-kökü>"] } }
// KRİTİK: stdout SADECE JSON-RPC içindir; tüm loglar stderr'e gider.
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { createBrainMcp } from "../mcp/server.mjs";

export async function mcpCommand({ args }) {
  const projectRoot = resolve(args.flags.project || process.cwd());
  const brainRoot = join(projectRoot, ".serif-brain");
  if (!existsSync(brainRoot)) {
    process.stderr.write(`[serif-brain mcp] Brain root yok: ${brainRoot}\n`);
    return 1;
  }
  const server = createBrainMcp({ brainRoot });
  process.stderr.write(`[serif-brain mcp] hazır — brain: ${brainRoot}\n`);

  let buf = "";
  process.stdin.setEncoding("utf8");

  const writeMsg = (msg) => {
    if (msg) process.stdout.write(JSON.stringify(msg) + "\n");
  };

  process.stdin.on("data", (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let req;
      try {
        req = JSON.parse(line);
      } catch {
        writeMsg({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
        continue;
      }
      try {
        writeMsg(server.handle(req));
      } catch (e) {
        writeMsg({ jsonrpc: "2.0", id: req?.id ?? null, error: { code: -32603, message: String(e?.message || e) } });
      }
    }
  });

  // stdin kapanana kadar yaşa.
  await new Promise((res) => process.stdin.on("end", res));
  return 0;
}
