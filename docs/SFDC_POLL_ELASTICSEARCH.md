# Salesforce → Elasticsearch (LastModifiedDate polling)

Poll **Task**, **Event**, and **Opportunity** via the Salesforce REST API, then **bulk upsert** into the same StratTrack index the MCP uses (`elastic_add_note` shape: `content`, `title`, `account`, `opportunity`, `stage`, `source`, `note_date`, `created_at`, stable `_id` via `mempalace_drawer_id` pattern `sfdc:<Type>:<Id>`).

Designed for **Elasticsearch Serverless** or any cluster reachable with `ELASTICSEARCH_URL` + `ELASTICSEARCH_API_KEY` (or `ELASTICSEARCH_BASIC_AUTH`).

## Watermarks

Per-object high-water marks live in **`STRATTRACK_SFDC_WATERMARK_FILE`** (default: **`.strattrack-sfdc-watermark.json`** in the current working directory). The file is **gitignored**.

- Each run: `WHERE LastModifiedDate > <saved watermark>` (strict `>`), ascending sort, full pagination until no `nextRecordsUrl`.
- After a successful bulk index for that object type, the watermark becomes the **maximum `LastModifiedDate`** seen in that run (unchanged if the query returned no rows).

First run (no state file): watermarks start at **`now - STRATTRACK_SFDC_INITIAL_LOOKBACK_DAYS`** (default **30**).

## Salesforce auth

### If you cannot use JWT (no integration user / no cert, **or no App Manager**)

**Start here:** **[docs/SALESFORCE_NO_APP_MANAGER.md](./SALESFORCE_NO_APP_MANAGER.md)** — Salesforce CLI (`sf`) or browser **`sid`** session → **`STRATTRACK_SF_ACCESS_TOKEN`** + **`STRATTRACK_SF_INSTANCE_URL`** (no Consumer Key).

StratTrack also supports (see **`scripts/strattrack-env.example.sh`**):

1. **Bearer token from Salesforce CLI (your user)** — Install **`sf`**, run **`sf org login web`**, then:
   ```bash
   eval "$(node scripts/print-sf-cli-session.mjs --org YOUR_ALIAS)"
   ./scripts/with-strattrack-env.sh node scripts/sfdc-poll-to-elasticsearch.mjs
   ```
   Or paste the printed **`STRATTRACK_SF_ACCESS_TOKEN`** and **`STRATTRACK_SF_INSTANCE_URL`** into `~/.config/strattrack/env.sh`.  
   **Caveats:** tokens expire; unattended **cron** will break until you re-login — fine for laptop / weekly manual runs.

2. **OAuth password grant** — **`SFDC_AUTH_MODE=password`** with **`SF_CLIENT_ID`**, **`SF_CLIENT_SECRET`**, **`SF_USERNAME`**, **`SF_PASSWORD`** (password + security token). Uses **your** username, not necessarily an integration user. Many orgs **disable** this flow.

3. **JWT + integration user** (below) — best for **headless** schedules once admins approve it.

### JWT bearer flow (recommended for headless workers)

Step-by-step for **Consumer Key**, **`SF_AUDIENCE`**, and cert/key: **[docs/SALESFORCE_JWT_ENV.md](./SALESFORCE_JWT_ENV.md)**.

Summary:

1. Create a **Connected App** with **Use digital signatures** enabled; upload your certificate; note the **Consumer Key** (`iss` / client id).
2. Create a **permission set** (or profile) for the integration user: **API Enabled**, plus read on **Task**, **Event**, **Opportunity**, **Account** (and any fields you add to the SOQL in the script).
3. **Manage user** on the Connected App → assign the integration user.
4. Store the **private key** (PEM) locally; never commit it.

| Env | Meaning |
|-----|---------|
| `SF_CLIENT_ID` | Connected App consumer key |
| `SF_USERNAME` | Integration user username |
| `SF_AUDIENCE` | **Only** `https://login.salesforce.com` (prod) or `https://test.salesforce.com` (sandbox) — never your `*.lightning.force.com` URL |
| `SF_PRIVATE_KEY` | PEM string (use `\n` in env if single-line) |
| `SF_PRIVATE_KEY_PATH` | Path to PEM file (preferred over `SF_PRIVATE_KEY`) |

### Username–password flow (dev only; often disabled by org policy)

| Env | Meaning |
|-----|---------|
| `SF_CLIENT_ID` | Connected App consumer key |
| `SF_CLIENT_SECRET` | Consumer secret |
| `SF_USERNAME` | Username |
| `SF_PASSWORD` | Password + security token concatenated |

Set `SFDC_AUTH_MODE=password` to use this flow; default is **`jwt`**.

## Elasticsearch

Same as MCP: **`ELASTICSEARCH_URL`**, **`STRATTRACK_INDEX`** (default `strattrack_drawers`), **`ELASTICSEARCH_API_KEY`** or **`ELASTICSEARCH_BASIC_AUTH`**.

Create the index first (`elastic_ensure_index` in MCP or `./scripts/init-strattrack-index.sh`).

## Run

**Recommended:** keep secrets out of `~/.zshrc`. Copy the example env file, edit it, then use the wrapper (changes cwd to the repo root so watermarks and paths behave):

```bash
mkdir -p ~/.config/strattrack
cp scripts/strattrack-env.example.sh ~/.config/strattrack/env.sh
chmod 600 ~/.config/strattrack/env.sh
# edit ~/.config/strattrack/env.sh — real URL, API key, Salesforce JWT settings

./scripts/with-strattrack-env.sh node scripts/sfdc-poll-to-elasticsearch.mjs
```

The wrapper loads the first file found: **`STRATTRACK_ENV_FILE`**, else **`<repo>/.env.strattrack.local`**, else **`~/.config/strattrack/env.sh`**.

Manual exports (same variables) if you prefer:

```bash
cd /path/to/strattrack
export ELASTICSEARCH_URL="https://…serverless…:443"
export ELASTICSEARCH_API_KEY="…"
export SF_CLIENT_ID="…"
export SF_USERNAME="integration@example.com"
export SF_AUDIENCE="https://login.salesforce.com"
export SF_PRIVATE_KEY_PATH="$HOME/.secrets/sfdc-integration.pem"

node scripts/sfdc-poll-to-elasticsearch.mjs
```

Options:

| Flag | Effect |
|------|--------|
| `--dry-run` | SOQL + counts only; no Elasticsearch writes |
| `--verbose` | Log each object’s row counts |

Schedule with **cron** or **launchd** (e.g. every 5–15 minutes).

## Customizing polled objects

Default objects: **Task**, **Event**, **Opportunity**. Override with:

`STRATTRACK_SFDC_OBJECTS=Task,Opportunity`

(Extend the script’s `OBJECT_CONFIG` map if you add types that need different SOQL.)

## macOS Keychain

You can wrap the command in a small shell script that exports `ELASTICSEARCH_API_KEY` and/or `SF_PRIVATE_KEY` from Keychain (see **[MACOS_KEYCHAIN.md](MACOS_KEYCHAIN.md)**).

## Weekly ONE–TWO–THREE (Thursday)

After notes exist in Elasticsearch (poll + MCP), generate per–opportunity ONE–TWO–THREE Markdown from Salesforce + search: **[THURSDAY_123_CRON.md](./THURSDAY_123_CRON.md)** (`scripts/thursday-123-opportunities.mjs`).

---

*Operational doc — align with your Salesforce admin on object/field access and API limits.*
