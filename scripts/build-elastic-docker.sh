#!/usr/bin/env bash
# Build (and optionally start) the local StratTrack Elasticsearch image.
# Works with Docker Compose or Podman Compose (Podman Desktop).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker/docker-compose.elasticsearch.yml"
COMPOSE_PODMAN_COMPAT="${ROOT_DIR}/docker/docker-compose.elasticsearch.podman-compat.yml"

usage() {
  echo "Usage: $(basename "$0") [--no-start] [--no-cache] [--podman-compat]"
  echo "  --no-start       Only build the image, do not start the container."
  echo "  --no-cache       Build with --no-cache (clean rebuild)."
  echo "  --podman-compat  Merge podman-compat compose (disables mlock; rootless Podman)."
  echo ""
  echo "Environment:"
  echo "  STRATTRACK_CONTAINER_RUNTIME=docker|podman   Force engine (default: auto-detect)."
  echo "  STRATTRACK_PODMAN_COMPAT=1                     Same as --podman-compat."
}

NO_START=false
NO_CACHE=()
PODMAN_COMPAT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-start) NO_START=true ;;
    --no-cache) NO_CACHE=(--no-cache) ;;
    --podman-compat) PODMAN_COMPAT=true ;;
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

if [[ "${STRATTRACK_PODMAN_COMPAT:-}" == "1" || "${STRATTRACK_PODMAN_COMPAT:-}" == "true" ]]; then
  PODMAN_COMPAT=true
fi

cd "${ROOT_DIR}"

COMPOSE_BACKEND=""
select_compose_backend() {
  local forced="${STRATTRACK_CONTAINER_RUNTIME:-}"
  if [[ -n "${forced}" ]]; then
    case "${forced}" in
      docker)
        COMPOSE_BACKEND=docker
        if ! docker compose version >/dev/null 2>&1; then
          echo "STRATTRACK_CONTAINER_RUNTIME=docker but 'docker compose' is not available." >&2
          exit 1
        fi
        ;;
      podman)
        COMPOSE_BACKEND=podman
        if ! podman compose version >/dev/null 2>&1; then
          echo "STRATTRACK_CONTAINER_RUNTIME=podman but 'podman compose' is not available." >&2
          exit 1
        fi
        ;;
      *)
        echo "Invalid STRATTRACK_CONTAINER_RUNTIME=${forced} (use docker or podman)." >&2
        exit 1
        ;;
    esac
    return
  fi

  if docker info >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_BACKEND=docker
    return
  fi

  if podman info >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
    COMPOSE_BACKEND=podman
    return
  fi

  echo "No usable container engine found." >&2
  echo "  - Start Docker Desktop and ensure 'docker compose' works, or" >&2
  echo "  - Start Podman (Podman Desktop) and ensure 'podman compose' is available, or" >&2
  echo "  - Set STRATTRACK_CONTAINER_RUNTIME=docker|podman if both are installed." >&2
  exit 1
}

compose_cmd() {
  case "${COMPOSE_BACKEND}" in
    docker) docker compose "$@" ;;
    podman) podman compose "$@" ;;
    *)
      echo "Internal error: COMPOSE_BACKEND unset." >&2
      exit 1
      ;;
  esac
}

select_compose_backend

case "${COMPOSE_BACKEND}" in
  docker)
    if ! docker info >/dev/null 2>&1; then
      echo "Docker is selected but not running. Start Docker Desktop (or the daemon)." >&2
      exit 1
    fi
    ;;
  podman)
    if ! podman info >/dev/null 2>&1; then
      echo "Podman is selected but not running. Start Podman Desktop (or the service)." >&2
      exit 1
    fi
    ;;
esac

COMPOSE_ARGS=(-f "${COMPOSE_FILE}")
if [[ "${PODMAN_COMPAT}" == true ]]; then
  COMPOSE_ARGS+=(-f "${COMPOSE_PODMAN_COMPAT}")
  echo "Using Podman compat overlay (bootstrap.memory_lock=false)."
fi

echo "Using: ${COMPOSE_BACKEND} compose"
echo "Building Elasticsearch image (compose project: strattrack)..."
compose_cmd "${COMPOSE_ARGS[@]}" build "${NO_CACHE[@]}" elasticsearch

if [[ "${NO_START}" == true ]]; then
  echo "Skipping start (--no-start). Image is ready."
  exit 0
fi

echo "Starting Elasticsearch..."
compose_cmd "${COMPOSE_ARGS[@]}" up -d elasticsearch

COMPAT_FILES=""
if [[ "${PODMAN_COMPAT}" == true ]]; then
  COMPAT_FILES=' -f docker/docker-compose.elasticsearch.podman-compat.yml'
fi

echo ""
echo "StratTrack local Elasticsearch is up."
echo "  HTTP:   http://localhost:9200"
echo "  Stop:   cd \"${ROOT_DIR}\" && ${COMPOSE_BACKEND} compose -f docker/docker-compose.elasticsearch.yml${COMPAT_FILES} down"
echo "  Logs:   cd \"${ROOT_DIR}\" && ${COMPOSE_BACKEND} compose -f docker/docker-compose.elasticsearch.yml${COMPAT_FILES} logs -f elasticsearch"
if [[ "${PODMAN_COMPAT}" != true ]]; then
  echo "  Podman rootless + mlock issues: re-run with --podman-compat or STRATTRACK_PODMAN_COMPAT=1"
fi
