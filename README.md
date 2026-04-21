# StratTrack

Elasticsearch-backed notes and search for **Solution Architects**, with **Salesforce** alignment in scope. **Team default:** StratTrack **MCP** (`elastic_add_note`, `elastic_search_opp`, `elastic_get_1_2_3`). **MemPalace** is optional for one person migrating old drawers — **[docs/MEMPALACE_MIGRATION.md](docs/MEMPALACE_MIGRATION.md)**.

**Remote:** `git@github.com:poulsbopete/strattrack.git`  
**Releases / npm package:** tag `v*` → GitHub Packages + `.mcpb` on Releases — **[docs/GITHUB_PUBLISH.md](docs/GITHUB_PUBLISH.md)**

## Quick start

| Step | Command / link |
|------|------------------|
| 1. Elasticsearch | `./scripts/build-elastic-docker.sh` |
| 2. Create index | `./scripts/init-strattrack-index.sh` |
| 3. MCP deps | `cd mcp && npm install` |
| 4. Wire Cursor / Claude | **[docs/MCP_CLAUDE_DESKTOP.md](docs/MCP_CLAUDE_DESKTOP.md)** (copy **`.cursor/mcp.json.example`**) |
| 5. MemPalace → ES (optional) | **[docs/MEMPALACE_MIGRATION.md](docs/MEMPALACE_MIGRATION.md)** |

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
