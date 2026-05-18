#!/usr/bin/env bash
# StratTrack — load a private env file, then exec a command from the repo root.
# See scripts/strattrack-env.example.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="${STRATTRACK_ENV_FILE:-}"
if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "STRATTRACK_ENV_FILE is set but not a regular file: $ENV_FILE" >&2
    exit 1
  fi
elif [[ -f "$ROOT/.env.strattrack.local" ]]; then
  ENV_FILE="$ROOT/.env.strattrack.local"
elif [[ -f "${HOME}/.config/strattrack/env.sh" ]]; then
  ENV_FILE="${HOME}/.config/strattrack/env.sh"
else
  cat >&2 <<EOF
StratTrack: no env file found.

  Option A (recommended):
    mkdir -p ~/.config/strattrack
    cp ${ROOT}/scripts/strattrack-env.example.sh ~/.config/strattrack/env.sh
    chmod 600 ~/.config/strattrack/env.sh
    # edit env.sh with real URL, API key, Salesforce JWT settings

  Option B (repo-local, gitignored via .env.*):
    cp ${ROOT}/scripts/strattrack-env.example.sh ${ROOT}/.env.strattrack.local

Then run from anywhere:
    ${ROOT}/scripts/with-strattrack-env.sh node ${ROOT}/scripts/sfdc-poll-to-elasticsearch.mjs

Override file:
    STRATTRACK_ENV_FILE=/path/to/env.sh ${ROOT}/scripts/with-strattrack-env.sh node ...
EOF
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "usage: STRATTRACK_ENV_FILE=… ${0##*/} <command> [args…]" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$ROOT"
exec "$@"
