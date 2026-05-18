/**
 * Minimal Elasticsearch client for StratTrack scripts (same env vars as MCP).
 */
import { requireElasticsearchUrl } from "./elasticsearch-url.mjs";

export function esAuthHeaders() {
  const headers = {};
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  const basic = process.env.ELASTICSEARCH_BASIC_AUTH;
  if (apiKey) headers.Authorization = `ApiKey ${apiKey}`;
  else if (basic) headers.Authorization = `Basic ${basic}`;
  return headers;
}

export function getEsUrl() {
  return requireElasticsearchUrl();
}

export function getIndex() {
  return process.env.STRATTRACK_INDEX || "strattrack_drawers";
}

export async function esFetch(path, { method = "GET", body } = {}) {
  const url = `${getEsUrl()}${path.startsWith("/") ? path : `/${path}`}`;
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

/** Blocker lexicon boost — aligned with elastic_search_opp in mcp/strattrack-mcp.mjs */
function blockerShouldClauses(query) {
  const q = (query || "").toLowerCase();
  const blockerTerms = ["RUM", "OTel", "billing", "GovCloud", "anomaly", "blocker", "parity"];
  const shouldBoost = [];
  for (const term of blockerTerms) {
    if (q.includes(term.toLowerCase())) {
      shouldBoost.push({
        constant_score: {
          filter: { term: { blocker_tags: term.toLowerCase() } },
          boost: 2.0,
        },
      });
    }
  }
  return shouldBoost;
}

/**
 * Retrieve hits for one Opportunity context (account keyword + opportunity name).
 * @param {{ account?: string, opportunity: string, days?: number, size?: number, index?: string }} p
 */
export async function searchHitsForOpportunity(p) {
  const index = p.index || getIndex();
  const size = Math.min(50, Math.max(4, p.size ?? 24));
  const days =
    p.days != null ? p.days : Number.parseInt(process.env.STRATTRACK_THURSDAY_ES_DAYS || "0", 10) || 0;
  const account = p.account?.trim();
  const opportunity = p.opportunity?.trim() || "";

  const filter = [];
  if (account) filter.push({ term: { account } });
  if (days > 0) filter.push({ range: { created_at: { gte: `now-${days}d/d` } } });

  const queryText = [opportunity, account].filter(Boolean).join(" ").trim();
  if (!queryText) {
    throw new Error("searchHitsForOpportunity: need opportunity and/or account");
  }
  const shouldBoost = blockerShouldClauses(queryText);

  const mm = {
    multi_match: {
      query: queryText,
      type: "best_fields",
      fields: ["content^2", "opportunity^1.5", "title", "wing^1.2", "room^1.2"],
      fuzziness: "AUTO",
    },
  };

  const body = {
    size,
    sort: [{ note_date: { order: "desc", missing: "_last" } }, { created_at: { order: "desc", missing: "_last" } }],
    query: {
      bool: {
        must: [mm],
        filter,
        ...(shouldBoost.length ? { should: shouldBoost, minimum_should_match: 0 } : {}),
      },
    },
    _source: true,
  };

  return esFetch(`/${index}/_search`, { method: "POST", body });
}

export async function esBulk(ndjsonLines) {
  const body = ndjsonLines.join("\n") + "\n";
  const url = `${getEsUrl()}/_bulk?refresh=wait_for`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson", ...esAuthHeaders() },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Bulk: non-JSON response HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(`Bulk HTTP ${res.status}: ${text.slice(0, 800)}`);
  }
  let failed = 0;
  for (const it of json.items || []) {
    const st = it.index?.status;
    if (st >= 400) failed += 1;
  }
  if (json.errors || failed > 0) {
    const firstErr = (json.items || []).find((it) => it.index?.error);
    throw new Error(
      `Bulk reported errors (failed=${failed}): ${JSON.stringify(firstErr?.index?.error || json).slice(0, 1200)}`
    );
  }
}
