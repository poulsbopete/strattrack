# Claude Desktop & Cursor — StratTrack Elasticsearch MCP

**Team default:** **Claude Desktop 4** (`.mcpb` or `mcpServers`). Cursor is supported; see **Cursor (this repo)** below.

## Team model (default)

StratTrack is:

1. **Elasticsearch** you can reach over HTTPS — intended **Elastic Cloud Serverless** (`ELASTICSEARCH_URL` + `ELASTICSEARCH_API_KEY`).
2. This **MCP server** in **Claude Desktop** (primary) or **Cursor** (optional).
3. Ongoing work: **`elastic_add_note`**, recall with **`elastic_search_opp`**, weekly-style packs with **`elastic_get_1_2_3`**.

That gives **searchable, durable memory** the model can query instead of you re-pasting long context.

## Do you need to wait for the terminal?

**No.** If you ran `node strattrack-mcp.mjs` in a terminal and saw `[strattrack-mcp] connected …`, the server **started correctly**. It will **not exit** on its own: stdio MCP servers **block** and wait for the client (Claude Desktop or Cursor) to send JSON-RPC on stdin. That is normal.

- **Stop the manual run:** press `Ctrl+C` when you are done sanity-checking.
- **To actually test tools:** add the MCP to **Claude Desktop** or **Cursor** so the app **spawns** its own `node …strattrack-mcp.mjs` process. You usually **do not** run the server by hand at the same time.

## “Always on” — what runs 24/7?

| Layer | Always-on? | Why |
|-------|------------|-----|
| **Elasticsearch (Elastic Cloud / Serverless)** | **Yes (Elastic runs it)** | You only keep **`ELASTICSEARCH_URL`** (+ API key) configured in the MCP. |
| **Optional: local Docker/Podman ES** | **Your choice** | If you use **localhost**, keep the compose stack up — see **[ELASTICSEARCH_LOCAL_ACCESS.md](./ELASTICSEARCH_LOCAL_ACCESS.md)**. |
| **MCP Node process (`strattrack-mcp.mjs`)** | **No (stdio design)** | Started by Claude Desktop or Cursor when a chat needs tools. |

## Prerequisites

1. **`ELASTICSEARCH_URL`** is set (required — no default). **Serverless:** also **`ELASTICSEARCH_API_KEY`** (Kibana encoded key) unless you use **`ELASTICSEARCH_BASIC_AUTH`**.
2. Node.js **18+** on your machine.
3. From the repo: `cd mcp && npm install` (once), if you run MCP from source.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `ELASTICSEARCH_URL` | **Yes** | Elasticsearch HTTPS endpoint (e.g. Serverless). Optional local dev: `http://localhost:9200` after Docker/Podman. |
| `STRATTRACK_INDEX` | No (default `strattrack_drawers`) | Index name |
| `ELASTICSEARCH_API_KEY` | For Elastic Cloud / Serverless | Kibana **Encoded** API key |
| `ELASTICSEARCH_BASIC_AUTH` | Optional | **base64**(`user:pass`) instead of API key |

### Secrets: macOS Keychain (recommended on Mac)

Do **not** put API keys in the JSON `env` block. Use Apple’s **Keychain** and the wrapper script **`scripts/run-strattrack-mcp-from-keychain.sh`** so Claude Desktop only stores non-secret env vars. Full steps: **[MACOS_KEYCHAIN.md](./MACOS_KEYCHAIN.md)**.

## Claude Desktop — configuration file location

| OS | File |
|----|------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |

Quit Claude Desktop before editing; reopen after saving.

## Claude Desktop — one-click extension (`.mcpb`)

StratTrack ships a **Desktop Extension** bundle (server + `node_modules` + index JSON) as **`strattrack-elasticsearch.mcpb`**.

### Install from GitHub Releases (recommended)

1. Open **[Releases](https://github.com/poulsbopete/strattrack/releases)** for this repository.
2. Under **Assets** on the release you want, download **`strattrack-elasticsearch.mcpb`**.
3. In **Claude Desktop**: **Settings → Extensions → Install Extension…** (or **Developer → Install extension**) and select the downloaded file. On macOS, **double-click** the `.mcpb` if your system opens it with Claude Desktop.
4. When prompted, set **`ELASTICSEARCH_URL`** to your **Serverless HTTPS** endpoint and paste **`ELASTICSEARCH_API_KEY`**. For optional local Docker ES, use `http://localhost:9200` (often no API key).

CI attaches each tagged build to Releases — see **[GITHUB_PUBLISH.md](./GITHUB_PUBLISH.md)**.

### Build the `.mcpb` locally (developers)

1. From the repo root: **`./scripts/build-strattrack-mcpb.sh`** (requires network once for `npm install` inside the bundle).
2. Output: **`dist/strattrack-elasticsearch.mcpb`** (**not committed** — `dist/` is in `.gitignore`, so a local rebuild never shows up as a new Git version; it only updates the file on disk). Rebuild after pulling MCP changes. For a **published** version with a downloadable `.mcpb` on GitHub, push a new SemVer tag — **[GITHUB_PUBLISH.md](./GITHUB_PUBLISH.md)**.
3. Install in Claude Desktop as in step 3 above.

Official MCPB reference: [Building MCPB](https://claude.com/docs/connectors/building/mcpb).

Manifest source: **`extensions/strattrack-elasticsearch/manifest.json`**.

## Claude Desktop — manual `mcpServers` entry

**Do not duplicate StratTrack.** If you already installed the **`.mcpb` extension**, Claude shows a server **“managed by an extension”** — then **omit** any manual `strattrack-elasticsearch` entry in `claude_desktop_config.json`. Two entries = two sidecar processes, confusing UI, and harder debugging.

Use **either** the extension **or** the snippet below — not both.

Edit your Claude Desktop MCP configuration and add a server entry (paths must be **absolute** on your Mac):

```json
{
  "mcpServers": {
    "strattrack-elasticsearch": {
      "command": "node",
      "args": ["/Users/YOU/opt/strattrack/mcp/strattrack-mcp.mjs"],
      "env": {
        "ELASTICSEARCH_URL": "https://YOUR-PROJECT.es.REGION.aws.elastic.cloud",
        "ELASTICSEARCH_API_KEY": "YOUR_ENCODED_API_KEY",
        "STRATTRACK_INDEX": "strattrack_drawers"
      }
    }
  }
}
```

Replace `/Users/YOU/opt/strattrack` with your clone path. Restart Claude Desktop after saving.

**With Keychain:** set `"command"` to `/Users/YOU/opt/strattrack/scripts/run-strattrack-mcp-from-keychain.sh` and `"args": []` — see [MACOS_KEYCHAIN.md](./MACOS_KEYCHAIN.md).

### If Claude Desktop won’t start (broken JSON or missing MCP)

1. **Validate JSON:** the file must be valid JSON — no trailing commas, no comments. Use your editor or `python3 -m json.tool ~/Library/Application\ Support/Claude/claude_desktop_config.json`.
2. **Minimal fix:** merge in only the `mcpServers` object from **[examples/claude_desktop_mcp.strattrack.json](../examples/claude_desktop_mcp.strattrack.json)** (fix the `args` path first), or copy the `mcpServers` block from the snippet above into your existing file next to `preferences`.
3. **Quit Claude fully** (macOS **Cmd+Q**), reopen, then start a **new chat** to load MCP.

If you use the **`.mcpb` extension**, keep **`mcpServers` free of StratTrack** (or remove only that key) so you do not register the same tools twice. A bad edit often deletes `mcpServers` or corrupts the whole file — validate JSON and restore **`preferences`** at minimum; add **`mcpServers`** only when you are **not** using the StratTrack extension.

## Cursor (this repo)

1. Copy **`.cursor/mcp.json.example`** to **`.cursor/mcp.json`** in the repo root (create the folder if needed).
2. Replace `/ABSOLUTE/PATH/TO/strattrack` in `args` with your real path (e.g. `/Users/psimkins/opt/strattrack`).
3. Open **Cursor Settings → MCP** (or the MCP panel) and ensure the server is enabled; restart Cursor if it does not pick up the file.
4. In chat, use **Agent** mode if your product requires it for tool use, then try a prompt that calls `elastic_cluster_health`.

Keep your **Elasticsearch** project running (Elastic Cloud handles this for Serverless). If you use **local** Docker ES instead, keep that stack up while you test — see **[ELASTICSEARCH_LOCAL_ACCESS.md](./ELASTICSEARCH_LOCAL_ACCESS.md)**.

## Tools exposed

| Tool | Role |
|------|------|
| `elastic_cluster_health` | Verify ES is reachable |
| `elastic_ensure_index` | Create index + mappings (idempotent) |
| `elastic_search_opp` | Search notes / migrated drawers |
| `elastic_add_note` | Index a single document |
| `elastic_get_1_2_3` | Draft ONE–TWO–THREE from indexed docs. Default **`days: 0`**: no `created_at` filter (sort only), so bulk/migrated rows with old timestamps still appear; set **`days`** to a positive number to restrict to the last N days. |
| `elastic_sync_to_sf` | Stub until Phase 3+ |
| `elastic_bulk_import` | Optional bulk import: up to 100 batched rows (content + optional metadata); day-to-day use **`elastic_add_note`** instead |

## First run checklist

1. `elastic_cluster_health` — expect `status` yellow or green.
2. `elastic_ensure_index` — creates `strattrack_drawers` if missing (or run `./scripts/init-strattrack-index.sh`).
3. **Team use:** index ongoing work with **`elastic_add_note`**; verify with **`elastic_search_opp`**.

## Logging

The server logs to **stderr** only so **stdout** stays clean for MCP JSON-RPC.
