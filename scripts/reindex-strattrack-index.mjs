#!/usr/bin/env node
/**
 * Scroll + bulk reindex strattrack_drawers (or STRATTRACK_SOURCE_INDEX) from
 * ELASTICSEARCH_SOURCE_URL into ELASTICSEARCH_URL / STRATTRACK_INDEX (destination env).
 *
 * @see docs/MIGRATE_AI_ASSISTANTS_ELASTIC.md
 */
import { requireElasticsearchUrl } from "./lib/elasticsearch-url.mjs";

function stripSlash(u) {
  return String(u || "")
    .trim()
    .replace(/\/$/, "");
}

function authHeaders(apiKey, basic) {
  const headers = {};
  if (apiKey) headers.Authorization = `ApiKey ${apiKey}`;
  else if (basic) headers.Authorization = `Basic ${basic}`;
  return headers;
}

async function esFetch(base, path, headers, { method = "GET", body } = {}) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const init = {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
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
    const err = new Error(`ES HTTP ${res.status} ${method} ${path}: ${text.slice(0, 600)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function main() {
  const srcBase = stripSlash(process.env.ELASTICSEARCH_SOURCE_URL);
  if (!srcBase) {
    console.error(
      "Set ELASTICSEARCH_SOURCE_URL to the cluster you are copying from (e.g. http://localhost:9200). Destination uses ELASTICSEARCH_URL from ~/.config/strattrack/env.sh or your shell."
    );
    process.exit(1);
  }

  const destBase = requireElasticsearchUrl();
  const srcKey = process.env.ELASTICSEARCH_SOURCE_API_KEY?.trim();
  const srcBasic = process.env.ELASTICSEARCH_SOURCE_BASIC_AUTH?.trim();
  const destKey = process.env.ELASTICSEARCH_API_KEY?.trim();
  const destBasic = process.env.ELASTICSEARCH_BASIC_AUTH?.trim();

  const srcIndex = process.env.STRATTRACK_SOURCE_INDEX || "strattrack_drawers";
  const destIndex = process.env.STRATTRACK_INDEX || "strattrack_drawers";

  if (srcBase === destBase && srcIndex === destIndex) {
    console.error("Source and destination cluster/index are identical; nothing to do.");
    process.exit(1);
  }

  const srcH = authHeaders(srcKey, srcBasic);
  const destH = authHeaders(destKey, destBasic);

  const countRes = await esFetch(srcBase, `/${srcIndex}/_count`, srcH, { method: "GET" });
  const total = typeof countRes.count === "number" ? countRes.count : 0;
  console.error(`[reindex] Source ${srcBase}/${srcIndex} document count: ${total}`);
  if (total === 0) {
    console.error("[reindex] Nothing to copy.");
    process.exit(0);
  }

  const scrollTtl = "2m";
  const pageSize = 200;

  const first = await esFetch(
    srcBase,
    `/${srcIndex}/_search?scroll=${encodeURIComponent(scrollTtl)}`,
    srcH,
    {
      method: "POST",
      body: {
        size: pageSize,
        query: { match_all: {} },
        sort: [{ _doc: "asc" }],
      },
    }
  );

  let processed = 0;

  async function flushBatch(batch) {
    if (!batch.length) return;
    const lines = [];
    for (const h of batch) {
      lines.push(JSON.stringify({ index: { _index: destIndex, _id: h._id } }));
      lines.push(JSON.stringify(h._source));
    }
    const ndjson = lines.join("\n") + "\n";
    const url = `${destBase}/_bulk?refresh=false`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-ndjson", ...destH },
      body: ndjson,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new Error(`Bulk failed HTTP ${res.status}: ${text.slice(0, 800)}`);
    }
    if (json.errors) {
      const bad = (json.items || []).find((it) => it.index?.error);
      throw new Error(`Bulk item errors: ${JSON.stringify(bad?.index?.error || json).slice(0, 800)}`);
    }
    processed += batch.length;
    console.error(`[reindex] Indexed ${processed} / ${total} …`);
  }

  let batch = [];
  let response = first;
  for (;;) {
    const page = response.hits?.hits || [];
    if (page.length === 0) break;
    for (const h of page) {
      batch.push(h);
      if (batch.length >= 100) {
        await flushBatch(batch);
        batch = [];
      }
    }
    response = await esFetch(srcBase, "/_search/scroll", srcH, {
      method: "POST",
      body: { scroll: scrollTtl, scroll_id: response._scroll_id },
    });
  }

  await flushBatch(batch);

  if (response._scroll_id) {
    try {
      await fetch(`${srcBase}/_search/scroll`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...srcH },
        body: JSON.stringify({ scroll_id: [response._scroll_id] }),
      });
    } catch {
      /* ignore */
    }
  }

  await esFetch(destBase, `/${destIndex}/_refresh`, destH, { method: "POST" });
  console.error(`[reindex] Done. Copied ${processed} documents → ${destBase}/${destIndex}`);
}

main().catch((e) => {
  console.error("[reindex] fatal:", e.message || e);
  process.exit(1);
});
