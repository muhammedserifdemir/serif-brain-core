// serif-brain MCP sunucu çekirdeği — SAF NODE, bağımlılık yok.
// JSON-RPC 2.0 isteklerini işler; stdio sarmalayıcı (cli/mcp.mjs) bunu kullanır.
// Claude Code bu sunucu üzerinden brain'i CANLI okuyabilir (search/get/context).
import { searchObjects, toResult } from "../query/search.mjs";
// MCP uzun-omurlu process → obje cache'i (mtime-invalidation). loadObjects'i
// cache'li surumle alias'la: tum cagri yerleri otomatik hizlanir, asla bayat olmaz.
import { loadObjectsCached as loadObjects, invalidateObjectCache } from "../query/object-cache.mjs";
import { findRelated } from "../query/related.mjs";
import { compileBrief } from "../query/brief.mjs";
import { compileTouch } from "../query/touch.mjs";
import { computeImpact, resolveFileNode } from "../query/impact.mjs";
import { computeHotspots } from "../query/hotspot.mjs";
import { findLayerViolations } from "../query/layers.mjs";
import { checkFile } from "../query/check.mjs";
import { lintContent } from "../query/signatures.mjs";
import { readFileSafe } from "../scanner/scan-files.mjs";
import { scoreRisk } from "../query/risk.mjs";
import { clusterBugs } from "../query/cluster.mjs";
import { gatherGuard } from "../query/guard.mjs";
import { ownerOfConfigured, resolveModule } from "../scanner/module-owner.mjs";
import { loadConfig } from "../markdown/schema.mjs";
import { createObject, closeObject } from "../markdown/write-ops.mjs";
import { getRecentCommits } from "../query/git-activity.mjs";
import { modulesOf } from "../query/search.mjs";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

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
    name: "brain_brief",
    description:
      "Oturum-açılışı brief'i: aktif kritik/yüksek bug + aktif kararlar + son " +
      "dokunulan kalemler + PARK (queued) faz kuyruğu. brain_context'ten zengin; " +
      "her oturum başında 'neredeydik + sırada ne var' için tek çağrı.",
    inputSchema: {
      type: "object",
      properties: {
        module: { type: "string", description: "Yalnız bu modül (opsiyonel)" },
        days: { type: "number", description: "Son-dokunulan penceresi (gün, default 7)" },
        limit: { type: "number", default: 5 },
      },
    },
  },
  {
    name: "brain_impact",
    description:
      "Canlı blast-radius: bir dosyayı değiştirirsem ne kırılır? Geçişli bağımlılar " +
      "(kim import ediyor) + etkilenen modüller + o modülün hafızası. graph build gerektirir.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Dosya yolu (proje-göreli)" } },
      required: ["path"],
    },
  },
  {
    name: "brain_hotspot",
    description:
      "Tehlike bölgesi: git churn × merkezilik (bağımlı sayısı) + modül bug yoğunluğu " +
      "füzyonu. 'Bug nerede / nereye dikkat' için sıralı liste. graph build + git gerektirir.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Churn penceresi (gün, default 30)" },
        limit: { type: "number", default: 15 },
      },
    },
  },
  {
    name: "brain_layers",
    description:
      "Mimari katman ihlalleri: config layer_rules'a göre yasak import'lar (ör. ui→db). graph build gerektirir.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "brain_check",
    description:
      "PostEdit graf sağlığı (tek dosya): katman ihlali + döngü (circular import) + god-file. graph build gerektirir.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Dosya yolu (proje-göreli)" } },
      required: ["path"],
    },
  },
  {
    name: "brain_lint",
    description:
      "Projeye-özel bug imza linter: config bug_signatures'ı bir dosyaya karşı tarar " +
      "(geçmiş hataların 'şekli'). Generic linter'ın görmediği domain bug'ları için.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Dosya yolu (proje-göreli)" } },
      required: ["path"],
    },
  },
  {
    name: "brain_risk",
    description:
      "Tek dosya edit-anı risk skoru: churn + merkezilik + modül/dosya bug geçmişi + " +
      "imza eşleşmeleri füzyonu → low/medium/high/critical. 'Bu dosyaya dikkatli mi olayım?'",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Dosya yolu (proje-göreli)" }, days: { type: "number" } },
      required: ["path"],
    },
  },
  {
    name: "brain_cluster",
    description:
      "Bug'ları benzerliğe göre grupla (paylaşılan modül/etiket + metin) — olası aynı-kök-neden " +
      "kümeleri. Tek tek değil kökten çözmek için.",
    inputSchema: { type: "object", properties: { threshold: { type: "number", default: 5 } } },
  },
  {
    name: "brain_guard",
    description:
      "Edit-ÖNCESİ BİRLEŞİK brifing (tek çağrı = touch+impact+risk+lint): verdict + ihlal " +
      "etme kararları + açık bug + yara izi + blast-radius + imza eşleşmeleri. Bir dosyayı " +
      "değiştirmeden önce 'bilmem gereken her şey'. graph build + git ile en zengin.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Dosya yolu (proje-göreli)" }, days: { type: "number" } },
      required: ["path"],
    },
  },
  {
    name: "brain_touch",
    description:
      "Bir dosyaya DOKUNMADAN ÖNCE ilgili hafıza: o dosyaya doğrudan bağlı + " +
      "modülüne ait kararlar (ihlal etme) ve bug'lar (çözülmüş 'yara izi' dahil). " +
      "Edit öncesi regresyonu önlemek için.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Dosya yolu (proje-göreli)" },
        module: { type: "string", description: "Modülü doğrudan ver (path yoksa)" },
        limit: { type: "number", default: 6 },
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
  // ── YAZMA araclari ────────────────────────────────────────────────────────
  // Sunucu uzun sure SALT-OKUNURDU (14 okuma araci, 0 yazma). Sonuc: oturum
  // icinde ogrenilen sey ancak insan "kaydet" derse hafizaya geciyordu; ajan
  // okuyabiliyor ama yazamiyordu. Yazma mantigi CLI ile ORTAK
  // (markdown/write-ops.mjs) — iki kopya "CLI'da calisti, MCP'de baska sey
  // yazdi" demektir.
  {
    name: "brain_add",
    description:
      "Hafizaya yeni kayit yaz: bug (yasanan hata), decision (verilen karar), " +
      "plan (yol haritasi), record (yapilmis is, status:done dogar). " +
      "Oturumda ogrenilen sey buraya yazilmazsa bir sonraki oturumda YOKTUR.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["bug", "decision", "plan", "record"] },
        title: { type: "string", description: "Tek cumlelik baslik (id bundan turer)" },
        module: { type: "string", description: "config.valid_modules'ten biri" },
        priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
        severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
        status: { type: "string", description: "Verilmezse tipe gore varsayilan" },
        tags: { type: "array", items: { type: "string" } },
        files: { type: "array", items: { type: "string" }, description: "Ilgili dosyalar; verilmezse git'ten doldurulur" },
        project_id: { type: "string" },
      },
      required: ["type", "title"],
    },
  },
  {
    name: "brain_close",
    description:
      "Bir bug/decision/plan kaydini kapat (status → done, completed_at bugun). " +
      "note verilirse govdeye 'Tamamlanma' bolumu eklenir. project_id yalniz id " +
      "birden fazla projede varsa gerekir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        note: { type: "string", description: "Nasil cozuldu — kapanis gerekcesi" },
        commit: { type: "string" },
        project_id: { type: "string" },
        force: { type: "boolean" },
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

  if (name === "brain_brief") {
    const objects = loadObjects(brainRoot);
    const brief = compileBrief(objects, {
      module: a.module,
      days: Number.isFinite(a.days) ? a.days : 7,
      limit: Number.isFinite(a.limit) ? a.limit : 5,
      git: null, // MCP saf-hafıza brief'i; git sinyali CLI/hook tarafında
    });
    return JSON.stringify(brief, null, 2);
  }

  if (name === "brain_impact") {
    if (!a.path) throw new Error("path gerekli");
    const graphPath = join(brainRoot, "graph", "graph.json");
    if (!existsSync(graphPath)) {
      return JSON.stringify({ found: false, error: "graph.json yok — once 'serif-brain graph build'" });
    }
    const graph = JSON.parse(readFileSync(graphPath, "utf8"));
    const node = resolveFileNode(graph, a.path);
    if (!node) return JSON.stringify({ found: false, path: a.path });
    const im = computeImpact(graph, node.id);
    const module = resolveModule(node.module, a.path, loadConfig(brainRoot));
    const memory = compileTouch(loadObjects(brainRoot), { relPath: a.path, module });
    // module: grafin ham degeri degil, config ile birlestirilmis olan (CLI ile ayni).
    return JSON.stringify({ ...im, module, memory: memory.empty ? null : memory }, null, 2);
  }

  if (name === "brain_hotspot") {
    const graphPath = join(brainRoot, "graph", "graph.json");
    if (!existsSync(graphPath)) {
      return JSON.stringify({ error: "graph.json yok — once 'serif-brain graph build'" });
    }
    const graph = JSON.parse(readFileSync(graphPath, "utf8"));
    const days = Number.isFinite(a.days) ? a.days : 30;
    const projectRoot = dirname(brainRoot);
    const churn = new Map();
    for (const c of getRecentCommits(projectRoot, days)) {
      for (const f of c.files || []) churn.set(f, (churn.get(f) || 0) + 1);
    }
    const openBugsByModule = new Map();
    for (const o of loadObjects(brainRoot)) {
      const fm = o.frontmatter || {};
      if (fm.type !== "bug" || !["open", "active", "in_progress", "blocked"].includes(fm.status)) continue;
      for (const m of modulesOf(fm)) openBugsByModule.set(m, (openBugsByModule.get(m) || 0) + 1);
    }
    const rows = computeHotspots(graph, { churn, openBugsByModule, limit: Number.isFinite(a.limit) ? a.limit : 15 });
    return JSON.stringify({ days, count: rows.length, hotspots: rows }, null, 2);
  }

  if (name === "brain_layers") {
    const graphPath = join(brainRoot, "graph", "graph.json");
    if (!existsSync(graphPath)) return JSON.stringify({ error: "graph.json yok — once 'serif-brain graph build'" });
    const graph = JSON.parse(readFileSync(graphPath, "utf8"));
    const rules = loadConfig(brainRoot)?.layer_rules || [];
    const violations = findLayerViolations(graph, rules);
    return JSON.stringify({ rule_count: rules.length, count: violations.length, violations }, null, 2);
  }

  if (name === "brain_check") {
    if (!a.path) throw new Error("path gerekli");
    const graphPath = join(brainRoot, "graph", "graph.json");
    if (!existsSync(graphPath)) return JSON.stringify({ found: false, error: "graph.json yok — once 'serif-brain graph build'" });
    const graph = JSON.parse(readFileSync(graphPath, "utf8"));
    const node = resolveFileNode(graph, a.path);
    if (!node) return JSON.stringify({ found: false, path: a.path });
    const cfg = loadConfig(brainRoot);
    return JSON.stringify(checkFile(graph, node.id, { rules: cfg?.layer_rules || [], god_threshold: cfg?.god_threshold }), null, 2);
  }

  if (name === "brain_lint") {
    if (!a.path) throw new Error("path gerekli");
    const signatures = loadConfig(brainRoot)?.bug_signatures || [];
    const abs = join(dirname(brainRoot), a.path);
    const text = readFileSafe(abs);
    const findings = lintContent(a.path, text, signatures);
    return JSON.stringify({ signatures: signatures.length, count: findings.length, findings }, null, 2);
  }

  if (name === "brain_guard") {
    if (!a.path) throw new Error("path gerekli");
    const g = gatherGuard({
      projectRoot: dirname(brainRoot),
      brainRoot,
      relPath: a.path,
      days: Number.isFinite(a.days) ? a.days : 30,
    });
    return JSON.stringify(g, null, 2);
  }

  if (name === "brain_risk") {
    if (!a.path) throw new Error("path gerekli");
    const relPath = a.path;
    const projectRoot = dirname(brainRoot);
    const cfg = loadConfig(brainRoot);
    const days = Number.isFinite(a.days) ? a.days : 30;

    let churn = 0;
    for (const c of getRecentCommits(projectRoot, days)) if ((c.files || []).includes(relPath)) churn++;

    let dependents = 0;
    const graphPath = join(brainRoot, "graph", "graph.json");
    if (existsSync(graphPath)) {
      const graph = JSON.parse(readFileSync(graphPath, "utf8"));
      const node = resolveFileNode(graph, relPath);
      if (node) dependents = computeImpact(graph, node.id).direct_dependents.length;
    }
    const module = ownerOfConfigured(relPath, cfg);
    const mem = compileTouch(loadObjects(brainRoot), { relPath, module });
    const moduleOpenBugs = mem.module_bugs.filter((b) => !b.closed).length;
    const fileBugHistory = mem.file_hits.filter((h) => h.type === "bug").length;
    const sigHits = lintContent(relPath, readFileSafe(join(projectRoot, relPath)), cfg?.bug_signatures || []).length;

    const r = scoreRisk({ churn, dependents, module_open_bugs: moduleOpenBugs, file_bug_history: fileBugHistory, signature_hits: sigHits });
    return JSON.stringify({ file: relPath, module, ...r }, null, 2);
  }

  if (name === "brain_cluster") {
    const bugs = loadObjects(brainRoot).filter((o) => o.frontmatter?.type === "bug");
    const clusters = clusterBugs(bugs, { threshold: Number.isFinite(a.threshold) ? a.threshold : 5 });
    return JSON.stringify({ bugs: bugs.length, clusters: clusters.length, groups: clusters }, null, 2);
  }

  if (name === "brain_touch") {
    const objects = loadObjects(brainRoot);
    const relPath = a.path || null;
    const module =
      (typeof a.module === "string" && a.module) ||
      (relPath ? ownerOfConfigured(relPath, loadConfig(brainRoot)) : null);
    const t = compileTouch(objects, { relPath, module, limit: Number.isFinite(a.limit) ? a.limit : 6 });
    return JSON.stringify(t, null, 2);
  }

  if (name === "brain_related") {
    if (!a.id) throw new Error("id gerekli");
    const all = loadObjects(brainRoot);
    const target = all.find((o) => o.frontmatter?.id === a.id);
    if (!target) return JSON.stringify({ found: false, id: a.id });
    const related = findRelated(target, all, { limit: Number.isFinite(a.limit) ? a.limit : 10 });
    return JSON.stringify({ found: true, id: a.id, related }, null, 2);
  }

  // ── YAZMA ─────────────────────────────────────────────────────────────────
  if (name === "brain_add") {
    const r = createObject({
      brainRoot,
      projectRoot: dirname(brainRoot),
      config: loadConfig(brainRoot),
      type: a.type,
      title: a.title,
      module: a.module,
      priority: a.priority,
      severity: a.severity,
      status: a.status,
      tags: a.tags,
      files: Array.isArray(a.files) ? a.files : null,
      projectId: a.project_id || null,
    });
    // Yazma araclarinda hata SESSIZ kalmamali — ajan yazdigini sanip devam
    // ederse kayit hicbir zaman olusmaz. Hata JSON-RPC hatasina cevrilir.
    if (!r.ok) throw new Error(r.suggestId ? `${r.error} (alternatif id: ${r.suggestId})` : r.error);
    // MCP uzun-omurlu process: obje cache'i yeni dosyayi gormeli.
    invalidateObjectCache(brainRoot);
    return JSON.stringify(r, null, 2);
  }

  if (name === "brain_close") {
    const r = closeObject({
      brainRoot,
      id: a.id,
      projectId: a.project_id || null,
      note: a.note || null,
      commit: a.commit || null,
      force: !!a.force,
    });
    if (!r.ok) throw new Error(r.error);
    invalidateObjectCache(brainRoot);
    return JSON.stringify(r, null, 2);
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
