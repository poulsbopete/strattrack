#!/usr/bin/env bash
# Load optional secrets from macOS Keychain, then start the StratTrack MCP server.
# See docs/MACOS_KEYCHAIN.md
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYCHAIN_ACCOUNT="${STRATTRACK_KEYCHAIN_ACCOUNT:-strattrack}"

read_keychain() {
  local service_id="$1"
  security find-generic-password -a "${KEYCHAIN_ACCOUNT}" -s "${service_id}" -w 2>/dev/null || true
}

# Elasticsearch API key (optional; local Docker ES often has no auth)
if [[ -z "${ELASTICSEARCH_API_KEY:-}" ]]; then
  v="$(read_keychain "strattrack.elasticsearch.api_key")"
  if [[ -n "$v" ]]; then
    export ELASTICSEARCH_API_KEY="$v"
  fi
fi

# Basic auth base64(user:pass) — optional alternative to API key
if [[ -z "${ELASTICSEARCH_BASIC_AUTH:-}" ]]; then
  v="$(read_keychain "strattrack.elasticsearch.basic_auth")"
  if [[ -n "$v" ]]; then
    export ELASTICSEARCH_BASIC_AUTH="$v"
  fi
fi

export ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
export STRATTRACK_INDEX="${STRATTRACK_INDEX:-strattrack_drawers}"

exec node "${ROOT_DIR}/mcp/strattrack-mcp.mjs"
