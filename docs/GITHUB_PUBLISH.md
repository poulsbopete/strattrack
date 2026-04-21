# Publishing StratTrack on GitHub (Packages + Releases)

Two artifacts are produced automatically when you push a **SemVer tag**:

| Output | Where it appears | Purpose |
|--------|------------------|---------|
| **`@poulsbopete/strattrack-mcp`** | **GitHub Packages → npm** | `npx`, Claude/Cursor `command` + `args`, CI installs |
| **`strattrack-elasticsearch.mcpb`** | **GitHub Releases** (asset) | Claude Desktop **Install Extension…** |

## One-time: enable Actions

Repository **Settings → Actions → General** — allow workflows to run. Forks may need extra policy.

## Cut a release (maintainer)

From `main` with a clean tree:

```bash
# Bump mcp/package.json version locally if you want it to match before tagging (optional — CI also sets from tag)
git pull origin main
git tag v0.1.1 -m "StratTrack MCP 0.1.1"
git push origin v0.1.1
```

The **Release** workflow (`.github/workflows/release.yml`) will:

1. Set `mcp/package.json` `version` from the tag (`v` stripped).
2. **`npm publish`** to `https://npm.pkg.github.com` using `GITHUB_TOKEN`.
3. Build **`dist/strattrack-elasticsearch.mcpb`**.
4. Create a **GitHub Release** for that tag and attach the `.mcpb`.

## Install the npm package from GitHub Packages

Create a GitHub **classic PAT** with `read:packages` (and `repo` if the package is private).

**`~/.npmrc`** (macOS/Linux):

```
@poulsbopete:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Then:

```bash
npm install -g @poulsbopete/strattrack-mcp
# or project-local:
npm install @poulsbopete/strattrack-mcp
```

**Claude Desktop** can point at the global binary, for example:

```json
"strattrack-elasticsearch": {
  "command": "strattrack-mcp",
  "args": [],
  "env": {
    "ELASTICSEARCH_URL": "http://localhost:9200",
    "STRATTRACK_INDEX": "strattrack_drawers"
  }
}
```

(Ensure the global npm `bin` directory is on `PATH` for the GUI app.)

## Install the `.mcpb` without npm

1. Open the **Releases** page on GitHub.
2. Download **`strattrack-elasticsearch.mcpb`** for the desired version.
3. Claude Desktop → **Settings → Extensions → Install Extension…**

## Troubleshooting

- **`403` on `npm publish`:** confirm the package **`name`** in `mcp/package.json` is **`@poulsbopete/...`** (must match the GitHub **owner** of the repo for the default `GITHUB_TOKEN` publish path).
- **Duplicate releases:** avoid re-pushing the same tag; use a new version tag.

## References

- [Working with the npm registry — GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [Claude MCPB build guide](https://claude.com/docs/connectors/building/mcpb)
