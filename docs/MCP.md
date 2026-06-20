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
| `brain_brief` | Oturum-açılışı özeti: aktif bug/karar + son dokunulan + **park (queued) faz kuyruğu** | `module?, days?, limit?` |
| `brain_guard` | **Edit-öncesi birleşik brifing** (tek çağrı): verdict + ihlal-etme kararları + bug + yara izi + blast-radius + imza | `path, days?` |
| `brain_touch` | Edit ÖNCESİ: dosya/modülün kararları (ihlal etme) + bug'ları (çözülmüş "yara izi" dahil) | `path?, module?, limit?` |
| `brain_impact` | Canlı blast-radius: dosyayı değiştirirsem ne kırılır (geçişli bağımlılar + etkilenen modül + hafıza) | `path` |
| `brain_hotspot` | Tehlike bölgesi: git churn × merkezilik + modül bug yoğunluğu füzyonu | `days?, limit?` |
| `brain_layers` | Mimari katman ihlalleri (config `layer_rules`) | — |
| `brain_check` | PostEdit graf sağlığı (tek dosya): katman ihlali + döngü + god-file | `path` |
| `brain_lint` | Projeye-özel bug imza linter (config `bug_signatures`) | `path` |
| `brain_risk` | Tek dosya edit-anı risk skoru (churn+merkezilik+bug+imza füzyonu) | `path, days?` |
| `brain_cluster` | Bug'ları benzerliğe göre grupla — aynı-kök-neden kümeleri | `threshold?` |

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
