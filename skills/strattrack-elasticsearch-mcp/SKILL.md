---
name: strattrack-elasticsearch-mcp
description: StratTrack — Elasticsearch via MCP (Serverless or self-hosted). Tools elastic_add_note, elastic_search_opp, elastic_get_1_2_3. Requires ELASTICSEARCH_URL (+ API key for Elastic Cloud).
---

# StratTrack Elasticsearch MCP

## When to use

- **StratTrack + Elasticsearch** (intended **Elastic Cloud Serverless**) + MCP for **durable, searchable** context in completions.
- Configuring **Cursor** or **Claude Desktop** to call `elastic_*` tools.

## Prerequisites

1. **`ELASTICSEARCH_URL`** set to your cluster HTTPS endpoint (no default). **Elastic Cloud Serverless** also needs **`ELASTICSEARCH_API_KEY`** (Kibana “Encoded” value) unless you use Basic auth.
2. Optional **laptop-only** Elasticsearch: **`docs/ELASTICSEARCH_LOCAL_ACCESS.md`** — then `ELASTICSEARCH_URL=http://localhost:9200` is fine.
3. `cd mcp && npm install` once (from-source). **Claude Desktop:** install **`dist/strattrack-elasticsearch.mcpb`** or see **`docs/MCP_CLAUDE_DESKTOP.md`**.

## Workflow

1. **Health** — `elastic_cluster_health`.
2. **Index** — `elastic_ensure_index` (idempotent) or `./scripts/init-strattrack-index.sh` (with the same `ELASTICSEARCH_URL` / auth env).
3. **Ongoing** — `elastic_add_note` after meaningful sessions; `elastic_search_opp` / `elastic_get_1_2_3` when the model needs prior context.
4. **Optional bulk** — `elastic_bulk_import` (max 100 rows per call); prefer **`elastic_add_note`** for routine work.
5. **Salesforce** — **`scripts/sfdc-poll-to-elasticsearch.mjs`** (**`docs/SFDC_POLL_ELASTICSEARCH.md`**). Weekly **ONE–TWO–THREE**: **`scripts/thursday-123-opportunities.mjs`** (**`docs/THURSDAY_123_CRON.md`**). MCP **`elastic_sync_to_sf`** is a stub.

## Install as a Cursor skill (optional)

Copy or symlink this folder into your Cursor skills directory, e.g. `~/.cursor/skills-cursor/strattrack-elasticsearch-mcp/`.

## Conventions

- Logs from the MCP server go to **stderr** only.
- Do not commit **secrets**. On macOS use **Keychain** + `scripts/run-strattrack-mcp-from-keychain.sh` (**`docs/MACOS_KEYCHAIN.md`**).
