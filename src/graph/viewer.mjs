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
    canvas#graph {
      display: block;
      width: 100%;
      height: 100%;
      cursor: grab;
      touch-action: none;
    }
    canvas#graph.grabbing { cursor: grabbing; }
    canvas#graph.pointing { cursor: pointer; }
    #tooltip {
      position: fixed;
      z-index: 5;
      pointer-events: none;
      display: none;
      max-width: 280px;
      padding: 7px 10px;
      background: rgba(9, 13, 24, 0.95);
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--text);
      font-size: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
    }
    #tooltip b { color: var(--accent); }
    #tooltip small { display: block; color: var(--muted); margin-top: 2px; }
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
      pointer-events: auto;
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
        <div class="badge" id="viewportLabel">Scroll = zoom · drag node = physics · drag bg = pan</div>
        <button id="reset">Reset View</button>
      </div>
      <canvas id="graph" role="img" aria-label="Serif Brain graph visualization"></canvas>
      <div id="tooltip"></div>
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
      task: "#f78fb3", concept: "#7bdff2", dependency: "#b8c0d9", session: "#a3e635",
      note: "#7bdff2"
    };
    const moduleColors = {
      contentx: "#4cc9f0", presentx: "#80ed99", animatorx: "#ffd166", studiox: "#c77dff",
      testx: "#ff6b6b", dashboard: "#72efdd", shared: "#fef08a", infra: "#cbd5e1",
      auth: "#a7f3d0", billing: "#fdba74", unknown: "#94a3b8"
    };

    // ----- data -----
    const nodes = GRAPH.nodes.map((n, i) => ({ ...n, idx: i, x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null }));
    const edges = GRAPH.edges;
    const byId = new Map(nodes.map(n => [n.id, n]));

    // resolved links (node refs), used by sim + render
    const links = [];
    for (const e of edges) {
      const s = byId.get(e.source), t = byId.get(e.target);
      if (s && t && s !== t) links.push({ s, t, type: e.type, raw: e });
    }
    // adjacency + degree
    const adj = new Map();
    const deg = new Map();
    for (const n of nodes) deg.set(n, 0);
    function addAdj(a, b) { let s = adj.get(a); if (!s) { s = new Set(); adj.set(a, s); } s.add(b); }
    for (const L of links) {
      addAdj(L.s.id, L.t.id); addAdj(L.t.id, L.s.id);
      deg.set(L.s, deg.get(L.s) + 1); deg.set(L.t, deg.get(L.t) + 1);
    }

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
    function hashCode(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
      return h;
    }

    // ----- filter state -----
    const filter = { q: "", type: "all", module: "all" };
    let visibleSet = new Set();
    let visibleLinks = [];

    function pass(n) {
      const q = filter.q.toLowerCase();
      if (q) {
        const hay = [n.id, n.label, n.path, n.title, n.type, moduleOf(n)].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter.type !== "all" && n.type !== filter.type) return false;
      if (filter.module !== "all" && moduleOf(n) !== filter.module) return false;
      return true;
    }
    function applyFilter() {
      visibleSet = new Set();
      for (const n of nodes) if (pass(n)) visibleSet.add(n);
      visibleLinks = links.filter(L => visibleSet.has(L.s) && visibleSet.has(L.t));
      document.getElementById("visibleCount").textContent = visibleSet.size;
      wake();
    }

    // ----- seed layout (phyllotaxis, centered at origin) -----
    function seedPositions() {
      const golden = Math.PI * (3 - Math.sqrt(5));
      nodes.forEach((n, i) => {
        const r = 16 * Math.sqrt(i + 0.5);
        const a = i * golden;
        n.x = Math.cos(a) * r;
        n.y = Math.sin(a) * r;
        n.vx = 0; n.vy = 0; n.fx = null; n.fy = null;
      });
    }

    // ===== Force simulation (self-contained, Barnes-Hut quadtree) =====
    const VELOCITY_DECAY = 0.6;
    const ALPHA_DECAY = 0.0228;
    const ALPHA_MIN = 0.0016;
    const CHARGE = -54;       // many-body repulsion (negative)
    const DMAX = 440;         // charge interaction cutoff (world)
    const DMAX2 = DMAX * DMAX;
    const MIND2 = 16;         // min squared distance clamp
    const THETA2 = 0.81;      // Barnes-Hut accuracy (theta = 0.9)
    const LINK_DIST = 36;
    const GRAVITY = 0.042;    // pull toward origin
    let alpha = 1;
    const alphaTarget = 0;

    function mkq(x0, y0, x1, y1) { return { x0, y0, x1, y1, children: null, points: null, mass: 0, cx: 0, cy: 0 }; }
    function subdiv(q) {
      const mx = (q.x0 + q.x1) / 2, my = (q.y0 + q.y1) / 2;
      q.children = [mkq(q.x0, q.y0, mx, my), mkq(mx, q.y0, q.x1, my), mkq(q.x0, my, mx, q.y1), mkq(mx, my, q.x1, q.y1)];
    }
    function qput(q, p, depth) {
      const mx = (q.x0 + q.x1) / 2, my = (q.y0 + q.y1) / 2;
      const i = (p.x >= mx ? 1 : 0) + (p.y >= my ? 2 : 0);
      qinsert(q.children[i], p, depth + 1);
    }
    function qinsert(q, p, depth) {
      if (q.children) { qput(q, p, depth); return; }
      if (!q.points) { q.points = [p]; return; }
      if (depth >= 22) { q.points.push(p); return; } // coincident-point guard
      const pts = q.points; q.points = null; subdiv(q);
      for (const o of pts) qput(q, o, depth);
      qput(q, p, depth);
    }
    function qaccum(q) {
      q.mass = 0; let cx = 0, cy = 0;
      if (q.children) {
        for (const c of q.children) { qaccum(c); if (c.mass) { q.mass += c.mass; cx += c.cx * c.mass; cy += c.cy * c.mass; } }
      } else if (q.points) {
        for (const p of q.points) { q.mass++; cx += p.x; cy += p.y; }
      }
      if (q.mass) { q.cx = cx / q.mass; q.cy = cy / q.mass; }
    }
    function qapply(q, n, a) {
      if (!q.mass) return;
      const dx = q.cx - n.x, dy = q.cy - n.y;
      let d2 = dx * dx + dy * dy;
      const w = q.x1 - q.x0;
      if (q.children && (w * w > THETA2 * d2)) {
        qapply(q.children[0], n, a); qapply(q.children[1], n, a);
        qapply(q.children[2], n, a); qapply(q.children[3], n, a);
        return;
      }
      if (q.points) {
        for (const p of q.points) {
          if (p === n) continue;
          let ex = p.x - n.x, ey = p.y - n.y, e2 = ex * ex + ey * ey;
          if (e2 > DMAX2) continue;
          if (e2 < MIND2) {
            if (ex === 0 && ey === 0) { ex = ((hashCode(p.id) % 21) - 10) * 0.05; ey = ((hashCode(n.id) % 21) - 10) * 0.05; }
            e2 = MIND2;
          }
          const f = CHARGE * a / e2;
          n.vx += ex * f; n.vy += ey * f;
        }
        return;
      }
      if (d2 > DMAX2) return;
      if (d2 < MIND2) d2 = MIND2;
      const f = CHARGE * q.mass * a / d2;
      n.vx += dx * f; n.vy += dy * f;
    }
    function manyBody(a) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of nodes) {
        if (n.x < x0) x0 = n.x; if (n.x > x1) x1 = n.x;
        if (n.y < y0) y0 = n.y; if (n.y > y1) y1 = n.y;
      }
      if (!isFinite(x0)) return;
      const size = Math.max(x1 - x0, y1 - y0, 1);
      const root = mkq(x0, y0, x0 + size, y0 + size);
      for (const n of nodes) qinsert(root, n, 0);
      qaccum(root);
      for (const n of nodes) qapply(root, n, a);
    }
    function linkForce(a) {
      for (const L of links) {
        const s = L.s, t = L.t;
        let dx = (t.x + t.vx) - (s.x + s.vx);
        let dy = (t.y + t.vy) - (s.y + s.vy);
        let l = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        const ds = deg.get(s), dt = deg.get(t);
        const strength = 1 / Math.min(ds, dt);
        l = (l - LINK_DIST) / l * a * strength;
        dx *= l; dy *= l;
        const bias = ds / (ds + dt);
        t.vx -= dx * bias; t.vy -= dy * bias;
        s.vx += dx * (1 - bias); s.vy += dy * (1 - bias);
      }
    }
    function gravityForce(a) {
      const k = GRAVITY * a;
      for (const n of nodes) { n.vx += (0 - n.x) * k; n.vy += (0 - n.y) * k; }
    }
    function integrate() {
      for (const n of nodes) {
        if (n.fx != null) { n.x = n.fx; n.vx = 0; } else { n.vx *= VELOCITY_DECAY; n.x += n.vx; }
        if (n.fy != null) { n.y = n.fy; n.vy = 0; } else { n.vy *= VELOCITY_DECAY; n.y += n.vy; }
      }
    }
    function tick() {
      alpha += (alphaTarget - alpha) * ALPHA_DECAY;
      manyBody(alpha);
      linkForce(alpha);
      gravityForce(alpha);
      integrate();
      buildGrid();
    }

    // ----- spatial hash grid for hit-testing -----
    const CELL = 55;
    let grid = new Map();
    function gkey(gx, gy) { return gx + "," + gy; }
    function buildGrid() {
      grid = new Map();
      for (const n of nodes) {
        const gx = Math.floor(n.x / CELL), gy = Math.floor(n.y / CELL);
        const k = gkey(gx, gy);
        let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(n);
      }
    }
    function nodeAt(screenX, screenY) {
      const wx = (screenX - cam.tx) / cam.zoom, wy = (screenY - cam.ty) / cam.zoom;
      const gx = Math.floor(wx / CELL), gy = Math.floor(wy / CELL);
      let best = null, bestD = Infinity;
      for (let ix = gx - 1; ix <= gx + 1; ix++) {
        for (let iy = gy - 1; iy <= gy + 1; iy++) {
          const a = grid.get(gkey(ix, iy)); if (!a) continue;
          for (const n of a) {
            if (!visibleSet.has(n)) continue;
            const dx = n.x - wx, dy = n.y - wy, d = dx * dx + dy * dy;
            const rad = nodeSize(n) + 5 / cam.zoom;
            if (d < rad * rad && d < bestD) { bestD = d; best = n; }
          }
        }
      }
      return best;
    }

    // ----- camera (target + lerped actual) -----
    const cam = { tx: 0, ty: 0, zoom: 1 };
    const camTarget = { tx: 0, ty: 0, zoom: 1 };
    let userMoved = false;
    let autoFit = true;

    function boundsAll() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const src = visibleSet.size ? visibleSet : nodes;
      for (const n of src) {
        if (n.x < x0) x0 = n.x; if (n.x > x1) x1 = n.x;
        if (n.y < y0) y0 = n.y; if (n.y > y1) y1 = n.y;
      }
      if (!isFinite(x0)) { x0 = -100; y0 = -100; x1 = 100; y1 = 100; }
      return { x0, y0, x1, y1 };
    }
    function fitTo(b, instant) {
      const pad = 70;
      const w = (b.x1 - b.x0) + pad * 2, h = (b.y1 - b.y0) + pad * 2;
      const z = Math.max(0.05, Math.min(2, Math.min(cssW / w, cssH / h)));
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      camTarget.zoom = z;
      camTarget.tx = cssW / 2 - cx * z;
      camTarget.ty = cssH / 2 - cy * z;
      if (instant) { cam.zoom = z; cam.tx = camTarget.tx; cam.ty = camTarget.ty; }
    }

    // ----- focus / hover / selection -----
    let hoverNode = null;
    let selectedNode = null;
    let focusNode = null;
    let focusNeighbors = new Set();
    let focusCur = 0, focusTarget = 0;
    function setFocus() {
      focusNode = hoverNode || selectedNode;
      if (focusNode) {
        focusNeighbors = new Set([focusNode]);
        const a = adj.get(focusNode.id);
        if (a) for (const id of a) { const nb = byId.get(id); if (nb) focusNeighbors.add(nb); }
        focusTarget = 1;
      } else {
        focusTarget = 0; // keep focusNeighbors until faded out
      }
      wake();
    }

    // ----- canvas / render -----
    const main = document.querySelector("main");
    const canvas = document.getElementById("graph");
    const ctx = canvas.getContext("2d");
    const tooltip = document.getElementById("tooltip");
    let cssW = 800, cssH = 600, dpr = 1;

    function resize() {
      const rect = main.getBoundingClientRect();
      cssW = Math.max(1, rect.width); cssH = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      wake();
    }

    function drawEdges() {
      const f = focusCur;
      if (cam.zoom < 0.12 && f < 0.01) return; // too far out, skip edge mush
      if (f > 0.01) {
        ctx.lineWidth = 1 / cam.zoom;
        ctx.strokeStyle = "rgba(154,164,190,1)";
        ctx.globalAlpha = 0.05 + 0.05 * (1 - f);
        ctx.beginPath();
        for (const L of visibleLinks) {
          if (L.s === focusNode || L.t === focusNode) continue;
          ctx.moveTo(L.s.x, L.s.y); ctx.lineTo(L.t.x, L.t.y);
        }
        ctx.stroke();
        ctx.lineWidth = 1.7 / cam.zoom;
        ctx.strokeStyle = "rgba(52,213,255,1)";
        ctx.globalAlpha = 0.2 + 0.6 * f;
        ctx.beginPath();
        for (const L of visibleLinks) {
          if (L.s === focusNode || L.t === focusNode) { ctx.moveTo(L.s.x, L.s.y); ctx.lineTo(L.t.x, L.t.y); }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.lineWidth = 1 / cam.zoom;
        ctx.strokeStyle = "rgba(154,164,190,1)";
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        for (const L of visibleLinks) { ctx.moveTo(L.s.x, L.s.y); ctx.lineTo(L.t.x, L.t.y); }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    function drawNodes() {
      const f = focusCur;
      for (const n of nodes) {
        if (!visibleSet.has(n)) continue;
        let a = 1;
        if (f > 0.01) a = focusNeighbors.has(n) ? 1 : (1 - 0.84 * f);
        ctx.globalAlpha = a;
        const r = nodeSize(n);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 6.283185307179586);
        ctx.fillStyle = colorOf(n);
        ctx.fill();
        if (r >= 6 || (f > 0.01 && n === focusNode)) {
          ctx.lineWidth = (n === focusNode ? 2 : 1) / cam.zoom;
          ctx.strokeStyle = n === focusNode ? "rgba(52,213,255,0.95)" : "rgba(255,255,255,0.5)";
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      drawLabels(f);
    }

    function drawLabels(f) {
      const fs = 12 / cam.zoom;
      ctx.font = fs + "px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3.5 / cam.zoom;
      ctx.lineJoin = "round";
      const allowTiny = cam.zoom > 1.6 && visibleSet.size < 400;
      for (const n of nodes) {
        if (!visibleSet.has(n)) continue;
        const big = n.type === "project" || n.type === "module";
        const med = n.type === "bug" || n.type === "decision" || n.type === "route";
        let show = false;
        if (n === hoverNode || n === focusNode) show = true;
        else if (f > 0.5 && focusNeighbors.has(n)) show = true;
        else if (big && cam.zoom > 0.22) show = true;
        else if (med && cam.zoom > 0.7) show = true;
        else if (allowTiny) show = true;
        if (!show) continue;
        let a = 1;
        if (f > 0.01 && !focusNeighbors.has(n)) a = 1 - 0.9 * f;
        ctx.globalAlpha = a;
        const r = nodeSize(n);
        const tx = n.x + r + 4 / cam.zoom, ty = n.y;
        const text = shortLabel(n).slice(0, 34);
        ctx.strokeStyle = "rgba(7,9,18,0.92)";
        ctx.strokeText(text, tx, ty);
        ctx.fillStyle = "#e8ecf7";
        ctx.fillText(text, tx, ty);
      }
      ctx.globalAlpha = 1;
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.save();
      ctx.translate(cam.tx, cam.ty);
      ctx.scale(cam.zoom, cam.zoom);
      drawEdges();
      drawNodes();
      ctx.restore();
    }

    // ----- rAF loop (idle = stopped) -----
    let running = false, rafId = 0;
    let momX = 0, momY = 0;
    let dragNode = null, dragging = false, panning = false;
    let panStart = null, lastPan = null, downNode = null, downPos = null;

    function wake() { if (!running) { running = true; rafId = requestAnimationFrame(frame); } }

    function frame() {
      const hot = alpha > ALPHA_MIN;
      if (hot) tick();

      if (autoFit && !userMoved && alpha > 0.12) fitTo(boundsAll(), false);

      if (!panning && (Math.abs(momX) > 0.05 || Math.abs(momY) > 0.05)) {
        camTarget.tx += momX; camTarget.ty += momY;
        cam.tx += momX; cam.ty += momY;
        momX *= 0.9; momY *= 0.9;
      }

      const e = 0.2;
      cam.tx += (camTarget.tx - cam.tx) * e;
      cam.ty += (camTarget.ty - cam.ty) * e;
      cam.zoom += (camTarget.zoom - cam.zoom) * e;

      focusCur += (focusTarget - focusCur) * 0.18;
      if (focusTarget === 0 && focusCur < 0.02 && focusNeighbors.size) focusNeighbors = new Set();

      draw();
      updateBadge();

      const camMoving = Math.abs(camTarget.tx - cam.tx) > 0.3 || Math.abs(camTarget.ty - cam.ty) > 0.3 || Math.abs(camTarget.zoom - cam.zoom) > 0.0005;
      const focusMoving = Math.abs(focusTarget - focusCur) > 0.01;
      const momMoving = Math.abs(momX) > 0.05 || Math.abs(momY) > 0.05;
      if (hot || camMoving || focusMoving || momMoving || dragging) {
        rafId = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    }

    function updateBadge() {
      const label = document.getElementById("viewportLabel");
      const settling = alpha > 0.05 ? " · settling…" : "";
      label.textContent = Math.round(cam.zoom * 100) + "% · " + visibleSet.size + " visible" + settling;
    }

    // ----- pointer / wheel interaction -----
    function rel(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    canvas.addEventListener("pointerdown", e => {
      canvas.setPointerCapture(e.pointerId);
      const p = rel(e);
      downPos = p;
      downNode = nodeAt(p.x, p.y);
      momX = 0; momY = 0;
      if (downNode) {
        dragNode = downNode; dragging = true;
        dragNode.fx = dragNode.x; dragNode.fy = dragNode.y;
        alpha = Math.max(alpha, 0.5);
        canvas.classList.add("grabbing");
      } else {
        panning = true;
        panStart = { tx: camTarget.tx, ty: camTarget.ty, cx: e.clientX, cy: e.clientY };
        lastPan = { x: e.clientX, y: e.clientY };
        canvas.classList.add("grabbing");
      }
      wake();
    });

    canvas.addEventListener("pointermove", e => {
      const p = rel(e);
      if (dragNode) {
        userMoved = true; autoFit = false;
        const wx = (p.x - cam.tx) / cam.zoom, wy = (p.y - cam.ty) / cam.zoom;
        dragNode.fx = wx; dragNode.fy = wy; dragNode.x = wx; dragNode.y = wy;
        alpha = Math.max(alpha, 0.3);
        moveTooltip(e);
        wake();
        return;
      }
      if (panning) {
        userMoved = true; autoFit = false;
        const dx = e.clientX - panStart.cx, dy = e.clientY - panStart.cy;
        camTarget.tx = panStart.tx + dx; camTarget.ty = panStart.ty + dy;
        cam.tx = camTarget.tx; cam.ty = camTarget.ty;
        momX = e.clientX - lastPan.x; momY = e.clientY - lastPan.y;
        lastPan = { x: e.clientX, y: e.clientY };
        wake();
        return;
      }
      const n = nodeAt(p.x, p.y);
      if (n !== hoverNode) {
        hoverNode = n;
        canvas.classList.toggle("pointing", !!n);
        setFocus();
      }
      if (n) showTooltip(n, e); else hideTooltip();
    });

    function endPointer(e) {
      const p = rel(e);
      const moved = downPos ? Math.hypot(p.x - downPos.x, p.y - downPos.y) : 99;
      if (dragNode) { dragNode.fx = null; dragNode.fy = null; dragNode = null; dragging = false; alpha = Math.max(alpha, 0.06); }
      if (panning) panning = false;
      canvas.classList.remove("grabbing");
      if (moved < 4) {
        if (downNode) { selectedNode = downNode; renderDetails(downNode); }
        else { selectedNode = null; renderDetails(null); }
        setFocus();
      }
      downNode = null; downPos = null;
      wake();
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", e => { if (dragNode) { dragNode.fx = null; dragNode.fy = null; dragNode = null; } dragging = false; panning = false; canvas.classList.remove("grabbing"); wake(); });

    canvas.addEventListener("pointerleave", () => { if (!dragging && !panning) { hoverNode = null; canvas.classList.remove("pointing"); setFocus(); hideTooltip(); } });

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      userMoved = true; autoFit = false;
      const p = rel(e);
      const wx = (p.x - camTarget.tx) / camTarget.zoom;
      const wy = (p.y - camTarget.ty) / camTarget.zoom;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      camTarget.zoom = Math.max(0.04, Math.min(4.5, camTarget.zoom * factor));
      camTarget.tx = p.x - wx * camTarget.zoom;
      camTarget.ty = p.y - wy * camTarget.zoom;
      wake();
    }, { passive: false });

    // ----- tooltip -----
    function showTooltip(n, e) {
      tooltip.style.display = "block";
      tooltip.innerHTML = "<b>" + escapeHtml(shortLabel(n)) + "</b><small>" + escapeHtml(n.type) + " · " + escapeHtml(moduleOf(n)) + "</small>";
      moveTooltip(e);
    }
    function moveTooltip(e) {
      if (tooltip.style.display !== "block") return;
      let x = e.clientX + 14, y = e.clientY + 14;
      const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
      if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
      tooltip.style.left = x + "px"; tooltip.style.top = y + "px";
    }
    function hideTooltip() { tooltip.style.display = "none"; }

    // ----- right details panel (preserved behavior) -----
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
    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

    // ----- left controls (preserved) -----
    function setupControls() {
      document.getElementById("generated").textContent = GRAPH.generated_at ? new Date(GRAPH.generated_at).toLocaleString() : "";
      document.getElementById("nodeCount").textContent = (GRAPH.stats && GRAPH.stats.node_count) || nodes.length;
      document.getElementById("edgeCount").textContent = (GRAPH.stats && GRAPH.stats.edge_count) || edges.length;
      document.getElementById("fileCount").textContent = (GRAPH.stats && (GRAPH.stats.file_count || GRAPH.stats.files_scanned)) || 0;
      const types = ["all", ...new Set(nodes.map(n => n.type).sort())];
      const modules = ["all", ...new Set(nodes.map(moduleOf).sort())];
      fillSelect("typeFilter", types);
      fillSelect("moduleFilter", modules);
      fillChips("typeChips", types, "type");
      fillChips("moduleChips", modules, "module");
      document.getElementById("search").addEventListener("input", e => { filter.q = e.target.value; applyFilter(); });
      document.getElementById("typeFilter").addEventListener("change", e => { filter.type = e.target.value; syncChips(); applyFilter(); });
      document.getElementById("moduleFilter").addEventListener("change", e => { filter.module = e.target.value; syncChips(); applyFilter(); });
      document.getElementById("reset").addEventListener("click", () => {
        selectedNode = null; hoverNode = null; renderDetails(null); setFocus();
        userMoved = false; alpha = Math.max(alpha, 0.05);
        fitTo(boundsAll(), false);
        wake();
      });
      document.getElementById("details").addEventListener("click", e => {
        const row = e.target.closest("[data-node]");
        if (!row) return;
        const n = byId.get(row.dataset.node);
        if (!n) return;
        selectedNode = n; renderDetails(n); setFocus();
      });
    }
    function fillSelect(id, values) {
      document.getElementById(id).innerHTML = values.map(v => \`<option value="\${escapeAttr(v)}">\${escapeHtml(v)}</option>\`).join("");
    }
    function fillChips(id, values, field) {
      document.getElementById(id).innerHTML = values.map(v => \`<span class="chip \${v === "all" ? "active" : ""}" data-field="\${field}" data-value="\${escapeAttr(v)}">\${escapeHtml(v)}</span>\`).join("");
      document.getElementById(id).addEventListener("click", e => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        filter[chip.dataset.field] = chip.dataset.value;
        document.getElementById(chip.dataset.field + "Filter").value = chip.dataset.value;
        syncChips();
        applyFilter();
      });
    }
    function syncChips() {
      document.querySelectorAll(".chip").forEach(chip => {
        chip.classList.toggle("active", filter[chip.dataset.field] === chip.dataset.value);
      });
    }

    // ----- boot -----
    seedPositions();
    buildGrid();
    setupControls();
    applyFilter();
    renderDetails(null);
    resize();
    fitTo(boundsAll(), true);
    new ResizeObserver(resize).observe(main);
    window.addEventListener("resize", resize);
    wake();
  </script>
</body>
</html>`;
}
