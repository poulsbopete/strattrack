# StratTrack — Elasticsearch + Salesforce
#
# Copy this file to a private location and edit (never commit real values):
#   mkdir -p ~/.config/strattrack
#   cp scripts/strattrack-env.example.sh ~/.config/strattrack/env.sh
#   chmod 600 ~/.config/strattrack/env.sh
#
# Run workers from the repo root with:
#   ./scripts/with-strattrack-env.sh node scripts/sfdc-poll-to-elasticsearch.mjs
#   ./scripts/with-strattrack-env.sh node scripts/thursday-123-opportunities.mjs
#
# Or point at any file:
#   STRATTRACK_ENV_FILE=/path/to/env.sh ./scripts/with-strattrack-env.sh node scripts/sfdc-poll-to-elasticsearch.mjs
#
# Optional: same exports in ~/.zshrc if you want them in every shell (not recommended for API keys).

# --- Elasticsearch (Elastic Cloud — team “ai-assistants” deployment) ---
# API URL uses .es. (Elasticsearch). Kibana console is .kb. — do not use .kb. as ELASTICSEARCH_URL.
export ELASTICSEARCH_URL="https://ai-assistants-ffcafb.es.us-east-1.aws.elastic.cloud"
export ELASTICSEARCH_API_KEY="REPLACE_WITH_ENCODED_API_KEY"
# export STRATTRACK_INDEX="strattrack_drawers"
# export ELASTICSEARCH_BASIC_AUTH=""   # alternative to API key (base64 user:pass)

# --- Salesforce JWT (Connected App + integration user) ---
# SF_CLIENT_ID = Consumer Key (Setup → App Manager → your Connected App → Manage Consumer Details).
# SF_AUDIENCE = ONLY https://login.salesforce.com (production) OR https://test.salesforce.com (sandbox).
#   Do NOT use your Lightning / My Domain URL (e.g. *.lightning.force.com) — JWT will fail.
export SF_CLIENT_ID="YOUR_CONNECTED_APP_CONSUMER_KEY"
export SF_USERNAME="integration.user@example.com"
export SF_AUDIENCE="https://login.salesforce.com"
# Sandbox:
# export SF_AUDIENCE="https://test.salesforce.com"

export SF_PRIVATE_KEY_PATH="${HOME}/.secrets/sfdc-integration.pem"
# Or inline PEM (use \n for newlines in a single line):
# export SF_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# --- Alternative A: use YOUR login via Salesforce CLI (no JWT / no integration user) ---
# Install CLI, then: sf org login web --alias myorg
# In each fresh shell (tokens expire):
#   eval "$(node /ABSOLUTE/PATH/TO/strattrack/scripts/print-sf-cli-session.mjs --org myorg)"
# Or paste the printed STRATTRACK_SF_* lines here and comment out the entire JWT block below
# (if both are present, STRATTRACK_SF_* wins).

# --- Alternative B: OAuth password grant (your username; org may disable this) ---
# export SFDC_AUTH_MODE=password
# export SF_CLIENT_ID="…"
# export SF_CLIENT_SECRET="…"
# export SF_USERNAME="you@company.com"
# export SF_PASSWORD="YourPasswordPlusSecurityToken"
# export SF_AUDIENCE="https://login.salesforce.com"
