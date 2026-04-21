# MemPalace → StratTrack (optional, personal import)

> **Audience:** the **one maintainer** who already used [MemPalace](https://github.com/MemPalace/mempalace). **All other Solution Architects** should **not** install MemPalace. Their supported workflow is: **StratTrack Elasticsearch MCP** + **`elastic_add_note`** / **`elastic_search_opp`** / **`elastic_get_1_2_3`** for running history and completions — see **[MCP_CLAUDE_DESKTOP.md](./MCP_CLAUDE_DESKTOP.md)**.

MemPalace stores **drawers** (verbatim text) in **ChromaDB** under your **palace** directory (`chroma.sqlite3` + data). StratTrack keeps the same content in **Elasticsearch** (`strattrack_drawers`) so you can search it with the **`elastic_*`** MCP tools and retire MemPalace when you are satisfied.

---

## End-to-end: export from MemPalace → import into Docker Elasticsearch

There are two concepts:

| Step | What happens |
|------|----------------|
| **Export (read)** | The migration script **reads** your MemPalace palace directly from disk (Chroma). You do **not** need a separate MemPalace “export file” for this path. |
| **Import (write)** | The script **POSTs** documents to your **local Elasticsearch** (e.g. Docker/Podman on `localhost:9200`) using the same index mapping as StratTrack’s MCP. |

### 1. Start StratTrack’s Elasticsearch (Docker or Podman)

From your **StratTrack** repo root:

```bash
./scripts/build-elastic-docker.sh
# Podman rootless + mlock errors:
# ./scripts/build-elastic-docker.sh --podman-compat
```

Confirm the API responds (no auth in the default dev image):

```bash
curl -s http://localhost:9200 | head -c 200
```

You should see JSON with `"cluster_name"` (e.g. `strattrack-local`). More detail: **[ELASTICSEARCH_LOCAL_ACCESS.md](./ELASTICSEARCH_LOCAL_ACCESS.md)**.

### 2. Python environment + MemPalace dependencies

Use **Python 3.9+** (same range as [MemPalace](https://github.com/MemPalace/mempalace)). From the **StratTrack repo root**:

```bash
cd /path/to/strattrack
python3 -m venv .venv-migrate
source .venv-migrate/bin/activate   # Windows: .venv-migrate\Scripts\activate
pip install -r scripts/requirements-mempalace-migrate.txt
```

That installs **`mempalace`** (and its **ChromaDB** stack) so the script can open your palace.

### 3. Point the script at your palace (if not the default)

MemPalace’s default palace path is **`~/.mempalace/palace`** (override with **`MEMPALACE_PALACE_PATH`** in config or env).

Check that the palace exists:

```bash
ls ~/.mempalace/palace/chroma.sqlite3
```

If your palace lives elsewhere:

```bash
export MEMPALACE_PALACE_PATH="/absolute/path/to/your/palace"
```

Optional: non-default Chroma collection name (rare):

```bash
export MEMPALACE_COLLECTION="mempalace_drawers"
```

### 4. Dry run (counts drawers, does not write to Elasticsearch)

```bash
python3 scripts/mempalace_to_elasticsearch.py --dry-run
```

You should see `drawer_count` in JSON matching what you expect from MemPalace.

### 5. Create the Elasticsearch index (first time only)

Recommended once before the first full import:

```bash
./scripts/init-strattrack-index.sh
```

Alternatively, **`python3 scripts/mempalace_to_elasticsearch.py --ensure-index`** creates the index at the start of a **non–dry-run** import (see step 6). **`--dry-run`** does not write to Elasticsearch and does **not** create the index.

### 6. Full import into Docker Elasticsearch

Default ES URL is **`http://localhost:9200`**; default index is **`strattrack_drawers`**.

```bash
python3 scripts/mempalace_to_elasticsearch.py --ensure-index
```

The script:

1. Optionally creates **`strattrack_drawers`** from **`docker/strattrack-drawers-index.json`** (`--ensure-index`).
2. Reads all drawers from Chroma in batches.
3. Sends **`_bulk`** index requests to Elasticsearch (same `_id` as MemPalace drawer id for safe re-runs).

**If Elasticsearch has security enabled** (not the default StratTrack Docker image), set before running:

```bash
export ELASTICSEARCH_API_KEY="your-kibana-encoded-api-key"
# or
export ELASTICSEARCH_BASIC_AUTH="base64(username:password)"
```

**Tuning large palaces** (tens of thousands of drawers):

| Flag | Default | Purpose |
|------|---------|---------|
| `--batch-size` | `200` | How many drawers to read from Chroma per `get()`. |
| `--bulk-docs` | `100` | How many documents per Elasticsearch `_bulk` request. |

Example:

```bash
python3 scripts/mempalace_to_elasticsearch.py --ensure-index --batch-size 500 --bulk-docs 200
```

### 7. Verify documents in Elasticsearch

```bash
curl -s "http://localhost:9200/strattrack_drawers/_count?pretty"
```

Spot-check a search:

```bash
curl -s "http://localhost:9200/strattrack_drawers/_search?pretty" \
  -H 'Content-Type: application/json' \
  -d '{"size":1,"query":{"match_all":{}}}'
```

Then use the StratTrack MCP **`elastic_search_opp`** in Cursor/Claude with a query you know exists in MemPalace.

### 8. After a good import

- Keep a **backup** of your MemPalace palace directory until you are confident.
- Remove MemPalace from MCP clients if you no longer need it.
- Use **`elastic_add_note`** for new work (same index as everyone else on the team workflow).

---

## What the script maps (MemPalace → Elasticsearch)

| MemPalace / Chroma | Elasticsearch field |
|--------------------|------------------------|
| Drawer id | `_id` and `mempalace_drawer_id` |
| Document body | `content` |
| Metadata `wing`, `room` | `wing`, `room` |
| Metadata `title` / `drawer_title` / `name` | `title` |
| — | `source` = `mempalace_migration_script` |
| Metadata timestamps (if present) | `created_at`, `note_date` |

See **`scripts/mempalace_to_elasticsearch.py`** for exact logic.

---

## Target document shape (for MCP or manual bulk)

Each indexed document can include:

| Field | Type | Notes |
|-------|------|--------|
| `content` | string (required) | Verbatim drawer body |
| `title` | string | Optional headline |
| `wing` | string | MemPalace wing |
| `room` | string | MemPalace room |
| `mempalace_drawer_id` | string | **Strongly recommended** — stable id for upserts and re-runs |
| `account`, `opportunity`, `stage` | strings | StratTrack / SFDC alignment (optional during migration) |
| `blocker_tags` | string[] | Optional; improves search + `elastic_get_1_2_3` |

---

## Alternative: MCP import (`elastic_bulk_import_mempalace`)

If you are not using the Python script, you can push JSON batches through the MCP tool (max **100** `items` per call):

- Set **`mempalace_drawer_id`** on each item so re-imports **overwrite** the same Elasticsearch `_id`.
- For very large palaces, split into many MCP calls (slow for ~94K drawers — **prefer the script above**).

Example payload (conceptual):

```json
{
  "items": [
    {
      "wing": "otto",
      "room": "blockers",
      "title": "Cost anomaly discussion",
      "content": "Full verbatim note text…",
      "mempalace_drawer_id": "drawer-abc123"
    }
  ],
  "source": "mempalace_migration"
}
```

Always ensure the index exists once: **`elastic_ensure_index`** MCP tool or **`./scripts/init-strattrack-index.sh`**.

---

## Other export paths (optional)

1. **MemPalace Python API** — programmatic listing beyond the script: [Python API](https://mempalaceofficial.com/reference/python-api.html).
2. **MemPalace MCP** — list/search tools work for small samples; reshaping to `items` for **`elastic_bulk_import_mempalace`** is tedious at scale.
3. **CSV from MemPalace** — if you use MemPalace’s historical CSV export, map columns to `wing`, `room`, `content`, `title`, and a stable id column, then bulk index (script or custom tooling).

---

## After your import (if you ran one)

You converge on the **same team workflow** as everyone else:

- **`elastic_add_note`** for new notes and running history.
- **`elastic_search_opp`** / **`elastic_get_1_2_3`** for retrieval and summaries.
- **[PHASE2_PLAN.md](./PHASE2_PLAN.md)** for ranking and auto-tagging improvements.

---

## References

- MemPalace repo: `https://github.com/MemPalace/mempalace`
- MemPalace MCP tools: `https://mempalaceofficial.com/reference/mcp-tools.html`
