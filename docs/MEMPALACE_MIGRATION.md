# MemPalace → Elasticsearch (optional)

**Who:** Only you if you already use [MemPalace](https://github.com/MemPalace/mempalace). **Everyone else:** use the StratTrack MCP only — **[MCP_CLAUDE_DESKTOP.md](./MCP_CLAUDE_DESKTOP.md)**.

The script reads your palace from disk (Chroma) and writes to local Elasticsearch. No separate MemPalace export file is required.

## Steps

1. **Start Elasticsearch** (repo root): `./scripts/build-elastic-docker.sh`  
   Podman + mlock failures: `./scripts/build-elastic-docker.sh --podman-compat`.

2. **Install deps** (repo root):

   ```bash
   pip install -r scripts/requirements-mempalace-migrate.txt
   ```

3. **Optional:** palace not at `~/.mempalace/palace` → `export MEMPALACE_PALACE_PATH=/path/to/palace`

4. **Check count:** `python3 scripts/mempalace_to_elasticsearch.py --dry-run`

5. **Import:** `python3 scripts/mempalace_to_elasticsearch.py --ensure-index`  
   (`--ensure-index` creates the index if needed; same mapping as StratTrack MCP.)

6. **Verify:** `curl -s "http://localhost:9200/strattrack_drawers/_count?pretty"`

**Secured Elasticsearch** (not default Docker dev): set `ELASTICSEARCH_API_KEY` or `ELASTICSEARCH_BASIC_AUTH` before step 5.

**Huge palaces:** add `--batch-size 500 --bulk-docs 200` if needed.

Afterward: back up your palace until you are sure, then use **`elastic_add_note`** like the rest of the team.

## MCP alternative (small batches)

MCP tool **`elastic_bulk_import_mempalace`** — max 100 rows per call; fine for tests, slow at 90k+ drawers. Prefer the script above.

## References

- MemPalace: `https://github.com/MemPalace/mempalace`
- Elasticsearch access (Docker, curl): **[ELASTICSEARCH_LOCAL_ACCESS.md](./ELASTICSEARCH_LOCAL_ACCESS.md)**
