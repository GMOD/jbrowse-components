import { coarseStripHTML } from '@jbrowse/core/util'

// "THP-1", "Fiber-seq" and "hg38_to_mm10" are spelled with and without these
// in track names, so a term typed without them still matches
const joiners = /[-_]/g

/**
 * The text one of the track selectors' filter boxes matches a track against.
 *
 * *Which* fields a selector puts in is its own call — the rule is that it
 * searches what it shows, so the faceted grid includes every column it renders
 * (adapter, metadata) and the tree does not. How they are normalized is shared
 * and must not drift, or the same query behaves differently in the two:
 *
 * - newline-joined, so a term can't span two fields
 * - markup stripped, so a term can't match a tag name that never appears on
 *   screen — searching `i` should not hit a track named `<i>foo</i>`
 * - lowercased, matched case-insensitively against lowercased terms
 * - followed by the same lines with `-` and `_` removed, so `thp1` finds
 *   "THP-1" and `fiberseq` finds "Fiber-seq"
 *
 * Built once per track where the sources are assembled, not per keystroke.
 */
export function buildSearchText(fields: unknown[]) {
  const text = coarseStripHTML(
    fields.filter(f => f !== undefined && f !== null).join('\n'),
  ).toLowerCase()
  const compact = text.replaceAll(joiners, '')
  return compact === text ? text : `${text}\n${compact}`
}

/**
 * The other half of the same contract: what a filter box's raw contents mean
 * as a query. Whitespace separates terms and a track must contain every one,
 * in any field and any order; `"double quotes"` keep a phrase together, and a
 * leading `-` turns a term into one the track must not contain. A lone `-`,
 * on the way to typing an excluded word, is no term yet. Lowercased to match
 * {@link buildSearchText}.
 */
export function parseSearchQuery(filterText: string) {
  return [
    ...filterText.toLowerCase().matchAll(/(-?)(?:"([^"]*)"?|(\S+))/g),
  ].flatMap(([, minus, phrase, word]) => {
    const text = phrase ?? word ?? ''
    return text && text !== '-' ? [{ text, exclude: minus === '-' }] : []
  })
}

/**
 * A predicate over {@link buildSearchText} output for one filter box's
 * contents, or undefined when the box holds no terms and every track matches.
 */
export function searchMatcher(filterText: string) {
  const terms = parseSearchQuery(filterText)
  return terms.length
    ? (searchText: string) =>
        terms.every(
          ({ text, exclude }) => searchText.includes(text) !== exclude,
        )
    : undefined
}

function escapeRegExp(text: string) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * What a filter box highlights in the rows it kept: each term a track has to
 * contain, as a pattern that also spans the `-` and `_` the match skipped, so
 * `thp1` marks "THP-1".
 */
export function highlightPatterns(filterText: string) {
  return parseSearchQuery(filterText)
    .filter(term => !term.exclude)
    .map(
      term =>
        new RegExp(Array.from(term.text, escapeRegExp).join('[-_]*'), 'giu'),
    )
}
