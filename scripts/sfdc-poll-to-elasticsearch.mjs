#!/usr/bin/env node
/**
 * Poll Salesforce by LastModifiedDate (strict > watermark), paginate SOQL, bulk upsert into StratTrack ES index.
 * @see docs/SFDC_POLL_ELASTICSEARCH.md
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getSalesforceSession, soqlQuery } from "./lib/sfdc-auth.mjs";
import { requireElasticsearchUrl } from "./lib/elasticsearch-url.mjs";

const DEFAULT_OBJECTS = ["Task", "Event", "Opportunity"];
const BULK_CHUNK = 200; // documents per _bulk request (each doc = 2 ndjson lines)

const OBJECT_CONFIG = {
  Task: {
    fields:
      "Id, Subject, Description, LastModifiedDate, AccountId, Account.Name, WhatId, What.Name, What.Type",
    toDoc(row) {
      const account = row.Account?.Name;
      const whatType = row.What?.Type || "";
      const whatName = row.What?.Name || "";
      const opportunity = whatType === "Opportunity" ? whatName : undefined;
      const title = row.Subject?.trim() || "Task";
      const desc = row.Description?.trim();
      const content = (desc && desc.length ? desc : title).slice(0, 100_000);
      const doc = {
        mempalace_drawer_id: `sfdc:Task:${row.Id}`,
        source: "sfdc_task",
        title,
        content,
        note_date: row.LastModifiedDate,
        created_at: row.LastModifiedDate,
      };
      if (account) doc.account = account;
      if (opportunity) doc.opportunity = opportunity;
      return doc;
    },
  },
  Event: {
    fields:
      "Id, Subject, Description, LastModifiedDate, AccountId, Account.Name, WhatId, What.Name, What.Type",
    toDoc(row) {
      const account = row.Account?.Name;
      const whatType = row.What?.Type || "";
      const whatName = row.What?.Name || "";
      const opportunity = whatType === "Opportunity" ? whatName : undefined;
      const title = row.Subject?.trim() || "Event";
      const desc = row.Description?.trim();
      const content = (desc && desc.length ? desc : title).slice(0, 100_000);
      const doc = {
        mempalace_drawer_id: `sfdc:Event:${row.Id}`,
        source: "sfdc_event",
        title,
        content,
        note_date: row.LastModifiedDate,
        created_at: row.LastModifiedDate,
      };
      if (account) doc.account = account;
      if (opportunity) doc.opportunity = opportunity;
      return doc;
    },
  },
  Opportunity: {
    fields: "Id, Name, Description, NextStep, StageName, LastModifiedDate, AccountId, Account.Name",
    toDoc(row) {
      const parts = [row.Description, row.NextStep].map((s) => s?.trim()).filter(Boolean);
      const title = row.Name?.trim() || "Opportunity";
      const content = (parts.length ? parts.join("\n\n") : title).slice(0, 100_000);
      const doc = {
        mempalace_drawer_id: `sfdc:Opportunity:${row.Id}`,
        source: "sfdc_opportunity",
        title,
        content,
        note_date: row.LastModifiedDate,
        created_at: row.LastModifiedDate,
      };
      const account = row.Account?.Name;
      if (account) doc.account = account;
      if (row.Name) doc.opportunity = row.Name.trim();
      if (row.StageName) doc.stage = row.StageName;
      return doc;
    },
  },
};

function log(msg, extra) {
  if (extra !== undefined) console.error(`[sfdc-poll] ${msg}`, extra);
  else console.error(`[sfdc-poll] ${msg}`);
}

function esAuthHeaders() {
  const headers = {};
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  const basic = process.env.ELASTICSEARCH_BASIC_AUTH;
  if (apiKey) headers.Authorization = `ApiKey ${apiKey}`;
  else if (basic) headers.Authorization = `Basic ${basic}`;
  return headers;
}

function getEsUrl() {
  return requireElasticsearchUrl();
}

function getIndex() {
  return process.env.STRATTRACK_INDEX || "strattrack_drawers";
}

async function esBulk(index, ndjsonLines) {
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

function loadWatermarks(path) {
  if (!existsSync(path)) return {};
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

function saveWatermarks(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function initialWatermarkIso() {
  const days = Math.max(1, parseInt(process.env.STRATTRACK_SFDC_INITIAL_LOOKBACK_DAYS || "30", 10));
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString();
}

function maxIso(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

function parseArgs(argv) {
  const flags = { dryRun: false, verbose: false };
  for (const a of argv) {
    if (a === "--dry-run") flags.dryRun = true;
    if (a === "--verbose") flags.verbose = true;
  }
  return flags;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const wmPath = resolve(process.env.STRATTRACK_SFDC_WATERMARK_FILE || ".strattrack-sfdc-watermark.json");
  const objectNames = (process.env.STRATTRACK_SFDC_OBJECTS || DEFAULT_OBJECTS.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const name of objectNames) {
    if (!OBJECT_CONFIG[name]) {
      throw new Error(
        `Unknown object "${name}" in STRATTRACK_SFDC_OBJECTS. Supported: ${Object.keys(OBJECT_CONFIG).join(", ")}`
      );
    }
  }

  const session = await getSalesforceSession();
  const { access_token, instance_url } = session;
  log(`Authenticated to Salesforce instance ${instance_url}`);

  let watermarks = loadWatermarks(wmPath);
  const initial = initialWatermarkIso();

  const index = getIndex();
  if (!flags.dryRun) log(`Elasticsearch index: ${index} at ${getEsUrl()}`);

  for (const objectName of objectNames) {
    const cfg = OBJECT_CONFIG[objectName];
    let wm = watermarks[objectName] || initial;
    const wmLiteral = `'${String(wm).replace(/'/g, "\\'")}'`;
    const soql = `SELECT ${cfg.fields} FROM ${objectName} WHERE LastModifiedDate > ${wmLiteral} ORDER BY LastModifiedDate ASC`;
    if (flags.verbose) log(`SOQL [${objectName}]: ${soql}`);

    const rows = await soqlQuery(instance_url, access_token, soql);
    log(`[${objectName}] fetched ${rows.length} row(s) with LastModifiedDate > ${wm}`);

    let maxLm = null;
    for (const row of rows) {
      maxLm = maxIso(maxLm, row.LastModifiedDate);
    }

    if (rows.length === 0) continue;

    if (flags.dryRun) {
      log(`[${objectName}] dry-run: skipping Elasticsearch bulk and watermark update`);
      continue;
    }

    const docs = rows.map((r) => cfg.toDoc(r));
    const now = new Date().toISOString();
    for (const batch of chunk(docs, BULK_CHUNK)) {
      const lines = [];
      for (const doc of batch) {
        const id = doc.mempalace_drawer_id;
        lines.push(JSON.stringify({ index: { _index: index, _id: id } }));
        lines.push(
          JSON.stringify({
            ...doc,
            created_at: doc.created_at || now,
            note_date: doc.note_date || now,
          })
        );
      }
      await esBulk(index, lines);
    }

    if (maxLm) {
      watermarks = { ...watermarks, [objectName]: maxLm };
      saveWatermarks(wmPath, watermarks);
      log(`[${objectName}] watermark advanced to ${maxLm}`);
    }
  }

  log("Done.");
}

main().catch((e) => {
  console.error("[sfdc-poll] fatal:", e.message || e);
  process.exit(1);
});
