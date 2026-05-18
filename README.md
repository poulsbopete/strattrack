# StratTrack

Searchable notes for **Solution Architects**: index text into **Elasticsearch** (intended **Elastic Cloud Serverless**), recall it from **Cursor / Claude** via the **MCP** (`elastic_add_note`, `elastic_search_opp`, `elastic_get_1_2_3`). Optional **Salesforce** sync and weekly **ONE–TWO–THREE** scripts live in `scripts/`.

**Repository:** [github.com/poulsbopete/strattrack](https://github.com/poulsbopete/strattrack) — documentation in the **`main`** branch (and this README) updates when changes are **pushed** to GitHub. If the site looks stale, pull latest or ask the repo owner to push.

## Quick start (Serverless)

1. Create an **Elasticsearch** project in **Elastic Cloud** (Serverless is fine) and an **API key**.
2. Clone this repo (for scripts, docs, and MCP from source—or use the **`.mcpb`** release only).
3. Set **`ELASTICSEARCH_URL`** (HTTPS endpoint, no trailing slash) and **`ELASTICSEARCH_API_KEY`** wherever you configure the MCP (Cursor **`.cursor/mcp.json`**, Claude Desktop extension env, or [scripts/with-strattrack-env.sh](scripts/with-strattrack-env.sh) + [scripts/strattrack-env.example.sh](scripts/strattrack-env.example.sh)).
4. Start the MCP and run **`elastic_ensure_index`** once (or `./scripts/init-strattrack-index.sh` with the same env).

**Why bother:** durable, **searchable** history so the model can **pull prior notes** instead of you re-pasting long context—fewer tokens on follow-ups.

## MCP (Cursor & Claude)

| Path | Notes |
|------|--------|
| **Releases** | [Releases](https://github.com/poulsbopete/strattrack/releases) → **`strattrack-elasticsearch.mcpb`** — set extension env to your **`ELASTICSEARCH_URL`** + **`ELASTICSEARCH_API_KEY`** |
| **From source** | `cd mcp && npm install` → run `mcp/strattrack-mcp.mjs`; Cursor: **`.cursor/mcp.json.example`** → **`.cursor/mcp.json`** |
| **Details** | [docs/MCP_CLAUDE_DESKTOP.md](docs/MCP_CLAUDE_DESKTOP.md) |

`ELASTICSEARCH_URL` is **required**; there is no silent default.

### Salesforce (optional — poll & Thursday scripts only)

The **MCP does not use `SF_*`**. Those variables apply only if you run **`scripts/sfdc-poll-to-elasticsearch.mjs`** or **`scripts/thursday-123-opportunities.mjs`**. You can omit or comment out all Salesforce lines in `~/.config/strattrack/env.sh` until you need them.

- **No App Manager?** Use **[docs/SALESFORCE_NO_APP_MANAGER.md](docs/SALESFORCE_NO_APP_MANAGER.md)** (Salesforce CLI or browser `sid`) — set **`STRATTRACK_SF_ACCESS_TOKEN`** + **`STRATTRACK_SF_INSTANCE_URL`** and comment out JWT.
- **Consumer Key (`SF_CLIENT_ID`)** — only if you have App Manager: **[docs/SALESFORCE_JWT_ENV.md](docs/SALESFORCE_JWT_ENV.md)**.
- **`SF_AUDIENCE`** — **`https://login.salesforce.com`** (prod) or **`https://test.salesforce.com`** (sandbox) — **not** `*.lightning.force.com`.

Full poll/cron doc: [docs/SFDC_POLL_ELASTICSEARCH.md](docs/SFDC_POLL_ELASTICSEARCH.md) · Thursday 1–2–3: [docs/THURSDAY_123_CRON.md](docs/THURSDAY_123_CRON.md)

## Optional: laptop Elasticsearch (Docker / Podman)

For offline or local-only dev, you can run Elasticsearch on **localhost** and set `ELASTICSEARCH_URL=http://localhost:9200` (often no API key). See **[docs/ELASTICSEARCH_LOCAL_ACCESS.md](docs/ELASTICSEARCH_LOCAL_ACCESS.md)** and `./scripts/quickstart-local-es.sh`.

## Salesforce & automation (optional)

| Script | Purpose |
|--------|---------|
| [scripts/with-strattrack-env.sh](scripts/with-strattrack-env.sh) | Load `ELASTICSEARCH_*` + Salesforce vars from `~/.config/strattrack/env.sh` |
| [scripts/sfdc-poll-to-elasticsearch.mjs](scripts/sfdc-poll-to-elasticsearch.mjs) | Poll SF by `LastModifiedDate` → ES |
| [scripts/thursday-123-opportunities.mjs](scripts/thursday-123-opportunities.mjs) | Weekly ONE–TWO–THREE Markdown per Opportunity |
| [scripts/print-sf-cli-session.mjs](scripts/print-sf-cli-session.mjs) | Use your **`sf`** CLI session instead of JWT |

Docs: [docs/SFDC_POLL_ELASTICSEARCH.md](docs/SFDC_POLL_ELASTICSEARCH.md) · [docs/THURSDAY_123_CRON.md](docs/THURSDAY_123_CRON.md) · [docs/SALESFORCE_NO_APP_MANAGER.md](docs/SALESFORCE_NO_APP_MANAGER.md) · [docs/SALESFORCE_JWT_ENV.md](docs/SALESFORCE_JWT_ENV.md)

## More docs

- [docs/index.html](docs/index.html) — SA pitch deck (GitHub Pages: `main` / `docs`)
- [docs/MACOS_KEYCHAIN.md](docs/MACOS_KEYCHAIN.md) — API keys via Keychain
- [docs/GRANOLA_DRIVE_SFDC_AI_WORKFLOW.md](docs/GRANOLA_DRIVE_SFDC_AI_WORKFLOW.md) — Granola → Drive → SFDC brief
- [docs/MIGRATE_AI_ASSISTANTS_ELASTIC.md](docs/MIGRATE_AI_ASSISTANTS_ELASTIC.md) — team Elastic Cloud endpoint (`.es.` vs `.kb.`) + optional reindex
- [docs/SALESFORCE_NO_APP_MANAGER.md](docs/SALESFORCE_NO_APP_MANAGER.md) — no App Manager: CLI or browser `sid`
- [docs/SALESFORCE_JWT_ENV.md](docs/SALESFORCE_JWT_ENV.md) — Consumer Key + `SF_AUDIENCE` (when you have admin)

Proprietary / internal — confirm with the repository owner.
