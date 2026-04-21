# StratTrack

Elasticsearch-backed notes and search for **Solution Architects**, with **Salesforce** alignment in scope. **Team default:** StratTrack **MCP** (`elastic_add_note`, `elastic_search_opp`, `elastic_get_1_2_3`).

**Remote:** `git@github.com:poulsbopete/strattrack.git`  
**Releases / npm package:** tag `v*` → GitHub Packages + `.mcpb` on Releases — **[docs/GITHUB_PUBLISH.md](docs/GITHUB_PUBLISH.md)**

## Why this matters

- **Completion history on your machine.** Notes and structured outputs live in **local Elasticsearch**, so you keep a durable record of what the model produced and when—not only what is visible in the current chat window.
- **Fewer tokens, same answers.** The assistant can **search and pull prior completions** from the index instead of you pasting long context again or asking it to regenerate the same summaries. That cuts input tokens and speeds up follow-ups on accounts, opportunities, and technical notes you already stored.

## Quick start

| Step | Command / link |
|------|------------------|
| 1. Elasticsearch | `./scripts/build-elastic-docker.sh` |
| 2. Create index | `./scripts/init-strattrack-index.sh` |
| 3. MCP deps | `cd mcp && npm install` |
| 4. Claude Desktop 4 (primary) | **[docs/MCP_CLAUDE_DESKTOP.md](docs/MCP_CLAUDE_DESKTOP.md)** — `.mcpb` or manual `mcpServers`. *Cursor:* copy **`.cursor/mcp.json.example`** |

More: **[docs/ELASTICSEARCH_LOCAL_ACCESS.md](docs/ELASTICSEARCH_LOCAL_ACCESS.md)** (curl, container shell), **[docs/MACOS_KEYCHAIN.md](docs/MACOS_KEYCHAIN.md)** (secrets), **[docs/GRANOLA_DRIVE_SFDC_AI_WORKFLOW.md](docs/GRANOLA_DRIVE_SFDC_AI_WORKFLOW.md)** (Drive / SFDC / IT brief).

## MCP & packaging

| Item | Notes |
|------|--------|
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
