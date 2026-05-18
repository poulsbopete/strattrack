#!/usr/bin/env node
/**
 * Print shell exports for STRATTRACK_SF_ACCESS_TOKEN + STRATTRACK_SF_INSTANCE_URL
 * from an existing Salesforce CLI login (your user — no JWT / integration user).
 *
 * Prerequisites: Salesforce CLI v2 (`sf`) installed and `sf org login web` (or jwt) done.
 *
 * Usage:
 *   eval "$(node scripts/print-sf-cli-session.mjs)"
 *   eval "$(node scripts/print-sf-cli-session.mjs --org MYALIAS)"
 *
 * Then run StratTrack scripts as usual (with-strattrack-env.sh or inline exports).
 * Tokens expire; re-run this after `sf org login` when API calls fail with 401.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
let targetOrg = process.env.SF_TARGET_ORG;
const oi = argv.indexOf("--org");
if (oi >= 0 && argv[oi + 1]) targetOrg = argv[oi + 1];
const eq = argv.find((a) => a.startsWith("--org="));
if (eq) targetOrg = eq.slice("--org=".length);

const args = ["org", "display", "--json"];
if (targetOrg) args.push("--target-org", targetOrg);

const r = spawnSync("sf", args, { encoding: "utf8", maxBuffer: 20_000_000 });
if (r.error?.code === "ENOENT") {
  console.error(
    "[print-sf-cli-session] `sf` not found in PATH. Install Salesforce CLI: https://developer.salesforce.com/tools/salesforcecli"
  );
  process.exit(127);
}
if (r.status !== 0) {
  console.error(r.stderr || r.stdout || "[print-sf-cli-session] sf org display failed");
  process.exit(r.status ?? 1);
}

let j;
try {
  j = JSON.parse(r.stdout);
} catch {
  console.error("[print-sf-cli-session] Could not parse JSON from sf org display");
  process.exit(1);
}

const res = j.result ?? j;
const access = res.accessToken;
const instance = String(res.instanceUrl || "")
  .trim()
  .replace(/\/$/, "");

if (!access || !instance) {
  console.error(
    "[print-sf-cli-session] Missing accessToken or instanceUrl. Run: sf org login web --alias YOUR_ORG"
  );
  process.exit(1);
}

/** Bash-safe single-quoted literal */
function shSingle(s) {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

const self = fileURLToPath(import.meta.url);
console.error(`# From Salesforce CLI session (${instance}) — token expires; re-run when API returns 401.`);
console.error(`# eval "$(node ${JSON.stringify(self)}${targetOrg ? ` --org ${JSON.stringify(targetOrg)}` : ""})"`);
console.log(`export STRATTRACK_SF_ACCESS_TOKEN=${shSingle(access)}`);
console.log(`export STRATTRACK_SF_INSTANCE_URL=${shSingle(instance)}`);
