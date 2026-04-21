# StratTrack

Production-oriented successor to mempalace: **Elasticsearch semantic search**, **Salesforce alignment**, and **team-scale** visibility for Solution Architect workflows.

## Repository

**Remote:** `git@github.com:poulsbopete/strattrack.git`

## Status

| Phase | Description |
|-------|-------------|
| Phase 1 | Docker, Elasticsearch, mempalace migration, MCP server, documentation — **complete** (per project context) |
| Phase 2 | MCP tool hardening — **planning** ([docs/PHASE2_PLAN.md](docs/PHASE2_PLAN.md)) |
| Phase 3+ | Salesforce sync, dashboards — **documented / not in this skeleton** |

> **Note:** This checkout may contain planning docs only until the application tree (`mcp_server.js`, Docker assets, etc.) is copied or pushed from your primary development machine.

## Manager / IT brief (Granola → Drive → SFDC)

**[docs/GRANOLA_DRIVE_SFDC_AI_WORKFLOW.md](docs/GRANOLA_DRIVE_SFDC_AI_WORKFLOW.md)** — Shared Drive, Salesforce, Calendar, and how Claude Desktop fits; includes a copy-paste paragraph for leadership.

## Phase 2

See **[docs/PHASE2_PLAN.md](docs/PHASE2_PLAN.md)** for:

- Blocker-weighted search (`elastic_search_opp`)
- 1-2-3 blocker highlights (`elastic_get_1_2_3`)
- Auto-tagging on notes (`elastic_add_note`)
- Batch operations and error/logging standards

## Git workflow

```bash
git checkout -b feature/your-feature
# ... changes ...
git add .
git commit -m "feat: concise description"
git push -u origin feature/your-feature
```

## License

Proprietary / internal — confirm with repository owner.
