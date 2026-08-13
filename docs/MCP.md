# serif-brain MCP Sunucusu

Brain'i **AI tarafından canlı okunabilir** yapar. Claude Code (veya MCP destekleyen
herhangi bir istemci) proje hafızasını CLI'a gerek kalmadan **okur ve yazar**.
Saf-Node, sıfır bağımlılık, stdio/JSON-RPC.

## Araçlar (16: 14 okuma + 2 yazma)
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
| `brain_related` | Bir objeye **otomatik keşfedilen** ilişkili objeler (modül/etiket/metin) — elle `[[link]]` gerekmez | `id, limit?` |

### Yazma araçları
| Araç | Ne yapar | Parametreler |
|---|---|---|
| `brain_add` | Hafızaya kayıt yaz: `bug` (yaşanan hata) · `decision` (ihlal edilmeyecek karar) · `plan` (yol haritası) · `record` (yapılmış iş, `done` doğar) | `type, title, module?, priority?, severity?, status?, tags?, files?, project_id?` |
| `brain_close` | Kaydı kapat (`status → done`, `completed_at` bugün, gövdeye "Tamamlanma" bölümü) | `id, note?, commit?, project_id?, force?` |

> Yazma araçları CLI ile **aynı çekirdeği** çağırır (`src/markdown/write-ops.mjs`).
> Başarısız yazma sessiz kalmaz: JSON-RPC hatası döner — ajan kaydettiğini sanıp
> devam etmesin. `project_id` yalnızca id birden fazla projede varsa gerekir.

## Claude Code'a ekleme

Projenin kökünde `.mcp.json` (veya kullanıcı/proje MCP ayarı).

> `<serif-brain-core-yolu>` yerine kendi kurulumunun yolunu yaz. Aracın
> kendisi söyler — **`serif-brain --version`** çalıştırdığında `Kurulum:`
> satırında hangi kopyanın çalıştığı ve nerede olduğu yazar.

```json
{
  "mcpServers": {
    "serif-brain": {
      "command": "node",
      "args": [
        "<serif-brain-core-yolu>/bin/serif-brain.mjs",
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
