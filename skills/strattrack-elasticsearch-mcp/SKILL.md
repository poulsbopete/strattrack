---
name: strattrack-elasticsearch-mcp
description: StratTrack team standard — local Elasticsearch via MCP for running history and completions (elastic_add_note, elastic_search_opp, elastic_get_1_2_3). Wire Cursor/Claude to strattrack-mcp.mjs.
---

# StratTrack Elasticsearch MCP

## When to use

- **Default for all users:** StratTrack + **local Elasticsearch** (Docker/Podman) + MCP for **durable, searchable** context and **running history** in completions.
- Configuring **Cursor** or **Claude Desktop** to call `elastic_*` tools.

## Prerequisites

1. Repo path available; under repo: `./scripts/build-elastic-docker.sh` (or Podman compat variant) brings up **http://localhost:9200**.
2. `cd mcp && npm install` once.
3. **Claude Desktop:** install **`dist/strattrack-elasticsearch.mcpb`** (run `./scripts/build-strattrack-mcpb.sh` first) or add a manual `mcpServers` entry — **`docs/MCP_CLAUDE_DESKTOP.md`**.

## Workflow

1. **Health** — `elastic_cluster_health`.
2. **Index** — `elastic_ensure_index` (idempotent) or `./scripts/init-strattrack-index.sh`.
3. **Ongoing (everyone)** — `elastic_add_note` after meaningful sessions; `elastic_search_opp` / `elastic_get_1_2_3` when the model needs prior context.
4. **Optional bulk** — `elastic_bulk_import` for up to 100 rows per call when you have batched wing/room/content; prefer **`elastic_add_note`** for routine work. See **`docs/MCP_CLAUDE_DESKTOP.md`**.
5. **Salesforce** — `elastic_sync_to_sf` is a stub until Phase 3+.

## Install as a Cursor skill (optional)

Copy or symlink this folder into your Cursor skills directory so the agent loads it automatically, e.g.:

`~/.cursor/skills-cursor/strattrack-elasticsearch-mcp/`

Point `SKILL.md` at the same content as this file.

## Conventions

- Logs from the MCP server go to **stderr** only.
- Do not commit **secrets**. On macOS use **Keychain** + `scripts/run-strattrack-mcp-from-keychain.sh` (see **`docs/MACOS_KEYCHAIN.md`**). Non-secret URLs may stay in Claude Desktop `env`.
