// Cytosine sequence context for methylation display. CpG is near-universal in
// mammals; plants also methylate CHG and CHH (H = A/C/T), which need their own
// view. 'all' shows every cytosine regardless of neighbours.
export type CytosineContext = 'CG' | 'CHG' | 'CHH' | 'all'

// Template-strand base pattern per context, 5'->3'. 'all' constrains only the
// cytosine itself.
const CONTEXT_PATTERN: Record<CytosineContext, string> = {
  CG: 'CG',
  CHG: 'CHG',
  CHH: 'CHH',
  all: 'C',
}

const COMPLEMENT: Record<string, string> = { a: 't', t: 'a', c: 'g', g: 'c' }

// IUPAC match of one expected template base ('C', 'G', or 'H') against an actual
// read base. 'H' = A/C/T.
function baseMatches(expected: string, actual: string | undefined) {
  return actual === undefined
    ? false
    : expected === 'H'
      ? // eslint-disable-next-line unicorn/prefer-includes-over-repeated-comparisons
        actual === 'a' || actual === 'c' || actual === 't'
      : actual === expected.toLowerCase()
}

/**
 * #api
 * Whether the cytosine at read position `pos` sits in the given context.
 *
 * The pattern is defined on the template (the strand the C is on), read 5'->3'.
 * For forward reads the stored sequence IS the template, so we read forward from
 * `pos`. getModPositions works reverse-strand reads in stored-sequence space,
 * where the template runs backwards and complemented, so we read backwards from
 * `pos` and complement each base before matching.
 */
export function matchesCytosineContext(
  seq: string,
  pos: number,
  isReverse: boolean,
  context: CytosineContext,
) {
  const pattern = CONTEXT_PATTERN[context]
  for (let i = 0, len = pattern.length; i < len; i++) {
    const expected = pattern[i]!
    if (isReverse) {
      const actual = seq[pos - i]?.toLowerCase()
      if (
        !baseMatches(
          expected,
          actual === undefined ? undefined : COMPLEMENT[actual],
        )
      ) {
        return false
      }
    } else if (!baseMatches(expected, seq[pos + i]?.toLowerCase())) {
      return false
    }
  }
  return true
}
