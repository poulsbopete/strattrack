# StratTrack

**Elasticsearch** semantic search, **Salesforce alignment**, and **team-scale** visibility for Solution Architect workflows.

**Team standard:** use the **StratTrack Elasticsearch MCP** (`elastic_*` tools) so assistants can **search**, **append notes** (`elastic_add_note`), and keep a **running indexed history** in the shared index — the supported replacement for ad-hoc “memory” in completions. **MemPalace** is an optional **personal** import path for one maintainer who already used it; other users do **not** install MemPalace (see **[docs/MEMPALACE_MIGRATION.md](docs/MEMPALACE_MIGRATION.md)** only for that one-off migration).

## Repository

**Remote:** `git@github.com:poulsbopete/strattrack.git`

## Requirements

These are the **platform and access** expectations for the end-to-end workflow (meeting capture → shared visibility → AI assistance → Salesforce → follow-ups). Details and IT copy-paste language: **[docs/GRANOLA_DRIVE_SFDC_AI_WORKFLOW.md](docs/GRANOLA_DRIVE_SFDC_AI_WORKFLOW.md)**.

### Meeting notes and leadership visibility

| Requirement | Purpose |
|---------------|---------|
| **Granola** (or org-approved equivalent) | Capture meeting notes and transcripts/summaries per your policy. |
| **Google Drive** — write access to a **Shared Drive** (team-owned) folder | Save notes so **managers can read** the same corpus (not only “My Drive” shared ad hoc). |
| **Automation into Drive** (often required) | Granola may need an **approved connector** (e.g. Zapier/Make) or export path so notes land in that folder **reliably**, not only manual export. |
| **Naming / metadata discipline** | Filenames or headers include **account / opportunity hints** so downstream matching to Salesforce is tractable. |

### Claude Desktop, Salesforce, and follow-ups

| Requirement | Purpose |
|---------------|---------|
| **Claude Desktop** (or org-approved assistant) | Interactive analysis over notes and CRM context; may use **MCP** or attachments per your setup. |
| **Salesforce (SFDC)** access for SAs | **Read** Opportunities (and related Account context); **append or update** the agreed **SA notes** location (field, Chatter, or custom object — **Sales Ops** defines the source of truth). |
| **Google Calendar** (or **SFDC Tasks**, if that is the team standard) | Create **reach-out / follow-up reminders** tied to customers or opportunities. |
| **APIs and admin consent** (typical IT checklist) | As needed: **Google Drive API** (list/read folder for automation), **Google Calendar API** (create events), **Salesforce API** (connected app / integration user with **minimal** scopes). |

### StratTrack runtime (this repository)

| Requirement | Purpose |
|---------------|---------|
| **Docker** or **Podman** | Run local **Elasticsearch** for search / MCP tooling (see below). |
| **Elasticsearch** | Durable store for notes and retrieval; exposed to assistants via **`mcp/strattrack-mcp.mjs`** (`elastic_*` tools). |
| **MCP client (Cursor / Claude Desktop)** | Wire **`strattrack-elasticsearch`** so completions can call **`elastic_add_note`** (append history) and **`elastic_search_opp`** / **`elastic_get_1_2_3`** (read context). |

### Security and compliance (do not skip)

| Requirement | Purpose |
|---------------|---------|
| **Data classification** for transcripts in Drive | Legal / InfoSec may require summary-only, retention, or customer-specific rules. |
| **External AI policy** | Clarify whether note content may be processed by **third-party** model APIs or must stay in **Google-only** (or other) tooling. |
| **No secrets in git** | API keys and OAuth live in env or secret stores — not committed to this repo. On Mac, prefer **Keychain** + **[docs/MACOS_KEYCHAIN.md](docs/MACOS_KEYCHAIN.md)** and `scripts/run-strattrack-mcp-from-keychain.sh` for the MCP server. |

## MCP (team: running history & completions)

StratTrack’s **stdio MCP server** (`mcp/strattrack-mcp.mjs`) is how **every user** should connect assistants to Elasticsearch: **append** context with `elastic_add_note`, **retrieve** it with `elastic_search_opp`, and draft updates with `elastic_get_1_2_3`. That replaces the *role* of personal MemPalace for the team — **without** requiring MemPalace on anyone’s machine.

| Doc | Purpose |
|-----|---------|
| **[docs/MCP_CLAUDE_DESKTOP.md](docs/MCP_CLAUDE_DESKTOP.md)** | Cursor / Claude Desktop MCP config, env vars, tool list |
| **`.cursor/mcp.json.example`** | Copy to `.cursor/mcp.json`, set absolute path to `strattrack-mcp.mjs` |
| **[docs/MACOS_KEYCHAIN.md](docs/MACOS_KEYCHAIN.md)** | Optional: API keys in **Apple Keychain** + wrapper script |
| **[docs/MEMPALACE_MIGRATION.md](docs/MEMPALACE_MIGRATION.md)** | **Optional, personal only:** one-time import from [MemPalace](https://github.com/MemPalace/mempalace) via `elastic_bulk_import_mempalace` |
| **[skills/strattrack-elasticsearch-mcp/SKILL.md](skills/strattrack-elasticsearch-mcp/SKILL.md)** | Cursor / agent skill (copy to `~/.cursor/skills-cursor/` if desired) |

```bash
cd mcp && npm install && node strattrack-mcp.mjs
```

`npm install` adds **`@modelcontextprotocol/sdk`** and **`zod`** (required for MCP tool schemas). No Elasticsearch Node client — uses **`fetch`** to the HTTP API.

## Local Elasticsearch (Docker or Podman)

From the repo root:

```bash
./scripts/build-elastic-docker.sh
```

The script uses **`docker compose`** if Docker is running, otherwise **`podman compose`** if Podman is running. To force one engine when both are installed:

```bash
STRATTRACK_CONTAINER_RUNTIME=podman ./scripts/build-elastic-docker.sh
STRATTRACK_CONTAINER_RUNTIME=docker ./scripts/build-elastic-docker.sh
```

**Podman Desktop (rootless):** if Elasticsearch exits because of **memory lock** (`mlock`), use the compat overlay (disables `bootstrap.memory_lock`):

```bash
./scripts/build-elastic-docker.sh --podman-compat
# or: STRATTRACK_PODMAN_COMPAT=1 ./scripts/build-elastic-docker.sh
```

Compose files: `docker/docker-compose.elasticsearch.yml` (single-node, security off for local dev). Optional merge: `docker/docker-compose.elasticsearch.podman-compat.yml`.

**Access / “login”:** default image has **no password** — open **[http://localhost:9200](http://localhost:9200)** or use `curl`. Shell into the container, optional Kibana/security: **[docs/ELASTICSEARCH_LOCAL_ACCESS.md](docs/ELASTICSEARCH_LOCAL_ACCESS.md)**.

**First-time index:** run **`./scripts/init-strattrack-index.sh`** (or MCP **`elastic_ensure_index`**) before `strattrack_drawers` exists — otherwise `_count` / search return `index_not_found_exception`.

**Stop** (use the same `-f` list you used to start, including `podman-compat` if applicable):

```bash
podman compose -f docker/docker-compose.elasticsearch.yml down
# with compat overlay:
podman compose -f docker/docker-compose.elasticsearch.yml -f docker/docker-compose.elasticsearch.podman-compat.yml down
```

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

**Convention:** When a change set is complete, **always push to `origin`** (not only local commit). Feature branches: `git push -u origin <branch>`; `main`: `git push origin main` after merge or direct commits.

```bash
git checkout -b feature/your-feature
# ... changes ...
git add .
git commit -m "feat: concise description"
git push -u origin feature/your-feature
# finishing on main:
git push origin main
```

## License

Proprietary / internal — confirm with repository owner.
