#!/usr/bin/env node
/**
 * Weekly ONE–TWO–THREE: list "relevant" Opportunities from Salesforce, pull StratTrack context
 * from Elasticsearch per opp (same shaping as elastic_get_1_2_3), write Markdown files.
 *
 * @see docs/THURSDAY_123_CRON.md
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { getSalesforceSession, soqlQuery } from "./lib/sfdc-auth.mjs";
import { getIndex, searchHitsForOpportunity, esBulk } from "./lib/strattrack-es.mjs";
import { buildDraftFromHits } from "./lib/strattrack-123.mjs";

const DEFAULT_SOQL = `
SELECT Id, Name, StageName, Account.Name
FROM Opportunity
WHERE IsClosed = false
ORDER BY LastModifiedDate DESC
LIMIT 200
`
  .replace(/\s+/g, " ")
  .trim();

function log(msg, extra) {
  if (extra !== undefined) console.error(`[thursday-123] ${msg}`, extra);
  else console.error(`[thursday-123] ${msg}`);
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function parseArgs(argv) {
  const flags = { dryRun: false, verbose: false };
  for (const a of argv) {
    if (a === "--dry-run") flags.dryRun = true;
    if (a === "--verbose") flags.verbose = true;
  }
  return flags;
}

function formatOppMarkdown({ opp, instanceUrl, draft, esTotal, runIso }) {
  const account = opp.Account?.Name || "(no account)";
  const lines = [
    `# ONE–TWO–THREE — ${account} / ${opp.Name}`,
    "",
    `- **Opportunity:** [${opp.Name}](${instanceUrl}/lightning/r/Opportunity/${opp.Id}/view})`,
    `- **Stage:** ${opp.StageName || "—"}`,
    `- **Elasticsearch hits used:** ${draft.sources_considered} (index total match hint: ${esTotal})`,
    `- **Generated (UTC):** ${runIso}`,
    "",
    "## ONE",
    "",
    draft.one,
    "",
    "## TWO",
    "",
    draft.two,
    "",
    "## THREE",
    "",
    draft.three,
    "",
  ];
  if (draft.blockers_highlight?.length) {
    lines.push("## Blocker tags", "");
    for (const b of draft.blockers_highlight) {
      lines.push(`- **${b.account || "—"}** / ${b.opportunity || "—"} — \`${(b.tags || []).join(", ")}\` — ${b.title || ""}`);
    }
    lines.push("");
  }
  lines.push("---", "", "*StratTrack `thursday-123-opportunities.mjs` — paste summary into Salesforce or Drive as needed.*", "");
  return lines.join("\n");
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const soql = (process.env.STRATTRACK_THURSDAY_SOQL || DEFAULT_SOQL).replace(/\s+/g, " ").trim();
  if (!/FROM\s+Opportunity/i.test(soql)) {
    throw new Error("STRATTRACK_THURSDAY_SOQL must query FROM Opportunity");
  }
  if (!/\bId\b/i.test(soql) || !/\bName\b/i.test(soql)) {
    throw new Error("STRATTRACK_THURSDAY_SOQL must include Id and Name (and Account.Name for best ES recall)");
  }

  const outDir = resolve(process.env.STRATTRACK_THURSDAY_OUT || "thursday-123-output");
  const runIso = new Date().toISOString();
  const runDate = runIso.slice(0, 10);
  const index = getIndex();
  const recordRecap =
    process.env.STRATTRACK_THURSDAY_RECORD_TO_ES === "1" ||
    process.env.STRATTRACK_THURSDAY_RECORD_TO_ES === "true";

  const session = await getSalesforceSession();
  const { access_token, instance_url } = session;
  log(`Salesforce: ${instance_url}`);
  log(`Elasticsearch index: ${index}`);
  log(`SOQL: ${soql}`);

  const opps = await soqlQuery(instance_url, access_token, soql);
  log(`Opportunities returned: ${opps.length}`);

  if (!flags.dryRun) {
    mkdirSync(outDir, { recursive: true });
  }

  const manifest = [];
  const recapBulk = [];

  for (const opp of opps) {
    const accountName = opp.Account?.Name?.trim();
    const oppName = opp.Name?.trim();
    if (!oppName) {
      log(`Skip opp ${opp.Id}: missing Name`);
      continue;
    }

    let searchRes;
    try {
      searchRes = await searchHitsForOpportunity({
        account: accountName,
        opportunity: oppName,
        index,
      });
    } catch (e) {
      log(`ES search failed for ${opp.Id}: ${e.message}`);
      manifest.push({ id: opp.Id, name: oppName, error: e.message });
      continue;
    }

    const hits = searchRes.hits?.hits || [];
    const esTotal =
      typeof searchRes.hits?.total === "object"
        ? searchRes.hits.total.value
        : searchRes.hits?.total ?? hits.length;
    const draft = buildDraftFromHits(hits);
    const md = formatOppMarkdown({ opp, instanceUrl: instance_url, draft, esTotal, runIso });

    if (flags.verbose) {
      log(`${opp.Id} ${oppName}: hits=${hits.length} lines=${draft.lines_non_empty}`);
    }

    manifest.push({
      id: opp.Id,
      name: oppName,
      account: accountName || null,
      hits: hits.length,
      es_total: esTotal,
      lines: draft.lines_non_empty,
    });

    if (flags.dryRun) continue;

    const fname = `123-${opp.Id}-${runDate}.md`;
    writeFileSync(join(outDir, fname), md, "utf8");

    if (recordRecap) {
      const recapId = `strattrack:thursday:${opp.Id}:${runDate}`;
      const recapBody = [
        `ONE: ${draft.one}`,
        `TWO: ${draft.two}`,
        `THREE: ${draft.three}`,
        draft.blockers_highlight?.length
          ? `Blockers: ${draft.blockers_highlight.map((b) => (b.tags || []).join("/")).join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      recapBulk.push({
        mempalace_drawer_id: recapId,
        source: "thursday_123",
        title: `Thursday 1-2-3 — ${oppName}`,
        content: recapBody.slice(0, 100_000),
        account: accountName || undefined,
        opportunity: oppName,
        stage: opp.StageName || undefined,
        note_date: runIso,
        created_at: runIso,
      });
    }
  }

  if (!flags.dryRun) {
    writeFileSync(
      join(outDir, `manifest-${runDate}.json`),
      JSON.stringify({ run_iso: runIso, instance_url, soql, opportunities: manifest }, null, 2) + "\n",
      "utf8"
    );
    log(`Wrote Markdown + manifest under ${outDir}`);
  }

  if (recordRecap && recapBulk.length && !flags.dryRun) {
    const now = runIso;
    for (const batch of chunk(recapBulk, 80)) {
      const lines = [];
      for (const doc of batch) {
        const id = doc.mempalace_drawer_id;
        lines.push(JSON.stringify({ index: { _index: index, _id: id } }));
        lines.push(JSON.stringify({ ...doc, created_at: doc.created_at || now, note_date: doc.note_date || now }));
      }
      await esBulk(lines);
    }
    log(`Indexed ${recapBulk.length} thursday_123 recap document(s) into ${index}`);
  }

  log("Done.");
}

main().catch((e) => {
  console.error("[thursday-123] fatal:", e.message || e);
  process.exit(1);
});
