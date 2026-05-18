# Salesforce env vars for StratTrack scripts (`SF_*`)

**No App Manager access?** Use the Salesforce CLI or a browser session ID — see **[docs/SALESFORCE_NO_APP_MANAGER.md](./SALESFORCE_NO_APP_MANAGER.md)** first. You can skip everything below until you have Connected App admin.

The **MCP** (Cursor / Claude) only needs **`ELASTICSEARCH_URL`** and **`ELASTICSEARCH_API_KEY`**.  
The **`SF_*`** variables are **only** for:

- `scripts/sfdc-poll-to-elasticsearch.mjs`
- `scripts/thursday-123-opportunities.mjs`

If you are **not** running those yet, you can **comment out or delete** the whole Salesforce block in `~/.config/strattrack/env.sh`.

---

## `SF_CLIENT_ID` — where is the “Consumer Key”?

Salesforce calls this the **Consumer Key**; StratTrack’s env var is `SF_CLIENT_ID` (same value).

1. Log into Salesforce as an admin (or a user who can view the Connected App).
2. Open the **setup** (gear) → Quick Find → **App Manager**.
3. Find your **Connected App** (create one first if needed — see below).
4. Open the row menu → **View** (or click the app name).
5. Click **Manage Consumer Details** (or **View Consumer Key** on older UIs) and copy the **Consumer Key** — a long alphanumeric string.  
   That string is what you put in **`export SF_CLIENT_ID="…"`**.

**Creating a Connected App (short version):**

- Setup → **App Manager** → **New Connected App**.
- Enable **OAuth Settings** as required by your org’s wizard.
- For **JWT**, enable **Use digital signatures**, upload a **certificate** (`.crt`), and save.
- After save, use **Manage Consumer Details** to reveal **Consumer Key** and (if using password flow) **Consumer Secret**.

Your Salesforce admin may need to **approve** the app or assign **policies** (IP relax, etc.) before tokens work.

---

## `SF_AUDIENCE` — what is it? (not your org URL)

For the **JWT bearer** flow, `SF_AUDIENCE` is **not** your Lightning URL, **not** `https://yourcompany.lightning.force.com`, and **not** your My Domain host.

It must be **exactly one of these two login hosts** (Salesforce’s OAuth issuer for JWT):

| Org type | `SF_AUDIENCE` value |
|----------|---------------------|
| **Production** (most “real” orgs) | `https://login.salesforce.com` |
| **Sandbox** (test orgs, `*.sandbox.my.salesforce.com`, etc.) | `https://test.salesforce.com` |

**Your org’s custom domain** (e.g. `elastic.lightning.force.com`) is used **after** you get a token; it is **not** the JWT `aud` claim. Using the wrong audience is a common reason JWT token requests return **400** or **invalid_grant**.

Examples:

```bash
# Production (typical Elastic employee production login)
export SF_AUDIENCE="https://login.salesforce.com"

# Sandbox only
# export SF_AUDIENCE="https://test.salesforce.com"
```

---

## Other JWT vars (quick reference)

| Variable | Meaning |
|----------|---------|
| `SF_USERNAME` | Username of the user authorized to use this Connected App with the uploaded cert (often an **integration user**; can be your own if an admin assigned you). |
| `SF_PRIVATE_KEY_PATH` | Path to the **private key** `.pem` whose **public** half was used to create the **certificate** uploaded to the Connected App. Must match the cert Salesforce has on file. |

---

## If JWT is too heavy

You do **not** need a Connected App consumer key for every workflow:

1. **Salesforce CLI** — [docs/SFDC_POLL_ELASTICSEARCH.md](./SFDC_POLL_ELASTICSEARCH.md#if-you-cannot-use-jwt-no-integration-user--no-cert) and **`scripts/print-sf-cli-session.mjs`**: paste **`STRATTRACK_SF_ACCESS_TOKEN`** + **`STRATTRACK_SF_INSTANCE_URL`** into `env.sh` and **comment out** the JWT block (`STRATTRACK_SF_*` is checked first by the scripts).

2. **Password grant** — `SFDC_AUTH_MODE=password` (often **disabled** by org policy). See the same poll doc.

---

## Further reading

- [docs/SFDC_POLL_ELASTICSEARCH.md](./SFDC_POLL_ELASTICSEARCH.md) — full poll + env + cron  
- [Salesforce Help](https://help.salesforce.com/) — search **Connected App JWT** or **OAuth 2.0 JWT bearer** for your release.
