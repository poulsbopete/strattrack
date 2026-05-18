/**
 * ONE–TWO–THREE shaping aligned with mcp/strattrack-mcp.mjs (elastic_get_1_2_3).
 */

export function lineFor123Summary(s) {
  const crm = [s.account, s.opportunity, s.title].filter(Boolean).join(" — ");
  if (crm) return crm;
  const palace = [s.wing, s.room, s.title].filter(Boolean).join(" — ");
  if (palace) return palace;
  const raw = s.content != null ? String(s.content).trim() : "";
  if (raw) {
    const one = raw.replace(/\s+/g, " ");
    return one.length > 140 ? `${one.slice(0, 137)}...` : one;
  }
  return "";
}

export function isCrmOnlyRow(s) {
  const hasWing = !!(s.wing && String(s.wing).trim());
  const hasRoom = !!(s.room && String(s.room).trim());
  if (hasWing || hasRoom) return false;
  return [s.account, s.opportunity, s.title].filter(Boolean).length >= 1;
}

/**
 * @param {Array<{ _source?: object }>} hits - Elasticsearch hits
 * @param {{ maxBlockers?: number }} opts
 */
export function buildDraftFromHits(hits, opts = {}) {
  const maxBlockers = opts.maxBlockers ?? 8;
  const orderedHits = [...hits].sort((a, b) => {
    const sa = a._source || {};
    const sb = b._source || {};
    return (isCrmOnlyRow(sa) ? 1 : 0) - (isCrmOnlyRow(sb) ? 1 : 0);
  });
  const blockers = [];
  const lines = [];
  for (const h of orderedHits) {
    const s = h._source || {};
    if (Array.isArray(s.blocker_tags) && s.blocker_tags.length) {
      blockers.push({
        id: h._id,
        account: s.account ?? s.wing,
        opportunity: s.opportunity ?? s.room,
        tags: s.blocker_tags,
        title: s.title,
      });
    }
    const oneLine = lineFor123Summary(s);
    if (oneLine) lines.push(oneLine);
  }
  return {
    one: lines[0] || "(no indexed notes — add elastic_add_note or run SFDC poll sync)",
    two: lines.slice(1, 4).join("; ") || "(fill from search)",
    three: lines.slice(4, 8).join("; ") || "(fill from search)",
    blockers_highlight: blockers.slice(0, maxBlockers),
    sources_considered: hits.length,
    lines_non_empty: lines.length,
  };
}
