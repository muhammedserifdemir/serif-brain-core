// Self-contained HTML graph viewer for Serif Brain graph.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function writeGraphViewer(brainRoot) {
  const graphPath = join(brainRoot, "graph", "graph.json");
  if (!existsSync(graphPath)) {
    throw new Error(`graph.json missing — run 'serif-brain graph build' first`);
  }

  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  const htmlPath = join(brainRoot, "graph", "graph-viewer.html");
  writeFileSync(htmlPath, renderViewerHtml(graph));
  return htmlPath;
}

function renderViewerHtml(graph) {
  const data = JSON.stringify(graph).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Serif Brain Graph</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070912;
      --panel: #111522;
      --panel-2: #171b2b;
      --line: #252b3d;
      --text: #e8ecf7;
      --muted: #9299ad;
      --accent: #34d5ff;
      --danger: #ff657a;
      --warn: #ffcc66;
      --ok: #42d392;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 13px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    }
    .app {
      display: grid;
      grid-template-columns: 320px 1fr 360px;
      height: 100vh;
      min-width: 980px;
    }
    aside {
      background: var(--panel);
      border-right: 1px solid var(--line);
      min-height: 0;
      overflow: auto;
    }
    .right {
      border-right: 0;
      border-left: 1px solid var(--line);
    }
    main {
      position: relative;
      min-width: 0;
      min-height: 0;
      background:
        radial-gradient(circle at 50% 45%, rgba(52, 213, 255, 0.12), transparent 34%),
        linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0));
    }
    header {
      padding: 16px;
      border-bottom: 1px solid var(--line);
      background: rgba(17, 21, 34, 0.92);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    h1, h2, h3 { margin: 0; letter-spacing: 0; }
    h1 { font-size: 18px; }
    h2 { font-size: 12px; color: var(--muted); text-transform: uppercase; margin: 18px 0 8px; }
    h3 { font-size: 14px; margin-bottom: 6px; }
    .sub { color: var(--muted); margin-top: 4px; font-size: 12px; }
    .controls { padding: 14px 16px 18px; }
    input, select {
      width: 100%;
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #090d18;
      color: var(--text);
      padding: 0 10px;
      margin-bottom: 10px;
      outline: none;
    }
    input:focus, select:focus { border-color: var(--accent); }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
    }
    .stat {
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
    }
    .stat strong { display: block; font-size: 18px; }
    .stat span { color: var(--muted); font-size: 11px; text-transform: uppercase; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      border: 1px solid var(--line);
      background: var(--panel-2);
      color: var(--text);
      border-radius: 999px;
      padding: 5px 9px;
      cursor: pointer;
      user-select: none;
      font-size: 12px;
    }
    .chip.active { border-color: var(--accent); color: var(--accent); }
    .list { padding: 0 16px 24px; }
    .row {
      border-bottom: 1px solid rgba(255,255,255,0.06);
      padding: 9px 0;
      cursor: pointer;
    }
    .row:hover { color: var(--accent); }
    .row small { display: block; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    svg { width: 100%; height: 100%; display: block; }
    .edge { stroke: rgba(154, 164, 190, 0.22); stroke-width: 1; }
    .edge.hot { stroke: rgba(52, 213, 255, 0.52); stroke-width: 1.6; }
    .node { cursor: pointer; }
    .node circle { stroke: rgba(255,255,255,0.55); stroke-width: 1; }
    .node text { fill: var(--text); paint-order: stroke; stroke: rgba(7,9,18,0.92); stroke-width: 4px; font-size: 10px; pointer-events: none; }
    .node.dim { opacity: 0.18; }
    .edge.dim { opacity: 0.06; }
    .toolbar {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      pointer-events: none;
    }
    .badge {
      pointer-events: auto;
      background: rgba(17, 21, 34, 0.9);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 8px 10px;
      color: var(--muted);
    }
    button {
      height: 34px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-2);
      color: var(--text);
      padding: 0 10px;
      cursor: pointer;
    }
    button:hover { border-color: var(--accent); color: var(--accent); }
    .details { padding: 16px; }
    .kv {
      display: grid;
      grid-template-columns: 84px 1fr;
      gap: 8px;
      padding: 7px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .kv b { color: var(--muted); font-weight: 600; }
    code {
      color: #b9c7ff;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .legend {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 10px;
    }
    .legend-item { display: flex; align-items: center; gap: 7px; color: var(--muted); }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .empty { color: var(--muted); padding: 16px; }
    @media (max-width: 1100px) {
      .app { grid-template-columns: 280px 1fr; }
      .right { display: none; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside>
      <header>
        <h1>Serif Brain Graph</h1>
        <div class="sub" id="generated"></div>
      </header>
      <div class="stats">
        <div class="stat"><strong id="nodeCount">0</strong><span>Nodes</span></div>
        <div class="stat"><strong id="edgeCount">0</strong><span>Edges</span></div>
        <div class="stat"><strong id="fileCount">0</strong><span>Files</span></div>
        <div class="stat"><strong id="visibleCount">0</strong><span>Visible</span></div>
      </div>
      <div class="controls">
        <input id="search" placeholder="Search node, path, label..." />
        <select id="moduleFilter"></select>
        <select id="typeFilter"></select>
        <h2>Node Types</h2>
        <div class="chips" id="typeChips"></div>
        <h2>Modules</h2>
        <div class="chips" id="moduleChips"></div>
      </div>
    </aside>
    <main>
      <div class="toolbar">
        <div class="badge" id="viewportLabel">Drag canvas. Click a node.</div>
        <button id="reset">Reset View</button>
      </div>
      <svg id="graph" role="img" aria-label="Serif Brain graph visualization"></svg>
    </main>
    <aside class="right">
      <header>
        <h1>Node Info</h1>
        <div class="sub">Click a node to inspect relations.</div>
      </header>
      <div class="details" id="details"><div class="empty">No node selected.</div></div>
    </aside>
  </div>
  <script>
    const GRAPH = ${data};
    const colors = {
      project: "#ffffff", module: "#34d5ff", file: "#8fb3ff", component: "#c792ea",
      route: "#ffcc66", api: "#ff9f68", bug: "#ff657a", decision: "#42d392",
      task: "#f78fb3", concept: "#7bdff2", dependency: "#b8c0d9", session: "#a3e635"
    };
    const moduleColors = {
      contentx: "#4cc9f0", presentx: "#80ed99", animatorx: "#ffd166", studiox: "#c77dff",
      testx: "#ff6b6b", dashboard: "#72efdd", shared: "#fef08a", infra: "#cbd5e1",
      auth: "#a7f3d0", billing: "#fdba74", unknown: "#94a3b8"
    };

    const state = {
      q: "", type: "all", module: "all", selected: null,
      zoom: 1, tx: 0, ty: 0, dragging: false, dragStart: null
    };

    const nodes = GRAPH.nodes.map((n, i) => ({ ...n, idx: i }));
    const edges = GRAPH.edges;
    const byId = new Map(nodes.map(n => [n.id, n]));

    function shortLabel(n) {
      if (n.label) return n.label;
      if (n.path) return n.path.split("/").slice(-2).join("/");
      return n.id.replace(/^(file|module|bug|decision|component|route):/, "");
    }

    function moduleOf(n) {
      if (n.module) {
        const value = Array.isArray(n.module) ? n.module[0] : n.module;
        return value && value !== "undefined" ? value : "unknown";
      }
      if (n.type === "module") {
        const value = n.id.replace(/^module:/, "");
        return value && value !== "undefined" ? value : "unknown";
      }
      return "unknown";
    }

    function nodeSize(n) {
      if (n.type === "project") return 15;
      if (n.type === "module") return 12;
      if (n.type === "bug") return 9;
      if (n.type === "decision") return 9;
      if (n.type === "route") return 7;
      if (n.type === "component") return 6;
      return 4.5;
    }

    function colorOf(n) {
      if (n.type === "file" || n.type === "route" || n.type === "component") {
        return moduleColors[moduleOf(n)] || colors[n.type] || "#9aa4be";
      }
      return colors[n.type] || "#9aa4be";
    }

    function seedLayout() {
      const modules = [...new Set(nodes.map(moduleOf))].sort();
      const moduleIndex = new Map(modules.map((m, i) => [m, i]));
      const W = 1400, H = 1000;
      for (const n of nodes) {
        const mi = moduleIndex.get(moduleOf(n)) || 0;
        const ring = mi / Math.max(1, modules.length);
        const base = ring * Math.PI * 2;
        const hash = hashCode(n.id);
        const r = 120 + (Math.abs(hash) % 390);
        const jitter = ((hash % 1000) / 1000 - 0.5) * 0.9;
        n.x = W / 2 + Math.cos(base + jitter) * r + ((hash >> 3) % 90);
        n.y = H / 2 + Math.sin(base + jitter) * r + ((hash >> 5) % 90);
      }
    }

    function hashCode(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
      return h;
    }

    function pass(n) {
      const q = state.q.toLowerCase();
      const hay = [n.id, n.label, n.path, n.title, n.type, moduleOf(n)].filter(Boolean).join(" ").toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (state.type !== "all" && n.type !== state.type) return false;
      if (state.module !== "all" && moduleOf(n) !== state.module) return false;
      return true;
    }

    function visibleSets() {
      const visible = new Set(nodes.filter(pass).map(n => n.id));
      const visibleEdges = edges.filter(e => visible.has(e.source) && visible.has(e.target));
      return { visible, visibleEdges };
    }

    function render() {
      const svg = document.getElementById("graph");
      const { visible, visibleEdges } = visibleSets();
      document.getElementById("visibleCount").textContent = visible.size;
      svg.innerHTML = "";
      const g = el("g", { transform: \`translate(\${state.tx} \${state.ty}) scale(\${state.zoom})\` });
      const edgeLayer = el("g", {});
      const nodeLayer = el("g", {});
      const selected = state.selected;
      const neighbors = selected ? new Set([selected]) : null;
      if (selected) {
        for (const e of edges) {
          if (e.source === selected) neighbors.add(e.target);
          if (e.target === selected) neighbors.add(e.source);
        }
      }
      for (const e of visibleEdges) {
        const s = byId.get(e.source), t = byId.get(e.target);
        if (!s || !t) continue;
        const hot = selected && (e.source === selected || e.target === selected);
        const dim = selected && !hot;
        edgeLayer.appendChild(el("line", {
          class: "edge" + (hot ? " hot" : "") + (dim ? " dim" : ""),
          x1: s.x, y1: s.y, x2: t.x, y2: t.y
        }));
      }
      for (const n of nodes) {
        const isVisible = visible.has(n.id);
        if (!isVisible) continue;
        const dim = selected && !neighbors.has(n.id);
        const group = el("g", { class: "node" + (dim ? " dim" : ""), transform: \`translate(\${n.x} \${n.y})\` });
        group.appendChild(el("circle", { r: nodeSize(n), fill: colorOf(n) }));
        if (["project", "module", "bug", "decision", "route"].includes(n.type)) {
          group.appendChild(el("text", { x: nodeSize(n) + 4, y: 4 }, shortLabel(n).slice(0, 34)));
        }
        group.addEventListener("click", evt => {
          evt.stopPropagation();
          state.selected = n.id;
          renderDetails(n);
          render();
        });
        nodeLayer.appendChild(group);
      }
      g.appendChild(edgeLayer);
      g.appendChild(nodeLayer);
      svg.appendChild(g);
    }

    function renderDetails(n) {
      if (!n) {
        document.getElementById("details").innerHTML = '<div class="empty">No node selected.</div>';
        return;
      }
      const out = edges.filter(e => e.source === n.id);
      const incoming = edges.filter(e => e.target === n.id);
      document.getElementById("details").innerHTML = [
        \`<h3>\${escapeHtml(shortLabel(n))}</h3>\`,
        kv("Type", n.type),
        kv("Module", moduleOf(n)),
        kv("ID", "<code>" + escapeHtml(n.id) + "</code>"),
        n.path ? kv("Path", "<code>" + escapeHtml(n.path) + "</code>") : "",
        n.status ? kv("Status", n.status) : "",
        n.priority ? kv("Priority", n.priority) : "",
        kv("Edges", \`\${incoming.length} in / \${out.length} out\`),
        \`<h2>Outgoing</h2>\${edgeList(out, "target")}\`,
        \`<h2>Incoming</h2>\${edgeList(incoming, "source")}\`
      ].join("");
    }

    function edgeList(list, key) {
      if (!list.length) return '<div class="empty">None</div>';
      return list.slice(0, 40).map(e => {
        const n = byId.get(e[key]);
        return \`<div class="row" data-node="\${escapeAttr(e[key])}"><b>\${escapeHtml(e.type)}</b><small>\${escapeHtml(n ? shortLabel(n) : e[key])}</small></div>\`;
      }).join("");
    }

    function kv(k, v) {
      return \`<div class="kv"><b>\${escapeHtml(k)}</b><span>\${typeof v === "string" ? v : escapeHtml(String(v))}</span></div>\`;
    }

    function el(name, attrs, text) {
      const node = document.createElementNS("http://www.w3.org/2000/svg", name);
      for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
      if (text) node.textContent = text;
      return node;
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
    }
    function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

    function setupControls() {
      document.getElementById("generated").textContent = new Date(GRAPH.generated_at).toLocaleString();
      document.getElementById("nodeCount").textContent = GRAPH.stats.node_count || nodes.length;
      document.getElementById("edgeCount").textContent = GRAPH.stats.edge_count || edges.length;
      document.getElementById("fileCount").textContent = GRAPH.stats.file_count || GRAPH.stats.files_scanned || 0;
      const types = ["all", ...new Set(nodes.map(n => n.type).sort())];
      const modules = ["all", ...new Set(nodes.map(moduleOf).sort())];
      fillSelect("typeFilter", types);
      fillSelect("moduleFilter", modules);
      fillChips("typeChips", types, "type");
      fillChips("moduleChips", modules, "module");
      document.getElementById("search").addEventListener("input", e => { state.q = e.target.value; render(); });
      document.getElementById("typeFilter").addEventListener("change", e => { state.type = e.target.value; syncChips(); render(); });
      document.getElementById("moduleFilter").addEventListener("change", e => { state.module = e.target.value; syncChips(); render(); });
      document.getElementById("reset").addEventListener("click", () => { state.zoom = 1; state.tx = 0; state.ty = 0; state.selected = null; renderDetails(null); render(); });
      document.getElementById("details").addEventListener("click", e => {
        const row = e.target.closest("[data-node]");
        if (!row) return;
        const n = byId.get(row.dataset.node);
        if (!n) return;
        state.selected = n.id;
        renderDetails(n);
        render();
      });
      setupPanZoom();
    }

    function fillSelect(id, values) {
      document.getElementById(id).innerHTML = values.map(v => \`<option value="\${escapeAttr(v)}">\${escapeHtml(v)}</option>\`).join("");
    }
    function fillChips(id, values, field) {
      document.getElementById(id).innerHTML = values.map(v => \`<span class="chip \${v === "all" ? "active" : ""}" data-field="\${field}" data-value="\${escapeAttr(v)}">\${escapeHtml(v)}</span>\`).join("");
      document.getElementById(id).addEventListener("click", e => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        state[chip.dataset.field] = chip.dataset.value;
        document.getElementById(chip.dataset.field + "Filter").value = chip.dataset.value;
        syncChips();
        render();
      });
    }
    function syncChips() {
      document.querySelectorAll(".chip").forEach(chip => {
        chip.classList.toggle("active", state[chip.dataset.field] === chip.dataset.value);
      });
    }

    function setupPanZoom() {
      const svg = document.getElementById("graph");
      svg.addEventListener("click", () => { state.selected = null; renderDetails(null); render(); });
      svg.addEventListener("pointerdown", e => {
        state.dragging = true;
        state.dragStart = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty };
        svg.setPointerCapture(e.pointerId);
      });
      svg.addEventListener("pointermove", e => {
        if (!state.dragging) return;
        state.tx = state.dragStart.tx + e.clientX - state.dragStart.x;
        state.ty = state.dragStart.ty + e.clientY - state.dragStart.y;
        render();
      });
      svg.addEventListener("pointerup", () => { state.dragging = false; });
      svg.addEventListener("wheel", e => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const graphX = (mouseX - state.tx) / state.zoom;
        const graphY = (mouseY - state.ty) / state.zoom;
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        const nextZoom = Math.max(0.25, Math.min(3, state.zoom * factor));
        state.tx = mouseX - graphX * nextZoom;
        state.ty = mouseY - graphY * nextZoom;
        state.zoom = nextZoom;
        render();
      }, { passive: false });
    }

    seedLayout();
    setupControls();
    renderDetails(null);
    render();
  </script>
</body>
</html>`;
}
