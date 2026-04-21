# Claude Desktop & Cursor — StratTrack Elasticsearch MCP

**Team default:** **Claude Desktop 4** (`.mcpb` or `mcpServers`). Cursor is supported for developers who use it; see **Cursor (this repo)** below.

## Team model (default)

StratTrack is:

1. **Local Elasticsearch** (Docker/Podman) + index `strattrack_drawers`.
2. This **MCP server** wired in **Claude Desktop** (primary) or **Cursor** (optional).
3. Ongoing work: call **`elastic_add_note`** to append notes/decisions (running history for completions), **`elastic_search_opp`** to retrieve context, **`elastic_get_1_2_3`** for weekly-style summaries.

That gives the team **searchable, durable memory** in a **shared, MCP-addressable** index.

## Do you need to wait for the terminal?

**No.** If you ran `node strattrack-mcp.mjs` in a terminal and saw `[strattrack-mcp] connected …`, the server **started correctly**. It will **not exit** on its own: stdio MCP servers **block** and wait for the client (Claude Desktop or Cursor) to send JSON-RPC on stdin. That is normal.

- **Stop the manual run:** press `Ctrl+C` when you are done sanity-checking.
- **To actually test tools:** add the MCP to **Claude Desktop** (usual) or **Cursor** (below) so the app **spawns** its own `node …strattrack-mcp.mjs` process. You usually **do not** run the server by hand at the same time (two processes would fight if both used stdio — here only the client’s child process should run the MCP).

## “Always on” — what should run 24/7?

| Layer | Always-on? | Why |
|-------|------------|-----|
| **Elasticsearch (Docker/Podman)** | **Yes (recommended)** | Holds your index and answers `http://localhost:9200` whenever tools run. Compose uses **`restart: unless-stopped`** so the container comes back after reboot until you `down` it. |
| **MCP Node process (`strattrack-mcp.mjs`)** | **No (stdio design)** | This server speaks **MCP over stdin/stdout**. It is meant to be **started by Claude Desktop or Cursor** when a chat needs tools, then stopped when the session ends. Leaving a manual `node strattrack-mcp.mjs` in a terminal does **not** help the app (different process, no stdin pipe). |
| **Future: HTTP MCP** | Possible | A long‑lived **network** MCP server is a separate mode (not implemented here). If you need that later, it would be a small HTTP service + client config change. |

So: keep **Elasticsearch** running all the time; let the **IDE** launch the **MCP** when needed.

## Prerequisites

1. Local Elasticsearch is running (`./scripts/build-elastic-docker.sh` or Podman equivalent).
2. Node.js **18+** on your machine.
3. From the repo: `cd mcp && npm install` (once).

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch HTTP endpoint |
| `STRATTRACK_INDEX` | `strattrack_drawers` | Index name for notes and search |
| `ELASTICSEARCH_API_KEY` | _(unset)_ | Optional; Kibana **Encoded** API key when Elasticsearch has security on |
| `ELASTICSEARCH_BASIC_AUTH` | _(unset)_ | Optional; **base64**(`user:pass`) for Basic auth |

### Secrets: macOS Keychain (recommended on Mac)

Do **not** put API keys in the JSON `env` block. Use Apple’s **Keychain** and the wrapper script **`scripts/run-strattrack-mcp-from-keychain.sh`** so Claude Desktop only stores non-secret env vars. Full steps: **[MACOS_KEYCHAIN.md](./MACOS_KEYCHAIN.md)**.

## Claude Desktop — configuration file location

| OS | File |
|----|------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |

Quit Claude Desktop before editing; reopen after saving.

## Claude Desktop — one-click extension (`.mcpb`)

StratTrack ships a **Desktop Extension** manifest and a script that zips a self-contained bundle (server + `node_modules` + index JSON).

1. From the repo root: **`./scripts/build-strattrack-mcpb.sh`** (requires network once for `npm install` inside the bundle).
2. Output: **`dist/strattrack-elasticsearch.mcpb`** (ignored by git — rebuild after pulling updates).
3. In Claude Desktop: **Settings → Extensions → Install Extension…** (or **Developer → Install extension** depending on version) and select the `.mcpb` file.
4. When prompted, confirm defaults (**`http://localhost:9200`**, index **`strattrack_drawers`**) or adjust for your machine.

Official MCPB reference: [Building MCPB](https://claude.com/docs/connectors/building/mcpb).

Manifest source: **`extensions/strattrack-elasticsearch/manifest.json`**.

**Published builds:** after a maintainer pushes a version tag, GitHub Actions attaches **`strattrack-elasticsearch.mcpb`** to a **Release** (and publishes **`@poulsbopete/strattrack-mcp`** to GitHub Packages). See **[GITHUB_PUBLISH.md](./GITHUB_PUBLISH.md)**.

## Claude Desktop — manual `mcpServers` entry

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

## Cursor (this repo)

1. Copy **`.cursor/mcp.json.example`** to **`.cursor/mcp.json`** in the repo root (create the folder if needed).
2. Replace `/ABSOLUTE/PATH/TO/strattrack` in `args` with your real path (e.g. `/Users/psimkins/opt/strattrack`).
3. Open **Cursor Settings → MCP** (or the MCP panel) and ensure the server is enabled; restart Cursor if it does not pick up the file.
4. In chat, use **Agent** mode if your product requires it for tool use, then try a prompt that calls `elastic_cluster_health`.

Keep **Elasticsearch running** (`./scripts/build-elastic-docker.sh`) while you test.

## Tools exposed

| Tool | Role |
|------|------|
| `elastic_cluster_health` | Verify ES is reachable |
| `elastic_ensure_index` | Create index + mappings (idempotent) |
| `elastic_search_opp` | Search notes / migrated drawers |
| `elastic_add_note` | Index a single document |
| `elastic_get_1_2_3` | Draft ONE–TWO–THREE from recent docs |
| `elastic_sync_to_sf` | Stub until Phase 3+ |
| `elastic_bulk_import` | Optional bulk import: up to 100 batched rows (wing/room/content); day-to-day use **`elastic_add_note`** instead |

## First run checklist

1. `elastic_cluster_health` — expect `status` yellow or green.
2. `elastic_ensure_index` — creates `strattrack_drawers` if missing (or run `./scripts/init-strattrack-index.sh`).
3. **Team use:** index ongoing work with **`elastic_add_note`**; verify with **`elastic_search_opp`**.

## Logging

The server logs to **stderr** only so **stdout** stays clean for MCP JSON-RPC.
