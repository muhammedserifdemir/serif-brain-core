# serif-brain MCP Sunucusu

Brain'i **AI tarafından canlı okunabilir** yapar. Claude Code (veya MCP destekleyen
herhangi bir istemci) `brain_search` / `brain_get` / `brain_context` araçlarıyla
proje hafızasını CLI'a gerek kalmadan sorgular. Saf-Node, sıfır bağımlılık,
stdio/JSON-RPC.

## Araçlar
| Araç | Ne yapar | Parametreler |
|---|---|---|
| `brain_search` | Yapısal + tam-metin arama | `text, type, status, priority, module, tag, limit` |
| `brain_get` | Objeyi id ile getir (frontmatter + gövde) | `id` |
| `brain_context` | Aktif iş bağlamı (kritik/yüksek bug + aktif karar) | `module?, limit?` |

## Claude Code'a ekleme

Projenin kökünde `.mcp.json` (veya kullanıcı/proje MCP ayarı):

```json
{
  "mcpServers": {
    "serif-brain": {
      "command": "node",
      "args": [
        "/Users/muhammedserifdemir/Desktop/seriftech-packages/serif-brain-core/bin/serif-brain.mjs",
        "mcp",
        "--project",
        "."
      ]
    }
  }
}
```

`--project .` → o projenin `.serif-brain/`'ini kullanır. Sabit bir brain istenirse
tam yol verilir.

## Elle test (stdio)

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"brain_search","arguments":{"text":"scorm","limit":2}}}' \
  | node bin/serif-brain.mjs mcp --project /yol/proje 2>/dev/null
```

## Notlar
- **stdout yalnız JSON-RPC içindir**; tüm loglar stderr'e gider (protokol bozulmaz).
- Salt-okunur: MCP araçları yalnız okur; obje yazma `serif-brain add` ile açık yapılır.
- CLI eşdeğeri: `serif-brain search "..." --type decision --json`.
