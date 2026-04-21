#!/usr/bin/env bash
# Create strattrack_drawers index if missing (same mapping as MCP elastic_ensure_index).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
ES_URL="${ES_URL%/}"
INDEX="${STRATTRACK_INDEX:-strattrack_drawers}"
BODY="${ROOT_DIR}/docker/strattrack-drawers-index.json"

if [[ ! -f "${BODY}" ]]; then
  echo "Missing ${BODY}" >&2
  exit 1
fi

if curl -sf -o /dev/null -X HEAD "${ES_URL}/${INDEX}"; then
  echo "Index \"${INDEX}\" already exists at ${ES_URL}."
  exit 0
fi

echo "Creating index \"${INDEX}\" at ${ES_URL}..."
curl -sS -X PUT "${ES_URL}/${INDEX}" -H "Content-Type: application/json" --data-binary "@${BODY}"
echo ""
