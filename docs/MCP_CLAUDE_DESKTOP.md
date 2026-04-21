# Claude Desktop — StratTrack Elasticsearch MCP

## Prerequisites

1. Local Elasticsearch is running (`./scripts/build-elastic-docker.sh` or Podman equivalent).
2. Node.js **18+** on your machine.
3. From the repo: `cd mcp && npm install` (once).

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch HTTP endpoint |
| `STRATTRACK_INDEX` | `strattrack_drawers` | Index name for notes / MemPalace migration |
| `ELASTICSEARCH_API_KEY` | _(unset)_ | Optional; Kibana **Encoded** API key when Elasticsearch has security on |
| `ELASTICSEARCH_BASIC_AUTH` | _(unset)_ | Optional; **base64**(`user:pass`) for Basic auth |

### Secrets: macOS Keychain (recommended on Mac)

Do **not** put API keys in the JSON `env` block. Use Apple’s **Keychain** and the wrapper script **`scripts/run-strattrack-mcp-from-keychain.sh`** so Claude Desktop only stores non-secret env vars. Full steps: **[MACOS_KEYCHAIN.md](./MACOS_KEYCHAIN.md)**.

## Claude Desktop config

Edit your Claude Desktop MCP configuration and add a server entry (paths must be **absolute** on your Mac):

```json
{
  "mcpServers": {
    "strattrack-elasticsearch": {
      "command": "node",
      "args": ["/Users/YOU/opt/strattrack/mcp/strattrack-mcp.mjs"],
      "env": {
        "ELASTICSEARCH_URL": "http://localhost:9200",
        "STRATTRACK_INDEX": "strattrack_drawers"
      }
    }
  }
}
```

Replace `/Users/YOU/opt/strattrack` with your clone path. Restart Claude Desktop after saving.

**With Keychain:** set `"command"` to `/Users/YOU/opt/strattrack/scripts/run-strattrack-mcp-from-keychain.sh` and `"args": []` — see [MACOS_KEYCHAIN.md](./MACOS_KEYCHAIN.md).

## Tools exposed

| Tool | Role |
|------|------|
| `elastic_cluster_health` | Verify ES is reachable |
| `elastic_ensure_index` | Create index + mappings (idempotent) |
| `elastic_search_opp` | Search notes / migrated drawers |
| `elastic_add_note` | Index a single document |
| `elastic_get_1_2_3` | Draft ONE–TWO–THREE from recent docs |
| `elastic_sync_to_sf` | Stub until Phase 3+ |
| `elastic_bulk_import_mempalace` | Import up to 100 MemPalace-shaped rows per call |

## First run checklist

1. `elastic_cluster_health` — expect `status` yellow or green.
2. `elastic_ensure_index` — creates `strattrack_drawers` if missing.
3. Migration: see **[MEMPALACE_MIGRATION.md](./MEMPALACE_MIGRATION.md)**.
4. `elastic_search_opp` with a test query.

## Logging

The server logs to **stderr** only so **stdout** stays clean for MCP JSON-RPC.
