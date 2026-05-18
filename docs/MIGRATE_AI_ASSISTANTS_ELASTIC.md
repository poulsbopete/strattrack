# Migrate StratTrack to the **ai-assistants** Elastic Cloud deployment

You shared the **Kibana** console URL:

`https://ai-assistants-ffcafb.kb.us-east-1.aws.elastic.cloud/`

StratTrack (MCP, poll worker, Thursday script) talks to the **Elasticsearch HTTP API**, not Kibana. Use the sibling **`.es.`** hostname (same project id and region):

**`ELASTICSEARCH_URL`**

```text
https://ai-assistants-ffcafb.es.us-east-1.aws.elastic.cloud
```

(No trailing slash. No `:443` required.)

Keep **`ELASTICSEARCH_API_KEY`** only in **`~/.config/strattrack/env.sh`** (or Keychain via **`scripts/run-strattrack-mcp-from-keychain.sh`**). Do not commit keys.

## 1. Point every tool at the new cluster

In **`~/.config/strattrack/env.sh`** (already updated on your machine):

```bash
export ELASTICSEARCH_URL="https://ai-assistants-ffcafb.es.us-east-1.aws.elastic.cloud"
export ELASTICSEARCH_API_KEY="…"   # Kibana → encoded API key
export STRATTRACK_INDEX="strattrack_drawers"   # optional; default is this
```

**Cursor MCP:** `.cursor/mcp.json` → same `ELASTICSEARCH_URL` + `ELASTICSEARCH_API_KEY`.

**Claude Desktop:** extension / `mcpServers` env → same values.

## 2. Create the index on the new cluster (if empty)

With destination env loaded (`source ~/.config/strattrack/env.sh` or `./scripts/with-strattrack-env.sh`):

```bash
./scripts/with-strattrack-env.sh ./scripts/init-strattrack-index.sh
```

Or from Cursor / Claude, run MCP tool **`elastic_ensure_index`** once.

## 3. Copy documents from an old cluster (optional)

Only if you still have data in **another** Elasticsearch (e.g. old `localhost`).

```bash
export ELASTICSEARCH_SOURCE_URL="http://localhost:9200"          # old cluster
# export ELASTICSEARCH_SOURCE_API_KEY="…"                        # if old cluster used auth
export STRATTRACK_SOURCE_INDEX="${STRATTRACK_SOURCE_INDEX:-strattrack_drawers}"

./scripts/with-strattrack-env.sh node scripts/reindex-strattrack-index.mjs
```

`with-strattrack-env.sh` loads **destination** credentials from `~/.config/strattrack/env.sh`; **source** vars must be set in the shell for that run.

## 4. Re-run Salesforce / Thursday jobs

Same env file:

```bash
./scripts/with-strattrack-env.sh node scripts/sfdc-poll-to-elasticsearch.mjs
./scripts/with-strattrack-env.sh node scripts/thursday-123-opportunities.mjs
```

Watermarks and outputs are local files; only **Elasticsearch** host changed.

---

*If `elastic_cluster_health` or `_bulk` fails with 401/403, confirm the API key role can write to the target index and that the URL uses **`.es.`**, not **`.kb.`**.*
