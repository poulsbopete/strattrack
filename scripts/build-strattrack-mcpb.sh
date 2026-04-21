#!/usr/bin/env bash
# Build Claude Desktop extension bundle: dist/strattrack-elasticsearch.mcpb
# Requires Node/npm. See docs/MCP_CLAUDE_DESKTOP.md → "Claude Desktop (.mcpb)".
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${ROOT_DIR}/dist/mcpb-staging"
OUT="${ROOT_DIR}/dist/strattrack-elasticsearch.mcpb"
MANIFEST="${ROOT_DIR}/extensions/strattrack-elasticsearch/manifest.json"

if [[ ! -f "${MANIFEST}" ]]; then
  echo "Missing ${MANIFEST}" >&2
  exit 1
fi

rm -rf "${STAGE}"
mkdir -p "${STAGE}/server"

cp "${MANIFEST}" "${STAGE}/manifest.json"
cp "${ROOT_DIR}/mcp/strattrack-mcp.mjs" "${STAGE}/server/"
cp "${ROOT_DIR}/docker/strattrack-drawers-index.json" "${STAGE}/server/"
cp "${ROOT_DIR}/mcp/package.json" "${STAGE}/server/"

echo "Installing MCP dependencies into bundle..."
(cd "${STAGE}/server" && npm install --omit=dev)

mkdir -p "${ROOT_DIR}/dist"
rm -f "${OUT}"
(cd "${STAGE}" && zip -qr "${OUT}" manifest.json server)
rm -rf "${STAGE}"

echo "Built: ${OUT}"
echo "Install: Claude Desktop → Settings → Extensions → Install Extension… → pick this .mcpb file"
