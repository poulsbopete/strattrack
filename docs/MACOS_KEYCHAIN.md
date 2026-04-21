# macOS Keychain (“Apple” credential store) for StratTrack

On a Mac, **Apple’s built-in secret store is the Keychain** (Keychain Access app + **Keychain Services** APIs). It is the right default for API keys, Elasticsearch credentials, and tokens that must not live in git or plain `.env` files.

This is **not** the same as the **Passwords** app (iCloud Keychain for websites), though both are Apple-managed. For developer/API secrets, use **login keychain** + **generic passwords** (or certificates) as below.

## What to store

Examples (pick names you like; keep them consistent):

| Item | Suggested Keychain *service* (`-s`) | Maps to env var |
|------|-------------------------------------|-------------------|
| Elasticsearch API key | `strattrack.elasticsearch.api_key` | `ELASTICSEARCH_API_KEY` |
| Salesforce token (later) | `strattrack.salesforce.token` | `SFDC_TOKEN` |

Use a fixed **account** string for all StratTrack items, e.g. `strattrack` (see `-a` below). You can override it with `STRATTRACK_KEYCHAIN_ACCOUNT`.

## Add a secret (Terminal once)

Generic password (good for API keys and long tokens):

```bash
security add-generic-password \
  -a "strattrack" \
  -s "strattrack.elasticsearch.api_key" \
  -w "PASTE_YOUR_ELASTIC_API_KEY_HERE" \
  -U
```

- **`-a`** = account (logical “owner”; use `strattrack` for grouping).  
- **`-s`** = service (unique name for this secret).  
- **`-w`** = secret value.  
- **`-U`** = update if the item already exists.

The first time a program reads the item, macOS may prompt you to allow **Terminal** or **Claude** access — choose **Always Allow** for your wrapper script if you trust it.

## Read in Terminal (sanity check)

```bash
security find-generic-password -a "strattrack" -s "strattrack.elasticsearch.api_key" -w
```

## Claude Desktop + MCP (recommended pattern)

Claude Desktop’s MCP config **cannot** run arbitrary shell pipelines in `env` values. Use a **small wrapper script** that:

1. Reads secrets from Keychain with `security find-generic-password … -w`
2. `export`s them into the environment
3. `exec`s `node …/strattrack-mcp.mjs`

This repo provides **`scripts/run-strattrack-mcp-from-keychain.sh`**. Point Claude at that script instead of `node` directly:

```json
{
  "mcpServers": {
    "strattrack-elasticsearch": {
      "command": "/Users/YOU/opt/strattrack/scripts/run-strattrack-mcp-from-keychain.sh",
      "args": [],
      "env": {
        "ELASTICSEARCH_URL": "http://localhost:9200",
        "STRATTRACK_INDEX": "strattrack_drawers"
      }
    }
  }
}
```

Non-secret settings stay in `env`; **secrets** come from Keychain inside the script.

## Elasticsearch API key format

For Elastic Cloud / secured clusters, use an **API key** and set **`ELASTICSEARCH_API_KEY`** to the **Encoded** value from Kibana (the MCP sends `Authorization: ApiKey <value>`).

For **Basic** auth instead, set **`ELASTICSEARCH_BASIC_AUTH`** to the **base64** encoding of `username:password` (no `Basic ` prefix in the env value).

## Alternatives

- **1Password CLI** (`op read …`) — team standard at many companies.  
- **Short-lived tokens** from your identity provider — best for production automation.

## References

- `man security` — macOS Keychain CLI  
- Apple: [Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
