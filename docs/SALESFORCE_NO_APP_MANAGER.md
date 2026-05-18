# Salesforce API access **without** App Manager

If you **cannot** create or view **Connected Apps** (no **App Manager** access), you cannot set up **JWT** (`SF_CLIENT_ID` + certificate) yourself. StratTrack scripts can still call the REST API using **either** of these patterns.

StratTrack reads credentials in **`scripts/lib/sfdc-auth.mjs`**: it uses **`STRATTRACK_SF_ACCESS_TOKEN`** + **`STRATTRACK_SF_INSTANCE_URL`** first, then JWT / password if those are unset.

---

## Option A — Salesforce CLI (best if you can install `sf`)

You do **not** need App Manager to use the CLI as **your own user**:

1. Install [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli).
2. Run: `sf org login web --alias myorg` and complete the browser login.
3. From the StratTrack repo:

   ```bash
   eval "$(node scripts/print-sf-cli-session.mjs --org myorg)"
   ```

4. Paste the printed lines into **`~/.config/strattrack/env.sh`**:

   ```bash
   export STRATTRACK_SF_ACCESS_TOKEN="…"
   export STRATTRACK_SF_INSTANCE_URL="https://YOUR-INSTANCE.my.salesforce.com"
   ```

5. **Comment out** the whole **JWT** block (`SF_CLIENT_ID`, `SF_AUDIENCE`, `SF_PRIVATE_KEY_PATH`, …) so you are not chasing a Consumer Key.

**Caveat:** access tokens **expire**; re-run `eval "$(node scripts/print-sf-cli-session.mjs …)"` when API calls return **401**. Fine for laptop use; for **cron**, an admin-backed integration (JWT or refresh token) is more stable.

---

## Option B — Session ID from the browser (DevTools)

When you are **already logged in** to Salesforce in Chrome (or Edge), Salesforce sets a **`sid`** cookie that acts like a **session ID**. The REST API accepts it in the same **`Authorization: Bearer …`** header StratTrack already sends.

### 1. Copy the session ID (`sid`)

1. Open Salesforce in the browser (Lightning is fine).
2. **DevTools** → **Application** (Chrome) or **Storage** (Firefox) → **Cookies** → select your Salesforce host (e.g. `https://something.lightning.force.com` or `https://login.salesforce.com`).
3. Find the cookie named **`sid`** and copy its **value** (long string).  
   That value is **`STRATTRACK_SF_ACCESS_TOKEN`**.

If you do not see `sid` on the Lightning host, check cookies under **`*.my.salesforce.com`** or the domain shown in the address bar after login.

### 2. Get **`STRATTRACK_SF_INSTANCE_URL`** (must be the API host, not Lightning)

The REST base URL is **not** always the same as the Lightning tab URL. It usually looks like:

```text
https://YOURDOMAIN.my.salesforce.com
```

Ways to find it:

- **DevTools → Network** while using Salesforce: open any request whose URL contains **`/services/data/`**. The origin (scheme + host) is your **instance URL** — copy it **without** a trailing slash.
- Or **Setup** (if you can open it) → **Company Information** → **Instance** / org details (wording varies by release).

Set:

```bash
export STRATTRACK_SF_INSTANCE_URL="https://YOURDOMAIN.my.salesforce.com"
export STRATTRACK_SF_ACCESS_TOKEN="PASTE_SID_VALUE_HERE"
```

**Comment out** all **`SF_*`** JWT lines so StratTrack does not try JWT.

### 3. Security and limitations

- **`sid` is a password-equivalent** — treat `env.sh` like a secret (`chmod 600`), do not paste into tickets or screenshots.
- When you **log out** or the org **invalidates** the session, the value stops working; refresh from DevTools again.
- **Org policy** may block API use from certain sessions; if you get **403**, you need an admin to grant API permission or use an approved integration path.

---

## What still needs an admin

- **Connected App + JWT** — requires someone with **App Manager** / **Manage Connected Apps**.
- **Long-running automation** (nightly jobs) — an admin should provide **integration user + OAuth** or **JWT** so tokens renew without you copying `sid` from a browser.

---

## Related docs

- [docs/SFDC_POLL_ELASTICSEARCH.md](./SFDC_POLL_ELASTICSEARCH.md) — env overview and poll worker  
- [docs/SALESFORCE_JWT_ENV.md](./SALESFORCE_JWT_ENV.md) — when you *do* get App Manager access later
