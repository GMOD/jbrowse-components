// "THP-1", "Fiber-seq" and "hg38_to_mm10" are spelled with and without these,
// so a term typed without them still matches
const joiners = /[-_]/g

/**
 * The text a search box matches one row against, from the fields the row
 * shows as plain text; a caller whose fields draw as markup strips it first,
 * so a search finds only what is on screen.
 *
 * - newline-joined, so a term can't span two fields
 * - lowercased, matched case-insensitively against lowercased terms
 * - followed by the same lines with `-` and `_` removed, so `thp1` finds
 *   "THP-1" and `fiberseq` finds "Fiber-seq"
 *
 * Built once per row, not per keystroke.
 */
export function buildSearchText(fields: unknown[]) {
  const text = fields
    .filter(f => f !== undefined && f !== null)
    .join('\n')
    .toLowerCase()
  const compact = text.replaceAll(joiners, '')
  return compact === text ? text : `${text}\n${compact}`
}

/**
 * What a search box's raw contents mean as a query. Whitespace separates
 * terms and a row must contain every one, in any field and any order;
 * `"double quotes"` keep a phrase together, and a leading `-` turns a term
 * into one the row must not contain. A lone `-`, on the way to typing an
 * excluded word, is no term yet. Lowercased to match {@link buildSearchText}.
 * Exact per term, with no typo tolerance (ADR-269).
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
 * A predicate over {@link buildSearchText} output for one search box's
 * contents, or undefined when the box holds no terms and every row matches.
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
 * What a search box highlights in the rows it kept: each term a row has to
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
