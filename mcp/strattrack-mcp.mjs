#!/usr/bin/env node
/**
 * StratTrack MCP — stdio server talking to local Elasticsearch (Docker/Podman).
 * Log only to stderr; stdout is reserved for MCP JSON-RPC.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_JSON_CANDIDATES = [
  join(__dirname, "strattrack-drawers-index.json"),
  join(__dirname, "..", "docker", "strattrack-drawers-index.json"),
];
const indexJsonPath = INDEX_JSON_CANDIDATES.find((p) => existsSync(p));
if (!indexJsonPath) {
  throw new Error(
    "strattrack-drawers-index.json not found beside strattrack-mcp.mjs (Claude .mcpb bundle) or at ../docker/ (git checkout)."
  );
}
const INDEX_SETTINGS = JSON.parse(readFileSync(indexJsonPath, "utf8"));

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

/** One line for 1-2-3 draft: CRM shape (account/opportunity/title), then MemPalace import (wing/room/title), then a content teaser. */
function lineFor123Summary(s) {
  const crm = [s.account, s.opportunity, s.title].filter(Boolean).join(" — ");
  if (crm) return crm;
  const palace = [s.wing, s.room, s.title].filter(Boolean).join(" — ");
  if (palace) return palace;
  const raw = s.content != null ? String(s.content).trim() : "";
  if (raw) {
    const one = raw.replace(/\s+/g, " ");
    return one.length > 140 ? `${one.slice(0, 137)}...` : one;
  }
  return "";
}

/** Rows with wing/room sort before CRM-only rows so a recent MCP test note does not hide migrated history in the same top-N window. */
function isCrmOnlyRow(s) {
  const hasWing = !!(s.wing && String(s.wing).trim());
  const hasRoom = !!(s.room && String(s.room).trim());
  if (hasWing || hasRoom) return false;
  return [s.account, s.opportunity, s.title].filter(Boolean).length >= 1;
}

/** Shrink huge migrated drawers in search responses so the model can read many hits. */
function trimHitSource(src, maxContentChars) {
  if (maxContentChars == null || maxContentChars <= 0 || !src || typeof src !== "object") {
    return src;
  }
  const out = { ...src };
  if (typeof out.content === "string" && out.content.length > maxContentChars) {
    out.content = `${out.content.slice(0, maxContentChars)}…`;
    out.content_truncated = true;
  }
  return out;
}

const server = new McpServer(
  { name: "strattrack-elasticsearch", version: "0.1.0" },
  {
    instructions: [
      "StratTrack MCP uses local Elasticsearch (default http://localhost:9200, index strattrack_drawers).",
      "MemPalace-style recall: use elastic_search_opp with rich natural-language queries (account names, deal topics, acronyms). It scores full-text content, titles, wing, room, and opportunity fields. Run several searches with different phrasings if the first pass is thin.",
      "elastic_get_1_2_3 is NOT full memory: it returns a compact snapshot from the newest N documents (plus index_doc_count). Do not use it alone to answer open-ended history questions.",
      "Structured pipeline fields (account, opportunity, stage, ACV) appear when notes are added with elastic_add_note or imports that include those fields; migrated MemPalace rows are mostly narrative text—summarize ACV from content only when it is written there, or use CRM elsewhere.",
      "After starting Docker/Podman ES, call elastic_ensure_index once (or ./scripts/init-strattrack-index.sh) before heavy indexing.",
      "elastic_bulk_import is optional: batched rows for one-off or legacy data; max 100 items per call. Prefer elastic_add_note for ongoing work.",
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
      "Primary semantic recall over the index (closest to MemPalace search): multi_match on content (boosted), opportunity, title, wing, room. Use for open-ended questions about past work, deals, meetings, and transcripts—not only opportunities. Optional filters: account, stage. Prefer this over elastic_get_1_2_3 for history. Pass max_content_chars to truncate long drawer bodies in the response.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Search text"),
      account_filter: z.string().optional().describe("Exact account keyword filter"),
      stage_filter: z.string().optional().describe("Exact stage keyword filter"),
      limit: z.number().int().min(1).max(50).optional().default(18),
      max_content_chars: z
        .number()
        .int()
        .min(400)
        .max(20000)
        .optional()
        .describe(
          "If set, each hit's content field is truncated to this many characters in the JSON (large migrated drawers). Omit to return full content."
        ),
    }),
  },
  async ({ query, account_filter, stage_filter, limit, max_content_chars }) => {
    try {
      const filter = [];
      if (account_filter) filter.push({ term: { account: account_filter } });
      if (stage_filter) filter.push({ term: { stage: stage_filter } });

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
                  fields: ["content^2", "opportunity^1.5", "title", "wing^1.2", "room^1.2"],
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
          ...trimHitSource(h._source, max_content_chars),
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
      "Primary tool for ongoing history: index a note or decision (Solution Architect context, meeting takeaway, etc.). Same index powers search and 1-2-3. Optional stable document id sets Elasticsearch _id for idempotent upserts when re-indexing the same logical row.",
    inputSchema: z.object({
      content: z.string().min(1),
      title: z.string().optional(),
      opportunity: z.string().optional(),
      account: z.string().optional(),
      stage: z.string().optional(),
      mempalace_drawer_id: z
        .string()
        .optional()
        .describe("Optional stable _id for PUT upserts (same field name as index mapping)"),
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
      "Pull indexed notes for a ONE–TWO–THREE draft plus blocker highlights. Response includes index_doc_count (full index size) so you do not confuse an empty index with a skewed top-N window. Summary lines prefer account/opportunity/title; imported rows use wing/room/title or a short content teaser. Within the fetched hits, wing/room rows are listed before CRM-only rows so a stray test note does not occupy slot one alone. Pass days>0 to restrict to created_at within the last N days.",
    inputSchema: z.object({
      days: z
        .number()
        .int()
        .min(0)
        .max(3650)
        .optional()
        .default(0)
        .describe("0 = all time (default). 1–3650 = only documents with created_at in the last N days."),
      size: z.number().int().min(1).max(50).optional().default(20),
    }),
  },
  async ({ days, size }) => {
    try {
      const gte = days > 0 ? `now-${days}d/d` : null;
      const body = {
        size,
        sort: [{ note_date: "desc" }, { created_at: "desc" }],
        query:
          gte != null
            ? {
                bool: {
                  filter: [{ range: { created_at: { gte } } }],
                },
              }
            : { match_all: {} },
        _source: true,
      };
      const [res, countRes] = await Promise.all([
        esFetch(`/${INDEX}/_search`, { method: "POST", body }),
        esFetch(`/${INDEX}/_count`, { method: "GET" }),
      ]);
      const hits = res.hits?.hits || [];
      const orderedHits = [...hits].sort((a, b) => {
        const sa = a._source || {};
        const sb = b._source || {};
        const ra = isCrmOnlyRow(sa) ? 1 : 0;
        const rb = isCrmOnlyRow(sb) ? 1 : 0;
        return ra - rb;
      });
      const blockers = [];
      const lines = [];
      for (const h of orderedHits) {
        const s = h._source || {};
        if (Array.isArray(s.blocker_tags) && s.blocker_tags.length) {
          blockers.push({
            id: h._id,
            account: s.account ?? s.wing,
            opportunity: s.opportunity ?? s.room,
            tags: s.blocker_tags,
            title: s.title,
          });
        }
        const oneLine = lineFor123Summary(s);
        if (oneLine) lines.push(oneLine);
      }
      const draft = {
        one: lines[0] || "(no recent items — add notes with elastic_add_note)",
        two: lines.slice(1, 4).join("; ") || "(fill from search)",
        three: lines.slice(4, 8).join("; ") || "(fill from search)",
        blockers_highlight: blockers.slice(0, 8),
        sources_considered: hits.length,
        index_doc_count: typeof countRes.count === "number" ? countRes.count : null,
        index: INDEX,
        elasticsearch_url: ES_URL,
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

const bulkImportRow = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
  mempalace_drawer_id: z
    .string()
    .optional()
    .describe("Optional stable _id per row for bulk upserts (same field name as index mapping)"),
  account: z.string().optional(),
  opportunity: z.string().optional(),
  stage: z.string().optional(),
  blocker_tags: z.array(z.string()).optional(),
});

server.registerTool(
  "elastic_bulk_import",
  {
    description:
      "Optional bulk import: up to 100 rows (content plus optional title, account, opportunity, stage, blocker_tags). For day-to-day indexing use elastic_add_note instead. Use each row's optional stable id for upserts; split large batches into multiple calls.",
    inputSchema: z.object({
      items: z.array(bulkImportRow).min(1).max(100),
      source: z.string().optional().default("strattrack_bulk_import"),
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
