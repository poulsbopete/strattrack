---
name: strattrack-elasticsearch-mcp
description: Use StratTrack local Elasticsearch via MCP (MemPalace replacement). Start ES with Docker/Podman, wire Claude Desktop to strattrack-mcp, ensure index, migrate MemPalace drawers in batches, then search and 1-2-3 tools.
---

# StratTrack Elasticsearch MCP

## When to use

- Working in **StratTrack** with **local Elasticsearch** (Docker or Podman).
- Replacing or complementing **[MemPalace](https://github.com/MemPalace/mempalace)** with ES-backed search and notes.
- Configuring **Claude Desktop** (or any MCP client) to call `elastic_*` tools.

## Prerequisites

1. Repo path available; under repo: `./scripts/build-elastic-docker.sh` (or Podman compat variant) brings up **http://localhost:9200**.
2. `cd mcp && npm install` once.
3. Claude Desktop MCP entry: `node /absolute/path/to/strattrack/mcp/strattrack-mcp.mjs` with optional `ELASTICSEARCH_URL` and `STRATTRACK_INDEX`. See repo **`docs/MCP_CLAUDE_DESKTOP.md`**.

## Workflow

1. **Health** — `elastic_cluster_health`.
2. **Index** — `elastic_ensure_index` (idempotent).
3. **MemPalace migration** — reshape exports into `items` for `elastic_bulk_import_mempalace` (max 100 per call). See **`docs/MEMPALACE_MIGRATION.md`**.
4. **Daily use** — `elastic_add_note`, `elastic_search_opp`, `elastic_get_1_2_3`.
5. **Salesforce** — `elastic_sync_to_sf` is a stub until Phase 3+.

## Install as a Cursor skill (optional)

Copy or symlink this folder into your Cursor skills directory so the agent loads it automatically, e.g.:

`~/.cursor/skills-cursor/strattrack-elasticsearch-mcp/`

Point `SKILL.md` at the same content as this file.

## Conventions

- Logs from the MCP server go to **stderr** only.
- Do not commit **secrets**; use Claude env or Desktop `env` block for URLs if non-default.
