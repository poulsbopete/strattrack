/**
 * StratTrack scripts expect ELASTICSEARCH_URL (Serverless HTTPS by default).
 * Optional: http://localhost:9200 after local Docker/Podman (see docs/ELASTICSEARCH_LOCAL_ACCESS.md).
 */
export function requireElasticsearchUrl() {
  const u = (process.env.ELASTICSEARCH_URL || "").trim().replace(/\/$/, "");
  if (!u) {
    throw new Error(
      "ELASTICSEARCH_URL is required (e.g. Elastic Cloud Serverless https://…). For optional local Docker ES: ./scripts/quickstart-local-es.sh then export ELASTICSEARCH_URL=http://localhost:9200"
    );
  }
  return u;
}
