// serif-brain MCP sunucu çekirdeği — SAF NODE, bağımlılık yok.
// JSON-RPC 2.0 isteklerini işler; stdio sarmalayıcı (cli/mcp.mjs) bunu kullanır.
// Claude Code bu sunucu üzerinden brain'i CANLI okuyabilir (search/get/context).
import { loadObjects, searchObjects, toResult } from "../query/search.mjs";
import { findRelated } from "../query/related.mjs";

const PROTOCOL_VERSION = "2024-11-05";

export const TOOLS = [
  {
    name: "brain_search",
    description:
      "Proje hafızasında (bug/decision/note/session) yapısal + tam-metin arama. " +
      "Metin sorgusu başlık+gövdede aranır; type/status/priority/module/tag ile filtrelenir.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Serbest metin sorgusu (opsiyonel)" },
        type: { type: "string", enum: ["bug", "decision", "note", "session"] },
        status: { type: "string", description: "Virgülle çoklu: open,active" },
        priority: { type: "string", description: "Virgülle çoklu: critical,high" },
        module: { type: "string" },
        tag: { type: "string" },
        limit: { type: "number", default: 10 },
      },
    },
  },
  {
    name: "brain_get",
    description: "Bir objeyi id ile getir (frontmatter + tam gövde).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "örn. decision-20260617-..." } },
      required: ["id"],
    },
  },
  {
    name: "brain_context",
    description:
      "Aktif iş bağlamı: tamamlanmamış kritik/yüksek bug'lar + aktif kararlar, " +
      "önceliğe göre sıralı. Oturum başında 'neredeyiz' özeti için.",
    inputSchema: {
      type: "object",
      properties: {
        module: { type: "string", description: "Yalnız bu modül (opsiyonel)" },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "brain_related",
    description:
      "Bir objeye OTOMATİK keşfedilen ilişkili objeler (paylaşılan modül/etiket + " +
      "metin benzerliği). Elle [[link]] gerektirmeden bilgi ağında gezinmek için.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Hedef obje id'si" },
        limit: { type: "number", default: 10 },
      },
      required: ["id"],
    },
  },
];

const ACTIVE_STATUSES = ["open", "active", "in_progress", "blocked", "queued"];

function callTool(name, a = {}, brainRoot) {
  if (name === "brain_search") {
    const objects = loadObjects(brainRoot);
    const hits = searchObjects(objects, {
      text: a.text,
      type: a.type,
      status: typeof a.status === "string" ? a.status.split(",") : undefined,
      priority: typeof a.priority === "string" ? a.priority.split(",") : undefined,
      module: a.module,
      tag: a.tag,
      limit: Number.isFinite(a.limit) ? a.limit : 10,
    });
    return JSON.stringify({ count: hits.length, results: hits.map((o) => toResult(o, { snippet: true })) }, null, 2);
  }

  if (name === "brain_get") {
    if (!a.id) throw new Error("id gerekli");
    const obj = loadObjects(brainRoot).find((o) => o.frontmatter?.id === a.id);
    if (!obj) return JSON.stringify({ found: false, id: a.id });
    return JSON.stringify({ found: true, frontmatter: obj.frontmatter, body: obj.body, file: obj.file_path }, null, 2);
  }

  if (name === "brain_context") {
    const objects = loadObjects(brainRoot);
    const active = searchObjects(objects, {
      status: ACTIVE_STATUSES,
      module: a.module,
      limit: Number.isFinite(a.limit) ? a.limit : 20,
    }).map((o) => toResult(o, { snippet: true }));
    const bugs = active.filter((r) => r.type === "bug");
    const decisions = active.filter((r) => r.type === "decision");
    return JSON.stringify({ active_bugs: bugs, active_decisions: decisions }, null, 2);
  }

  if (name === "brain_related") {
    if (!a.id) throw new Error("id gerekli");
    const all = loadObjects(brainRoot);
    const target = all.find((o) => o.frontmatter?.id === a.id);
    if (!target) return JSON.stringify({ found: false, id: a.id });
    const related = findRelated(target, all, { limit: Number.isFinite(a.limit) ? a.limit : 10 });
    return JSON.stringify({ found: true, id: a.id, related }, null, 2);
  }

  throw new Error(`bilinmeyen araç: ${name}`);
}

function reply(id, result) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id, code, message) { return { jsonrpc: "2.0", id, error: { code, message } }; }

/**
 * Tek bir JSON-RPC isteğini işle. Bildirim (id yok) ise null döner.
 * Test edilebilir: stdio'dan bağımsız.
 */
export function createBrainMcp({ brainRoot, version = "1.0.0" }) {
  function handle(req) {
    const { id, method, params } = req || {};
    if (method === "initialize") {
      return reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "serif-brain", version },
      });
    }
    if (typeof method === "string" && method.startsWith("notifications/")) return null;
    if (method === "ping") return reply(id, {});
    if (method === "tools/list") return reply(id, { tools: TOOLS });
    if (method === "tools/call") {
      try {
        const text = callTool(params?.name, params?.arguments || {}, brainRoot);
        return reply(id, { content: [{ type: "text", text }] });
      } catch (e) {
        return reply(id, { content: [{ type: "text", text: `Hata: ${e.message}` }], isError: true });
      }
    }
    if (id !== undefined && id !== null) return rpcError(id, -32601, `Method not found: ${method}`);
    return null;
  }
  return { handle };
}
