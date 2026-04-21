# StratTrack

Elasticsearch-backed notes and search for **Solution Architects**, with **Salesforce** alignment in scope. **Team default:** StratTrack **MCP** (`elastic_add_note`, `elastic_search_opp`, `elastic_get_1_2_3`).

**Remote:** `git@github.com:poulsbopete/strattrack.git`  
**Releases / npm package:** tag `v*` → GitHub Packages + `.mcpb` on Releases — **[docs/GITHUB_PUBLISH.md](docs/GITHUB_PUBLISH.md)**  
**GitHub Pages (SA pitch deck):** repo **Settings → Pages →** branch **main**, folder **`/docs`** — site root is **[docs/index.html](docs/index.html)** (e.g. `https://poulsbopete.github.io/strattrack/` once enabled).

## Why this matters

- **Completion history on your machine.** Notes and structured outputs live in **local Elasticsearch**, so you keep a durable record of what the model produced and when—not only what is visible in the current chat window.
- **Fewer tokens, same answers.** The assistant can **search and pull prior completions** from the index instead of you pasting long context again or asking it to regenerate the same summaries. That cuts input tokens and speeds up follow-ups on accounts, opportunities, and technical notes you already stored.

## Quick start

You need a **local copy of this repository** to run Docker/Podman and the index scripts (compose files and `docker/strattrack-drawers-index.json` live in the tree). There is no separate “click-only” installer for Elasticsearch—you **clone or download ZIP**, then run one script.

**Copy-paste (Docker/Podman already installed):**

```bash
git clone --depth 1 https://github.com/poulsbopete/strattrack.git && cd strattrack && ./scripts/quickstart-local-es.sh
```

That clones, starts Elasticsearch, and creates **`strattrack_drawers`** if it is missing. Podman + mlock issues: append `--podman-compat` to the last command.

| Step | Command / link |
|------|------------------|
| 1. Get the repository | **`git clone https://github.com/poulsbopete/strattrack.git`** then **`cd strattrack`**, or **Code → Download ZIP** on GitHub, unzip, and `cd` into the folder. |
| 2. Elasticsearch + index | **`./scripts/quickstart-local-es.sh`** (starts ES and runs **`init-strattrack-index.sh`**). Or run **`./scripts/build-elastic-docker.sh`** then **`./scripts/init-strattrack-index.sh`** separately. |
| 3. MCP from source (optional) | **`cd mcp && npm install`** — **skip** if you only use the Release **`.mcpb`** (bundled server). |
| 4. Claude Desktop 4 (primary) | **Releases → download → install** (steps below). Details: **[docs/MCP_CLAUDE_DESKTOP.md](docs/MCP_CLAUDE_DESKTOP.md)**. *Cursor:* **`.cursor/mcp.json.example`** |

#### Step 4 — Claude Desktop 4 (from GitHub Releases)

1. Open **[github.com/poulsbopete/strattrack/releases](https://github.com/poulsbopete/strattrack/releases)** and pick the latest release (or the version you want).
2. Under **Assets**, download **`strattrack-elasticsearch.mcpb`** to your machine (e.g. Downloads).
3. Open **Claude Desktop** → **Settings → Extensions → Install Extension…** (wording may be **Developer → Install extension** in some builds). Choose the downloaded `.mcpb`. On macOS, **double-clicking** the file may open the same flow if `.mcpb` is associated with Claude Desktop.
4. When the extension prompts for connection details, keep defaults **`http://localhost:9200`** and index **`strattrack_drawers`** unless your Elasticsearch URL or index name differs.
5. Restart or reload Claude Desktop if it does not pick up the extension immediately. Local Elasticsearch from **step 2** (or the one-liner above) should already be running.

**Alternatives:** build a local `.mcpb` from the repo (`./scripts/build-strattrack-mcpb.sh`) or add a manual `mcpServers` entry — see **[docs/MCP_CLAUDE_DESKTOP.md](docs/MCP_CLAUDE_DESKTOP.md)**.

More: **[docs/ELASTICSEARCH_LOCAL_ACCESS.md](docs/ELASTICSEARCH_LOCAL_ACCESS.md)** (curl, container shell), **[docs/MACOS_KEYCHAIN.md](docs/MACOS_KEYCHAIN.md)** (secrets), **[docs/GRANOLA_DRIVE_SFDC_AI_WORKFLOW.md](docs/GRANOLA_DRIVE_SFDC_AI_WORKFLOW.md)** (Drive / SFDC / IT brief).

## MCP & packaging

| Item | Notes |
|------|--------|
| Local ES + index | **`scripts/quickstart-local-es.sh`** — wraps **`build-elastic-docker.sh`** + **`init-strattrack-index.sh`** |
| Server | `mcp/strattrack-mcp.mjs` — stdio MCP, `fetch` to Elasticsearch |
| npm (GitHub Packages) | `@poulsbopete/strattrack-mcp` — see **GITHUB_PUBLISH** |
| Claude `.mcpb` | `./scripts/build-strattrack-mcpb.sh` → `dist/…mcpb`; manifest in **`extensions/strattrack-elasticsearch/`** |
| Skill | **`skills/strattrack-elasticsearch-mcp/SKILL.md`** |

## Local Elasticsearch (detail)

- **Podman** or second engine: `STRATTRACK_CONTAINER_RUNTIME=podman ./scripts/build-elastic-docker.sh`
- **Rootless mlock:** `--podman-compat`
- **Stop:** `docker compose -f docker/docker-compose.elasticsearch.yml down` (add second `-f` …`podman-compat.yml` if you used it)
- **Restart policy:** `unless-stopped` on ES — see MCP doc “always on”

## Status & planning

| Phase | Link |
|-------|------|
| Phase 2 MCP hardening | [docs/PHASE2_PLAN.md](docs/PHASE2_PLAN.md) |
| Phase 3+ | Salesforce sync, dashboards (planned) |

## Git

Push completed work to **`origin`**. Feature branch: `git push -u origin feature/…`; `main`: `git push origin main`.

## License

Proprietary / internal — confirm with repository owner.
