/**
 * Copy Elasticsearch index JSON into mcp/ so `npm pack` / `npm publish` include it
 * (strattrack-mcp.mjs loads ./strattrack-drawers-index.json before ../docker/).
 */
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "docker", "strattrack-drawers-index.json");
const dst = join(root, "mcp", "strattrack-drawers-index.json");
copyFileSync(src, dst);
console.log("npm prepublish: copied docker/strattrack-drawers-index.json → mcp/");
