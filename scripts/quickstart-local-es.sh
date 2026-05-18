#!/usr/bin/env bash
# Optional: local Elasticsearch on localhost (Docker/Podman). Default StratTrack path is Elastic Cloud Serverless — set ELASTICSEARCH_URL + API key in MCP instead.
# Forwards the same flags as build-elastic-docker.sh (--no-start, --no-cache, --podman-compat).
# Safe to re-run from any cwd (uses script location to find repo root).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT_DIR/scripts/build-elastic-docker.sh" "$@"
# Local quickstart implies localhost ES for index creation unless user already exported a URL.
export ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
"$ROOT_DIR/scripts/init-strattrack-index.sh"
