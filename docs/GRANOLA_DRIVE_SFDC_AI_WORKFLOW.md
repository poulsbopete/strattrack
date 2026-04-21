# Granola → Google Drive → AI / Salesforce / Calendar

**Purpose:** Share with leadership and IT so expectations, approvals, and ownership are clear. This doc describes a practical path from **Granola** notes to a **shared Google Drive**, then to **matching Salesforce opportunities**, **updating SA notes**, and **Google Calendar** follow-ups—including how **Claude Desktop** fits (and what it cannot do alone).

---

## 1. Granola → shared Google Drive (managers + “AI”)

**Goal:** Meeting notes land in a **team-owned** Drive location with predictable naming, permissions that match “managers can see,” and automation allowed to read the same place.

### What to ask for

| Ask | Who | Why |
|-----|-----|-----|
| A **shared Drive** (not only “My Drive” shared out) with a dedicated folder (e.g. `SA-Meeting-Notes/`) owned by a **group** or centrally managed space | Google Workspace admin | Stable ownership when people leave; clearer audit trail |
| **Default access** for managers (Viewer vs Commenter) and whether **Content manager** is needed for metadata fixes | You + leadership | Reduces accidental deletes; matches trust model |
| Whether **company policy** allows full **transcripts** in Drive (PII, regulated customers) | Legal / InfoSec | May require summary-only, retention, or redaction |
| **Granola → Google Drive** — Granola supports a **native save/export into Google** (no Zapier required) for getting notes into Drive/Docs; confirm which destinations and formats your org allows | You + IT | Prefer the vendor-native path first; fewer moving parts and connectors to approve |
| **Elastic Security / internal InfoSec approval** if any StratTrack, MCP, or Elastic-side workflow will **read or index Google Drive** (Drive API, shared folders, or “AI over Drive” integrations) | Elastic Security + Google/Workspace stakeholders | Drive access for automation or assistants is a **deliberate security boundary**—get written approval before enabling connectors or service accounts |
| **Optional third-party automation** — if you still need rules beyond Granola’s native flow, **Zapier / Make** (or similar) can write Markdown or Docs per meeting | You + IT (connector approval) | Only when native save is insufficient or you need multi-step fan-out |
| **Naming convention**: date, account, deal hint in filename or first line | SA team | Makes Salesforce matching much easier |

**Note on “AI on Drive”:** That usually means **Workspace AI (Gemini/Duet)** where licensed, **or** a separate app that reads files via API. It does **not** mean any assistant silently indexes the whole Drive. Ask explicitly: **May an approved integration read this Shared Drive and, if allowed, call a third-party model API—or must processing stay in Google-only tools?**

---

## 2. Claude Desktop “against Google Drive” → SFDC match → SA notes → Calendar

**Reality check:** Claude Desktop works with **conversations, explicit files, and connectors you provide**. It does **not** continuously crawl an entire Shared Drive like a database.

### Two patterns

**A — Human-in-the-loop (smallest ask)**  
You attach or select the right notes; Claude helps draft SFDC updates and calendar wording. **Requires:** your Drive + SFDC access; no org-wide automation approval beyond normal tools.

**B — Team-scale automation (what “always on” implies)**  
A small **integration service** (optionally invoked from Claude via **MCP**) that:

1. Lists/reads **new files** in the Shared Drive (Drive API).
2. Parses title/body for account, opportunity name, blockers.
3. **Queries Salesforce** (Opportunity by name, account, stage, dates).
4. **Writes** to the agreed place (Opportunity field, Chatter, custom “SA Notes”—per org standard).
5. **Creates** Google Calendar events or Tasks (Calendar API), or SFDC Tasks if that is the org standard.

### What to ask for (integration + security)

| Ask | Who |
|-----|-----|
| **Salesforce API access** (OAuth connected app or integration user) with **minimal** scope: read Opportunities (and Account), **append** notes in the agreed format | Salesforce admin |
| **Canonical “SA notes” location** (rich text field vs Chatter vs custom object) | Sales Ops |
| **Google Cloud project** with **Drive API** (read folder) and **Calendar API** (create events), using user OAuth **or** a **service account** with **domain-wide delegation** if jobs run unattended | Workspace admin |
| **Shared Drive** + folder ID; confirm the integration identity can **read** (and optionally write sidecar metadata, e.g. “already processed”) | Admin |
| **Data residency / vendor AI:** may note/transcript content go to **Anthropic** (API) or must processing stay in **Google** (Gemini/Vertex) or on-prem? | InfoSec |
| **Elastic Security (or org equivalent)** approval before any **Google Drive API** access, indexing, or MCP connector that reads Shared Drive on behalf of Solution Architects | Elastic Security + team lead |
| **Idempotency:** same file must not create duplicate Calendar reminders — use a stable key (e.g. Drive `fileId` + Opportunity Id) | You + eng |

**Claude Desktop’s role:** Great for **guided** runs (“process these new files”) if **MCP** or a small server lists Drive and calls SFDC. **Fully automated nightly jobs** are usually a **scheduler + API** (same business logic), not Claude Desktop left open.

---

## 3. One paragraph for manager / IT (copy-paste)

> We want Granola meeting notes to land in a **team Shared Drive** so leadership has visibility—using Granola’s **native save to Google** where possible (no Zapier required for that step). We then want **approved automation** to **read new notes**, **match them to Salesforce opportunities**, **append structured SA updates** in the agreed Salesforce location, and **create Google Calendar reminders** for follow-ups. That needs: (1) a Shared Drive folder with correct **group permissions**, (2) **Elastic Security** (or equivalent internal InfoSec) **sign-off** if anything in our stack will **access Google Drive** via API or indexing, plus an allowed **Granola → Drive** path, (3) a **Salesforce integration user** with minimal write scope, (4) **Google APIs** for Drive and Calendar when automation reads or writes them, and (5) **security sign-off** on whether content may be processed by third-party AI APIs or must stay in Google-only tools.

---

## 4. Suggested order of operations

1. **Shared Drive + Granola → Drive** (folder, sharing; use **Granola’s native Google save** first; **Elastic Security** approval if Drive will be read/indexed by StratTrack-related tooling; optional Zapier/Make only if needed).  
2. **Salesforce “where SA notes live”** (single source of truth).  
3. **Matching rules** (filename + account list first; AI assist second).  
4. **Calendar vs SFDC Tasks** (pick one standard for “reach out” nudges).  
5. **Claude’s role:** Desktop + MCP for interactive use first; **scheduled worker** once matching is trusted.

---

## 5. Optional context: Zapier / Make (only if native Granola → Google is not enough)

**Granola’s native flow to Google** is the first choice for getting notes into Drive or Google Docs—**no Zapier required** for that vendor path.

Third-party workflow tools (e.g. Zapier, Make) remain useful when you need **extra orchestration** (fan-out to multiple systems, transforms, or schedules) that Granola does not cover. Treat them as **implementation detail** once IT approves the connector and data path—see Granola’s help center for **sharing**, **native Google integration**, and any **export** limits vs. automation.

---

*Internal planning doc — align with Legal/InfoSec before production use.*
