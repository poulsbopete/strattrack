# Thursday ONE–TWO–THREE for all relevant opportunities

**Goal:** Every **Thursday**, refresh **ONE–TWO–THREE** drafts for every **Salesforce Opportunity** you consider “relevant,” using whatever is already in **Elasticsearch** (StratTrack notes + `sfdc_*` rows from the poll worker). Output is **Markdown on disk** (and optionally a short **recap document per opp** back into Elasticsearch) so you can paste into **Salesforce**, **Google Drive**, or a Flow.

**Script:** `scripts/thursday-123-opportunities.mjs`  
**Shaping:** Same line ordering and blocker extraction as MCP **`elastic_get_1_2_3`** (`scripts/lib/strattrack-123.mjs`).

## Prerequisites

1. **Elasticsearch index** exists (`elastic_ensure_index` or `./scripts/init-strattrack-index.sh`).
2. **Content in the index** for those accounts/opps — e.g. `scripts/sfdc-poll-to-elasticsearch.mjs` on a schedule, plus **`elastic_add_note`** for SA narrative.
3. **Salesforce API** credentials (same env vars as the poll worker — see **[SFDC_POLL_ELASTICSEARCH.md](./SFDC_POLL_ELASTICSEARCH.md)**).

## “Relevant” opportunities

Override the SOQL with **`STRATTRACK_THURSDAY_SOQL`**. It **must** `FROM Opportunity` and include at least **`Id`**, **`Name`**, and ideally **`Account.Name`** (keyword match in Elasticsearch).

Default (open opps, recent first, cap 200):

```sql
SELECT Id, Name, StageName, Account.Name
FROM Opportunity
WHERE IsClosed = false
ORDER BY LastModifiedDate DESC
LIMIT 200
```

Examples you can adapt:

- **Stage filter:** `AND StageName IN ('Discovery','Qualification')`
- **Record type / territory:** add your org’s fields to `SELECT` and `WHERE`
- **Team pipe:** `AND OwnerId IN ('005…','005…')` or filter on a **custom “SA engaged”** checkbox

## Elasticsearch scope per opp

For each row, the script runs a **`multi_match`** (same fields/boosts as **`elastic_search_opp`**) plus an optional **`term` filter on `account`** when `Account.Name` is present.

Optional **time window** on indexed docs: set **`STRATTRACK_THURSDAY_ES_DAYS`** to a positive number to restrict to `created_at` within the last N days (default **0** = all time).

## Output

| Output | Location |
|--------|----------|
| One Markdown file per opp | `STRATTRACK_THURSDAY_OUT` (default **`thursday-123-output/`**) as `123-<OpportunityId>-<YYYY-MM-DD>.md` |
| Run manifest (JSON) | `manifest-<YYYY-MM-DD>.json` (hit counts, SOQL, instance URL) |

Directory is **gitignored** by default (see repo `.gitignore`).

## Optional: write recap rows back to Elasticsearch

Set **`STRATTRACK_THURSDAY_RECORD_TO_ES=true`** (or `=1`). Each opp gets an idempotent document:

`_id` = `strattrack:thursday:<OpportunityId>:<YYYY-MM-DD>`  
`source` = **`thursday_123`**

Useful so **next week’s search** surfaces “what we said last Thursday” without opening every Markdown file.

## Run manually

From the repo root, using the same env file as the poll worker (see **[SFDC_POLL_ELASTICSEARCH.md](./SFDC_POLL_ELASTICSEARCH.md)**):

```bash
./scripts/with-strattrack-env.sh node scripts/thursday-123-opportunities.mjs
```

Or set exports yourself, then `node scripts/thursday-123-opportunities.mjs`.

| Flag | Effect |
|------|--------|
| `--dry-run` | No files written; still queries Salesforce and Elasticsearch |
| `--verbose` | Per–opportunity hit counts on stderr |

## Cron: Thursday morning + keep ES fresh

Use **your** timezone in crontab (`crontab -e`). Example: **07:00 every Thursday** — poll CRM into ES, then generate 1–2–3s:

```cron
0 7 * * 4 /path/to/strattrack/scripts/with-strattrack-env.sh node /path/to/strattrack/scripts/sfdc-poll-to-elasticsearch.mjs >>/tmp/strattrack-sfdc-poll.log 2>&1
15 7 * * 4 /path/to/strattrack/scripts/with-strattrack-env.sh node /path/to/strattrack/scripts/thursday-123-opportunities.mjs >>/tmp/strattrack-thursday-123.log 2>&1
```

The wrapper sources **`~/.config/strattrack/env.sh`** (or **`.env.strattrack.local`** in the repo, or **`STRATTRACK_ENV_FILE`**) and **`cd`s to the repo** before running Node.

- Staggering **15 minutes** after the poll gives Elasticsearch time to refresh if you run a large catch-up.
- Optional **`STRATTRACK_THURSDAY_SOQL`** and other Thursday vars can live in the same env file.
- To pull **`ELASTICSEARCH_API_KEY`** from Keychain inside that file, see **[MACOS_KEYCHAIN.md](./MACOS_KEYCHAIN.md)**.

This repo **does not** PATCH Salesforce Opportunity fields yet. Practical Thursday flow today:

1. Run the script → open **`thursday-123-output/`** Markdown.
2. Paste **ONE / TWO / THREE** into your org’s agreed field (rich text, Chatter, or **SA Notes** custom object) — manually or via a **Flow** that reads from Drive if you upload the folder.

Automated **Salesforce writes** belong in a follow-up worker once **field API names** and **idempotency** (e.g. “last Thursday run id”) are fixed with Sales Ops.

---

*Operational doc — align SOQL and field access with your Salesforce admin.*
