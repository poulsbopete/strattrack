#!/usr/bin/env bash
# Build (and optionally start) the local StratTrack Elasticsearch Docker image.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker/docker-compose.elasticsearch.yml"

usage() {
  echo "Usage: $(basename "$0") [--no-start] [--no-cache]"
  echo "  --no-start   Only build the image, do not run docker compose up."
  echo "  --no-cache   Build with --no-cache (clean rebuild)."
}

NO_START=false
NO_CACHE=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-start) NO_START=true ;;
    --no-cache) NO_CACHE=(--no-cache) ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

cd "${ROOT_DIR}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker does not appear to be running. Start Docker Desktop (or the daemon) and retry." >&2
  exit 1
fi

echo "Building Elasticsearch image (compose project: strattrack)..."
docker compose -f "${COMPOSE_FILE}" build "${NO_CACHE[@]}" elasticsearch

if [[ "${NO_START}" == true ]]; then
  echo "Skipping start (--no-start). Image is ready."
  exit 0
fi

echo "Starting Elasticsearch..."
docker compose -f "${COMPOSE_FILE}" up -d elasticsearch

echo ""
echo "StratTrack local Elasticsearch is up."
echo "  HTTP:  http://localhost:9200"
echo "  Stop:  docker compose -f docker/docker-compose.elasticsearch.yml down"
echo "  Logs:  docker compose -f docker/docker-compose.elasticsearch.yml logs -f elasticsearch"
