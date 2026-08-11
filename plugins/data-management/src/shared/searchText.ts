import { coarseStripHTML } from '@jbrowse/core/util'

/**
 * The text one of the track selectors' filter boxes matches a track against.
 *
 * *Which* fields a selector puts in is its own call — the rule is that it
 * searches what it shows, so the faceted grid includes every column it renders
 * (adapter, metadata) and the tree does not. How they are normalized is shared
 * and must not drift, or the same query behaves differently in the two:
 *
 * - newline-joined, so a query can't span two fields (both boxes are one line)
 * - markup stripped, so a query can't match a tag name that never appears on
 *   screen — searching `i` should not hit a track named `<i>foo</i>`
 * - lowercased, matched case-insensitively against a lowercased query
 *
 * Built once per track where the sources are assembled, not per keystroke.
 */
export function buildSearchText(fields: unknown[]) {
  return coarseStripHTML(
    fields.filter(f => f !== undefined && f !== null).join('\n'),
  ).toLowerCase()
}

/**
 * The other half of the same contract: what a filter box's raw contents mean as
 * a query. Lowercased to match {@link buildSearchText}, and trimmed — a
 * trailing space from a paste or a mistyped word is not something the user
 * means to search for, and since the fields are newline-joined it can only ever
 * subtract matches. Empty means "no query": `''.includes` is always true, so
 * every selector's unfiltered case falls out of the same substring test.
 */
export function normalizeSearchQuery(filterText: string) {
  return filterText.trim().toLowerCase()
}
