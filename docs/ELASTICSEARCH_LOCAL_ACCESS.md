# Accessing local Elasticsearch (Docker / Podman)

StratTrack’s compose file runs Elasticsearch with **`xpack.security.enabled=false`** for frictionless local development. That means **there is no username or password** — you do not “log in” with credentials; you **open the HTTP API** on port **9200**.

---

## Persistence (always-on data plane)

The compose service sets **`restart: unless-stopped`**: after a machine reboot, Docker (or Podman) will start **Elasticsearch** again until you run **`docker compose … down`**. That is what you want for a stable **`localhost:9200`** endpoint for Cursor/MCP.

The **MCP Node process** is **not** configured as a daemon here — see **[MCP_CLAUDE_DESKTOP.md](./MCP_CLAUDE_DESKTOP.md#always-on--what-should-run-247)**.

---

## 1. Confirm the container is running

From the repo root (use `docker` or `podman` to match how you started the stack):

```bash
docker ps --filter name=strattrack-elasticsearch
# or
podman ps --filter name=strattrack-elasticsearch
```

You should see container **`strattrack-elasticsearch`** and port **9200 → 9200**.

---

## 2. “Log in” = open the API (no auth in default setup)

### Browser

Open:

**http://localhost:9200**

You should see JSON with `cluster_name`, `tagline`, etc. If the page loads, the node is up.

### Terminal (`curl`)

```bash
curl -s http://localhost:9200 | head
curl -s http://localhost:9200/_cluster/health?pretty
```

### Create the StratTrack index (first time only)

The cluster starts **without** the `strattrack_drawers` index. Create it once:

```bash
./scripts/init-strattrack-index.sh
```

Or use the MCP tool **`elastic_ensure_index`**. Until one of these runs, `/_count` returns **`index_not_found_exception`**.

### Check your StratTrack index

```bash
curl -s "http://localhost:9200/strattrack_drawers/_count?pretty"
```

---

## 3. Shell into the container (optional)

Useful for **bin/elasticsearch-reset-password**, **elasticsearch-certutil**, or inspecting files inside the image.

**Docker:**

```bash
docker exec -it strattrack-elasticsearch /bin/bash
```

**Podman:**

```bash
podman exec -it strattrack-elasticsearch /bin/bash
```

Inside the container, Elasticsearch runs as user **`elasticsearch`**; config and data live under **`/usr/share/elasticsearch/`**. Type `exit` to leave the shell.

---

## 4. Optional: Dev UIs (not in the default compose)

The default stack does **not** include Kibana. To get a **Login** screen and Dev Tools UI you would add a **Kibana** service (or run Elastic’s demo compose) and turn **security** back on — that is a larger change than this doc.

Lightweight alternatives that talk to `http://localhost:9200` without extra containers:

- **Elasticvue** (browser extension or desktop) — point it at `http://localhost:9200`.
- **curl** / **Postman** / **Bruno** — same URL, no auth for the default StratTrack image.

---

## 5. If you later enable security (login + password)

Typical pattern for a secured local node:

1. Set `xpack.security.enabled=true` and define **`ELASTIC_PASSWORD`** (or use auto-generated bootstrap password) in compose — follow [Elastic’s Docker docs](https://www.elastic.co/guide/en/elasticsearch/reference/current/docker.html).
2. Restart the container; Elasticsearch will require **Basic** auth or an **API key**.
3. Use **`elastic`** as the built-in superuser (unless you create others) with that password.
4. Point **StratTrack MCP** at the same URL and set **`ELASTICSEARCH_API_KEY`** or **`ELASTICSEARCH_BASIC_AUTH`** (see **[MACOS_KEYCHAIN.md](./MACOS_KEYCHAIN.md)**).

Until you change compose, **skip login** and use plain **`http://localhost:9200`**.

---

## Quick reference

| Goal | Action |
|------|--------|
| See cluster info | Browser or `curl http://localhost:9200` |
| Health | `curl -s http://localhost:9200/_cluster/health?pretty` |
| Open a shell in ES container | `docker exec -it strattrack-elasticsearch /bin/bash` |
| Default auth | **None** (security disabled) |
