# MemPalace → StratTrack (optional, personal import)

> **Audience:** the **one maintainer** who already used [MemPalace](https://github.com/MemPalace/mempalace). **All other Solution Architects** should **not** install MemPalace. Their supported workflow is: **StratTrack Elasticsearch MCP** + **`elastic_add_note`** / **`elastic_search_opp`** / **`elastic_get_1_2_3`** for running history and completions — see **[MCP_CLAUDE_DESKTOP.md](./MCP_CLAUDE_DESKTOP.md)**.

MemPalace models memory as **wings**, **rooms**, and **drawers** (verbatim content). If you are migrating *your* palace, StratTrack stores those shapes in Elasticsearch so you can **search**, **filter**, and align with **Salesforce** fields like everyone else.

This repo does **not** embed the MemPalace Python package. You export or extract drawers yourself, then ingest with the MCP tool **`elastic_bulk_import_mempalace`** (same JSON shape can be used for any wing/room–style bulk load, not only MemPalace).

## Target document shape

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

## MCP import (`elastic_bulk_import_mempalace`)

- Pass an **`items`** array (max **100** objects per call).
- Set **`mempalace_drawer_id`** whenever you have MemPalace’s drawer id so re-imports **overwrite** the same Elasticsearch `_id`.
- For large palaces (~94K drawers), split into **940+** batches of 100 (script locally or use Claude with the MCP tool in a loop reading from a file you paste in chunks).

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

Always call **`elastic_ensure_index`** once before the first bulk import.

## Export options from MemPalace

MemPalace ships an MCP server with many tools (list wings/rooms, search, add drawer, etc.). Practical migration paths:

1. **Custom small exporter (recommended for large palaces)**  
   In a Python environment with `mempalace` installed, use the [Python API](https://mempalaceofficial.com/reference/python-api.html) or your palace’s SQLite/Chroma layout to iterate drawers and print JSON lines. Feed batches into `elastic_bulk_import_mempalace` via Claude or a local Node script.

2. **MCP-assisted export**  
   If your client allows long tool output, you can call MemPalace MCP search/list tools and reshape results into the `items` format. This is usually **slow** for tens of thousands of drawers; prefer a scripted exporter.

3. **CSV / JSON export**  
   If you already have MemPalace’s historical CSV export (see MemPalace docs), map columns to `wing`, `room`, `content`, `title`, and a generated or stored drawer id column.

## After your import (if you ran one)

You converge on the **same team workflow** as everyone else:

- **`elastic_add_note`** for new notes and running history.
- **`elastic_search_opp`** / **`elastic_get_1_2_3`** for retrieval and summaries.
- **[PHASE2_PLAN.md](./PHASE2_PLAN.md)** for ranking and auto-tagging improvements.

## References

- MemPalace repo: `https://github.com/MemPalace/mempalace`
- MemPalace MCP tools: `https://mempalaceofficial.com/reference/mcp-tools.html`
