#!/usr/bin/env node
/**
 * StratTrack MCP — stdio server talking to local Elasticsearch (Docker/Podman).
 * Log only to stderr; stdout is reserved for MCP JSON-RPC.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_SETTINGS = JSON.parse(
  readFileSync(join(__dirname, "..", "docker", "strattrack-drawers-index.json"), "utf8")
);

const ES_URL = (process.env.ELASTICSEARCH_URL || "http://localhost:9200").replace(/\/$/, "");
const INDEX = process.env.STRATTRACK_INDEX || "strattrack_drawers";

function log(...args) {
  console.error("[strattrack-mcp]", ...args);
}

/** Optional: Elasticsearch API key (Kibana “Encoded” value) or Basic auth (already base64 user:pass). From env or macOS Keychain via wrapper script. */
function esAuthHeaders() {
  const headers = {};
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  const basic = process.env.ELASTICSEARCH_BASIC_AUTH;
  if (apiKey) headers.Authorization = `ApiKey ${apiKey}`;
  else if (basic) headers.Authorization = `Basic ${basic}`;
  return headers;
}

async function esFetch(path, { method = "GET", body } = {}) {
  const url = `${ES_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const init = {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...esAuthHeaders(),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Elasticsearch HTTP ${res.status} ${method} ${path}: ${text.slice(0, 800)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function indexExists() {
  const res = await fetch(`${ES_URL}/${INDEX}`, { method: "HEAD", headers: { ...esAuthHeaders() } });
  return res.ok;
}

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

function errResult(message, detail) {
  log(message, detail || "");
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message, detail }, null, 2) }],
    isError: true,
  };
}

const server = new McpServer(
  { name: "strattrack-elasticsearch", version: "0.1.0" },
  {
    instructions: [
      "StratTrack MCP backs onto a local Elasticsearch (default http://localhost:9200, index strattrack_drawers).",
      "After starting Docker/Podman ES, call elastic_ensure_index once before bulk import or heavy use.",
      "MemPalace uses wings/rooms/drawers; this index stores wing, room, content, and optional mempalace_drawer_id for idempotent migration.",
      "Prefer elastic_bulk_import_mempalace for batches (max 100 lines per call); repeat until the export is fully ingested.",
    ].join(" "),
  }
);

server.registerTool(
  "elastic_cluster_health",
  {
    description: "Check Elasticsearch cluster health (yellow/green) and basic connectivity.",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const health = await esFetch("/_cluster/health");
      return textResult({ ok: true, elasticsearch_url: ES_URL, index: INDEX, health });
    } catch (e) {
      return errResult(e.message, { elasticsearch_url: ES_URL });
    }
  }
);

server.registerTool(
  "elastic_ensure_index",
  {
    description:
      "Create the StratTrack index with mappings if it does not exist. Safe to call repeatedly.",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      if (await indexExists()) {
        return textResult({ ok: true, created: false, index: INDEX, message: "Index already exists" });
      }
      await esFetch(`/${INDEX}`, { method: "PUT", body: INDEX_SETTINGS });
      return textResult({ ok: true, created: true, index: INDEX });
    } catch (e) {
      return errResult(e.message, { index: INDEX });
    }
  }
);

server.registerTool(
  "elastic_search_opp",
  {
    description:
      "Semantic-ish search: multi_match on content, opportunity, and title. Optional filters: account, stage, wing, room. Replaces MemPalace scoped search for StratTrack.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Search text"),
      account_filter: z.string().optional().describe("Exact account keyword filter"),
      stage_filter: z.string().optional().describe("Exact stage keyword filter"),
      wing: z.string().optional().describe("MemPalace wing filter"),
      room: z.string().optional().describe("MemPalace room filter"),
      limit: z.number().int().min(1).max(50).optional().default(10),
    }),
  },
  async ({ query, account_filter, stage_filter, wing, room, limit }) => {
    try {
      const filter = [];
      if (account_filter) filter.push({ term: { account: account_filter } });
      if (stage_filter) filter.push({ term: { stage: stage_filter } });
      if (wing) filter.push({ term: { wing } });
      if (room) filter.push({ term: { room } });

      const shouldBoost = [];
      const blockerTerms = ["RUM", "OTel", "billing", "GovCloud", "anomaly", "blocker", "parity"];
      for (const term of blockerTerms) {
        if (query.toLowerCase().includes(term.toLowerCase())) {
          shouldBoost.push({
            constant_score: {
              filter: { term: { blocker_tags: term.toLowerCase() } },
              boost: 2.0,
            },
          });
        }
      }

      const body = {
        size: limit,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  type: "best_fields",
                  fields: ["content^2", "opportunity^1.5", "title"],
                  fuzziness: "AUTO",
                },
              },
            ],
            filter,
            ...(shouldBoost.length ? { should: shouldBoost, minimum_should_match: 0 } : {}),
          },
        },
        _source: true,
      };

      const res = await esFetch(`/${INDEX}/_search`, { method: "POST", body });
      const hits = res.hits?.hits || [];
      const total =
        typeof res.hits?.total === "object" ? res.hits.total.value : res.hits?.total ?? hits.length;
      return textResult({
        total,
        results: hits.map((h) => ({
          id: h._id,
          score: h._score,
          ...h._source,
        })),
      });
    } catch (e) {
      if (e.status === 404) {
        return errResult(`Index "${INDEX}" not found. Run elastic_ensure_index first.`, e.body);
      }
      return errResult(e.message, e.body);
    }
  }
);

server.registerTool(
  "elastic_add_note",
  {
    description:
      "Index a note or drawer document (Solution Architect note, MemPalace drawer, etc.). Optional mempalace_drawer_id sets _id for idempotent upserts.",
    inputSchema: z.object({
      content: z.string().min(1),
      title: z.string().optional(),
      opportunity: z.string().optional(),
      account: z.string().optional(),
      stage: z.string().optional(),
      wing: z.string().optional(),
      room: z.string().optional(),
      mempalace_drawer_id: z.string().optional(),
      blocker_tags: z.array(z.string()).optional(),
      source: z.string().optional().default("mcp"),
    }),
  },
  async (doc) => {
    try {
      const { mempalace_drawer_id, ...rest } = doc;
      const body = {
        ...rest,
        created_at: new Date().toISOString(),
        note_date: new Date().toISOString(),
      };
      const path = mempalace_drawer_id
        ? `/${INDEX}/_doc/${encodeURIComponent(mempalace_drawer_id)}?refresh=wait_for`
        : `/${INDEX}/_doc?refresh=wait_for`;
      const method = mempalace_drawer_id ? "PUT" : "POST";
      const res = await esFetch(path, { method, body });
      return textResult({ ok: true, _id: res._id, result: res.result });
    } catch (e) {
      if (e.status === 404) {
        return errResult(`Index "${INDEX}" not found. Run elastic_ensure_index first.`, e.body);
      }
      return errResult(e.message, e.body);
    }
  }
);

server.registerTool(
  "elastic_get_1_2_3",
  {
    description:
      "Pull recent indexed notes (last N days) and return a draft ONE–TWO–THREE update plus blocker highlights from blocker_tags and title.",
    inputSchema: z.object({
      days: z.number().min(1).max(30).optional().default(7),
      size: z.number().int().min(1).max(50).optional().default(20),
    }),
  },
  async ({ days, size }) => {
    try {
      const gte = `now-${days}d/d`;
      const body = {
        size,
        sort: [{ note_date: "desc" }, { created_at: "desc" }],
        query: {
          bool: {
            filter: [{ range: { created_at: { gte } } }],
          },
        },
        _source: true,
      };
      const res = await esFetch(`/${INDEX}/_search`, { method: "POST", body });
      const hits = res.hits?.hits || [];
      const blockers = [];
      const lines = [];
      for (const h of hits) {
        const s = h._source || {};
        if (Array.isArray(s.blocker_tags) && s.blocker_tags.length) {
          blockers.push({
            id: h._id,
            account: s.account,
            opportunity: s.opportunity,
            tags: s.blocker_tags,
            title: s.title,
          });
        }
        const oneLine = [s.account, s.opportunity, s.title].filter(Boolean).join(" — ");
        if (oneLine) lines.push(oneLine);
      }
      const draft = {
        one: lines[0] || "(no recent items — add notes with elastic_add_note)",
        two: lines.slice(1, 4).join("; ") || "(fill from search)",
        three: lines.slice(4, 8).join("; ") || "(fill from search)",
        blockers_highlight: blockers.slice(0, 8),
        sources_considered: hits.length,
      };
      return textResult(draft);
    } catch (e) {
      if (e.status === 404) {
        return errResult(`Index "${INDEX}" not found. Run elastic_ensure_index first.`, e.body);
      }
      return errResult(e.message, e.body);
    }
  }
);

server.registerTool(
  "elastic_sync_to_sf",
  {
    description:
      "Placeholder for Phase 3+: prepare or describe Salesforce sync (no writes yet).",
    inputSchema: z.object({
      opportunity_id: z.string().optional().describe("Salesforce Opportunity Id if known"),
    }),
  },
  async ({ opportunity_id }) => {
    return textResult({
      ok: false,
      phase: "stub",
      message:
        "Salesforce sync is not implemented in this MCP build. Use CRM UI or a future strattrack worker; pass opportunity_id when available.",
      opportunity_id: opportunity_id ?? null,
    });
  }
);

const mempalaceItem = z.object({
  wing: z.string().optional(),
  room: z.string().optional(),
  content: z.string().min(1),
  title: z.string().optional(),
  mempalace_drawer_id: z.string().optional(),
  account: z.string().optional(),
  opportunity: z.string().optional(),
  stage: z.string().optional(),
  blocker_tags: z.array(z.string()).optional(),
});

server.registerTool(
  "elastic_bulk_import_mempalace",
  {
    description:
      "Bulk index up to 100 MemPalace-style rows (wing/room/content/…) into Elasticsearch. Use the same mempalace_drawer_id across runs for upserts. Split large exports into multiple calls.",
    inputSchema: z.object({
      items: z.array(mempalaceItem).min(1).max(100),
      source: z.string().optional().default("mempalace_migration"),
    }),
  },
  async ({ items, source }) => {
    try {
      const lines = [];
      const now = new Date().toISOString();
      for (const item of items) {
        const id = item.mempalace_drawer_id;
        const action = id
          ? JSON.stringify({ index: { _index: INDEX, _id: id } })
          : JSON.stringify({ index: { _index: INDEX } });
        const doc = {
          ...item,
          source,
          created_at: now,
          note_date: now,
        };
        lines.push(action, JSON.stringify(doc));
      }
      const ndjson = lines.join("\n") + "\n";
      const res = await fetch(`${ES_URL}/_bulk?refresh=wait_for`, {
        method: "POST",
        headers: { "Content-Type": "application/x-ndjson", ...esAuthHeaders() },
        body: ndjson,
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) {
        return errResult(`Bulk failed HTTP ${res.status}`, json);
      }
      const errors = json.errors === true;
      const itemsOut = json.items || [];
      let failed = 0;
      for (const it of itemsOut) {
        const st = it.index?.status;
        if (st >= 400) failed += 1;
      }
      return textResult({
        ok: !errors && failed === 0,
        took: json.took,
        errors: json.errors,
        item_count: items.length,
        failed_chunks: failed,
        note: errors ? "Inspect each item in Elasticsearch bulk response for error reasons." : undefined,
      });
    } catch (e) {
      if (e.status === 404) {
        return errResult(`Index "${INDEX}" not found. Run elastic_ensure_index first.`, e.body);
      }
      return errResult(e.message, String(e));
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
log("connected", { ES_URL, INDEX });
