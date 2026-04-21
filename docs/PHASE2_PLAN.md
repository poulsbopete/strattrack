# StratTrack Phase 2 — MCP Production Plan

**Goal:** Harden the four MCP tools for daily Solution Architect use without breaking existing Claude workflows or the Elasticsearch index schema.

**Reference implementation:** `mcp_server.js` (add when present in this repo).

---

## Principles

1. **No breaking MCP contracts** — Same tool names, same required parameters, same response shapes unless versioned (prefer additive fields: `blockers[]`, `warnings[]`).
2. **Schema stability** — Blocker boosts and auto-tagging must work with current mappings; any new fields are optional with safe defaults.
3. **No new npm dependencies** in Phase 2 unless explicitly approved (security + supply chain).
4. **Observability** — Structured logs (level, tool, latency, error class); no `console.log` noise in hot paths.

---

## Workstream 1 — Search ranking (`elastic_search_opp`)

**Problem:** Blocker-heavy opportunities (RUM parity, cost anomaly, billing, OTel RUM) should rank above generic keyword matches.

**Approach:**

- Keep primary retrieval as **BM25** (or current `multi_match` / `bool`) on `content`, `opportunity`, and related text fields.
- Add **explicit boosts** for blocker signals, for example:
  - **2× effective weight** (via `function_score` or separate `should` clauses with `constant_score` + `weight: 2`) on:
    - `blocker_tags` (keyword / terms)
    - Optional: a dedicated `blocker_summary` or `blocker_keywords` field if present in mapping
  - Lighter boost (e.g. 1.25×) on phrases in a curated **blocker lexicon** (RUM, OTel, billing, GovCloud, anomaly, parity, etc.) using `match_phrase` in `should` clauses (tunable without reindex if using query-time lists).
- Preserve **filters** (`account_filter`, `stage_filter`) as `filter` context so they do not affect score unless product requires it.
- **Pagination / size cap:** Respect `limit` with a hard ceiling (e.g. 50) to protect the cluster.

**Acceptance:**

- For fixture queries (“RUM blocker USAA”, “OTTO cost anomaly Dynatrace”), top-3 contains the expected opportunity IDs in dev/staging with sample data.
- Empty query and zero hits return clear JSON (no thrown errors).

---

## Workstream 2 — 1-2-3 generation (`elastic_get_1_2_3`)

**Problem:** Weekly updates must surface **ONE / TWO / THREE** with blockers visible in the first screen of context.

**Approach:**

- After fetching recent notes / opportunity payload, **derive a blocker list** (from `blocker_tags`, lexicon hits in note bodies, or highest-scoring snippets from search).
- Output structure (additive):
  - `one`, `two`, `three` — unchanged semantics where possible.
  - `blockers_highlight[]` — `{ type, summary, opportunity_id, account }` capped (e.g. 5 items).
  - `stale_warning` optional if last activity > N days.
- Reuse the same **lexicon / tag rules** as search so “what ranks” matches “what shows in 1-2-3”.

**Acceptance:**

- OTTO / PayPal / USAA-style fixtures show blockers in `blockers_highlight` when notes contain those themes.
- Generation completes within product target (< 5 min wall clock is workflow; instrument p95 latency in logs).

---

## Workstream 3 — Auto-tag blockers (`elastic_add_note`)

**Problem:** Notes should enrich Elasticsearch so future search and 1-2-3 improve without manual tagging.

**Approach:**

- On ingest, run **deterministic tagging** first (regex / keyword rules from the shared lexicon → append to `blocker_tags` or a nested structure the mapping already supports).
- Optional second phase (later): lightweight ML / NLP — **out of scope** for initial Phase 2 unless mapping already supports it.
- **Idempotency:** Merging tags must dedupe; do not duplicate the same tag on every edit.
- Return the stored document snippet including **final `blocker_tags`** so the agent can confirm.

**Acceptance:**

- Adding a note mentioning “RUM parity” results in appropriate tags on read-back.
- No duplicate tags after repeated updates to the same opportunity note stream (if applicable).

---

## Workstream 4 — Batch operations

**Problem:** Multiple opportunities need the same operation (e.g. sync prep, bulk note append, bulk re-tag).

**Approach:**

- Prefer **new optional tool** or **optional array parameter** on an existing tool only if backward compatible (e.g. `elastic_add_note` accepts `notes: [{ opportunity_id, text }, ...]` with max batch size).
- Enforce **max batch** (e.g. 25) and **per-item errors** in response: `{ results: [], errors: [{ id, message }] }`.
- Single round-trip to ES where possible (`mget`, `_bulk`).

**Acceptance:**

- Partial failure does not fail the entire batch; caller can retry failed IDs.

---

## Workstream 5 — Error handling and logging

**Approach:**

- Every async path: **try/catch**; return `{ error: string, code?: string }` for MCP consumers.
- Log: `tool`, `duration_ms`, `index`, `httpStatus` (if ES), sanitized message (no secrets, no full note bodies in error logs unless debug flag).
- Centralize ES client error mapping (timeout → user message vs. mapping error).

**Acceptance:**

- Elasticsearch down → structured log + clear MCP error string.
- No unhandled promise rejections on invalid params.

---

## Implementation order (recommended)

| Order | Workstream | Rationale |
|-------|------------|-----------|
| 1 | Search ranking | Upstream signal for everything else |
| 2 | Shared blocker lexicon module | Single source for search + 1-2-3 + tagging |
| 3 | 1-2-3 highlights | Reuses lexicon + tags |
| 4 | Auto-tag on add note | Closes the feedback loop |
| 5 | Batch + logging polish | Production hardening |

---

## Testing (before merge to `main`)

- [ ] Sample data: OTTO (cost / Serverless), USAA (RUM), PayPal (RUM), Cisco GovCloud (billing) scenarios
- [ ] Edge: empty query, no hits, ES timeout, malformed IDs
- [ ] Regression: existing Claude prompts still parse tool JSON
- [ ] Logs: one line per tool invocation at info; debug gated

---

## Out of scope for Phase 2 (needs explicit sign-off)

- Elasticsearch mapping changes without migration plan
- New npm packages
- Salesforce write path beyond “prepare sync” stub unless Phase 3 is in scope
- Breaking renames of tools or removal of fields

---

## Success metrics (recap)

- Search precision > 80% on curated blocker query set (measure in dev with labeled fixtures).
- 1-2-3 consistently lists top blockers without manual curation.
- Tags appear automatically on representative notes.
- No production incidents from log volume or unhandled errors in MCP path.

---

*Document version: 1.0 — aligned with Phase 2 scope described in project context.*
