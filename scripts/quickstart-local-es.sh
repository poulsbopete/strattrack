#!/usr/bin/env bash
# Start local Elasticsearch (Docker/Podman) and create strattrack_drawers if missing.
# Forwards the same flags as build-elastic-docker.sh (--no-start, --no-cache, --podman-compat).
# Safe to re-run from any cwd (uses script location to find repo root).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT_DIR/scripts/build-elastic-docker.sh" "$@"
"$ROOT_DIR/scripts/init-strattrack-index.sh"
