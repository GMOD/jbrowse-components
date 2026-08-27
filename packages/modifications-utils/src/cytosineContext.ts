// Cytosine sequence context for methylation display. CpG is near-universal in
// mammals; plants also methylate CHG and CHH (H = A/C/T), which need their own
// view. 'all' shows every cytosine regardless of neighbours.
export type CytosineContext = 'CG' | 'CHG' | 'CHH' | 'all'

const A = 65
const C = 67
const G = 71
const T = 84
// The IUPAC A/C/T ambiguity code, which is what the H of CHG/CHH is.
const H = 72

// Template-strand base pattern per context, 5'->3', as upper-case char codes.
// 'all' constrains only the cytosine itself.
const CONTEXT_PATTERN: Record<CytosineContext, Uint8Array> = {
  CG: Uint8Array.of(C, G),
  CHG: Uint8Array.of(C, H, G),
  CHH: Uint8Array.of(C, H, H),
  all: Uint8Array.of(C),
}

const COMPLEMENT_CODE = new Int16Array(128).fill(-1)
COMPLEMENT_CODE[A] = T
COMPLEMENT_CODE[T] = A
COMPLEMENT_CODE[C] = G
COMPLEMENT_CODE[G] = C

/**
 * #api
 * Whether the cytosine at read position `pos` sits in the given context.
 *
 * The pattern is defined on the template (the strand the C is on), read 5'->3'.
 * For forward reads the stored sequence IS the template, so we read forward from
 * `pos`. getModPositions works reverse-strand reads in stored-sequence space,
 * where the template runs backwards and complemented, so we read backwards from
 * `pos` and complement each base before matching.
 *
 * **Char codes, not characters, and that is the whole shape of this function.**
 * It reads `seq[pos]?.toLowerCase()` per probe and lower-cased the pattern
 * character beside it, which is two string operations per base — and the
 * fill-unmarked methylation walk asks this question up to twice for every
 * aligned base of every read (getMethBins), while bisulfite asks it at every
 * candidate cytosine. Folding case with `& ~0x20` on the code and comparing
 * numbers measured 5.64x on the predicate alone over 4M probes, byte-identical.
 *
 * `charCodeAt` past either end of the string is NaN and `NaN & ~0x20` is 0 — an
 * index no pattern base equals and the complement table holds -1 at — so the
 * walk runs off the read as a non-match with no bounds test of its own.
 * `features/modCoverage/readBaseCounts.ts` folds case the same way and says so.
 */
export function matchesCytosineContext(
  seq: string,
  pos: number,
  isReverse: boolean,
  context: CytosineContext,
) {
  const pattern = CONTEXT_PATTERN[context]
  for (let i = 0, len = pattern.length; i < len; i++) {
    const code = seq.charCodeAt(isReverse ? pos - i : pos + i) & ~0x20
    // A non-ASCII sequence character folds to something past the complement
    // table rather than into it, and matches no pattern base either way.
    if (code > 127) {
      return false
    }
    const actual = isReverse ? COMPLEMENT_CODE[code]! : code
    const expected = pattern[i]!
    if (
      expected === H
        ? actual !== A && actual !== C && actual !== T
        : actual !== expected
    ) {
      return false
    }
  }
  return true
}
