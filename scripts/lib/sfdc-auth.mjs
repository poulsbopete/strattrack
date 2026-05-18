/**
 * Salesforce REST auth (JWT or password) + paginated SOQL.
 * Shared by sfdc-poll-to-elasticsearch.mjs and thursday-123-opportunities.mjs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPrivateKey, sign } from "node:crypto";

export const API_VERSION = "v59.0";

function base64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function buildSalesforceJwt() {
  const clientId = process.env.SF_CLIENT_ID;
  const username = process.env.SF_USERNAME;
  const audience = process.env.SF_AUDIENCE || "https://login.salesforce.com";
  let pem =
    process.env.SF_PRIVATE_KEY ||
    (process.env.SF_PRIVATE_KEY_PATH
      ? readFileSync(resolve(process.env.SF_PRIVATE_KEY_PATH), "utf8")
      : null);
  if (!clientId || !username || !pem) {
    throw new Error(
      "JWT auth requires SF_CLIENT_ID, SF_USERNAME, and SF_PRIVATE_KEY or SF_PRIVATE_KEY_PATH (and optional SF_AUDIENCE)"
    );
  }
  pem = pem.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256" };
  const payload = {
    iss: clientId,
    sub: username,
    aud: audience,
    exp: now + 3 * 60,
  };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const input = `${encHeader}.${encPayload}`;
  const key = createPrivateKey(pem);
  const sig = sign("RSA-SHA256", Buffer.from(input), key);
  return `${input}.${base64url(sig)}`;
}

async function getTokenJwt() {
  const audience = process.env.SF_AUDIENCE || "https://login.salesforce.com";
  const assertion = buildSalesforceJwt();
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await fetch(`${audience}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Salesforce token (JWT) failed HTTP ${res.status}: ${text.slice(0, 600)}`);
  }
  const json = JSON.parse(text);
  return { access_token: json.access_token, instance_url: json.instance_url };
}

async function getTokenPassword() {
  const clientId = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;
  const username = process.env.SF_USERNAME;
  const password = process.env.SF_PASSWORD;
  const audience = process.env.SF_AUDIENCE || "https://login.salesforce.com";
  if (!clientId || !clientSecret || !username || !password) {
    throw new Error("Password auth requires SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USERNAME, SF_PASSWORD");
  }
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password,
  });
  const res = await fetch(`${audience}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Salesforce token (password) failed HTTP ${res.status}: ${text.slice(0, 600)}`);
  }
  const json = JSON.parse(text);
  return { access_token: json.access_token, instance_url: json.instance_url };
}

export async function getSalesforceSession() {
  const token = process.env.STRATTRACK_SF_ACCESS_TOKEN?.trim();
  const rawInstance = (process.env.STRATTRACK_SF_INSTANCE_URL || "").trim();
  const instance = rawInstance.replace(/\/$/, "");
  if (token && instance) {
    return { access_token: token, instance_url: instance };
  }
  if (token || rawInstance) {
    throw new Error(
      "Set both STRATTRACK_SF_ACCESS_TOKEN and STRATTRACK_SF_INSTANCE_URL (from Salesforce CLI: scripts/print-sf-cli-session.mjs), or omit both and use JWT / password."
    );
  }

  const mode = (process.env.SFDC_AUTH_MODE || "jwt").toLowerCase();
  if (mode === "password") return getTokenPassword();
  return getTokenJwt();
}

export async function soqlQuery(instanceUrl, accessToken, soql) {
  const q = encodeURIComponent(soql.replace(/\s+/g, " ").trim());
  let url = `${instanceUrl}/services/data/${API_VERSION}/query?q=${q}`;
  const out = [];
  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Sforce-Call-Options": "client=strattrack-scripts/1.0",
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`SOQL failed HTTP ${res.status}: ${text.slice(0, 1200)}`);
    }
    const json = JSON.parse(text);
    out.push(
      ...(json.records || []).map((r) => {
        const { attributes, ...rest } = r;
        return rest;
      })
    );
    url = json.done ? null : instanceUrl + json.nextRecordsUrl;
  }
  return out;
}
