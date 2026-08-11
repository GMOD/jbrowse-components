import { DASH, N_UPPER, SPACE, isNoBaseByte } from './asciiBytes.ts'

// "No base at this column for this row" is a two-value test that always travels
// as a pair, and spelled out at a call site it is comparisons that have to be
// scanned to be believed — six of them in the codon triplet reader.
describe('isNoBaseByte', () => {
  it('is true for a gap and for row padding, and nothing else', () => {
    expect(isNoBaseByte(DASH)).toBe(true)
    expect(isNoBaseByte(SPACE)).toBe(true)
    for (const c of 'ACGTacgtN') {
      expect(isNoBaseByte(c.charCodeAt(0))).toBe(false)
    }
  })

  // `N` is a base that cannot be classified, which is a different question and
  // a different constant — folding it in here would drop unclassifiable columns
  // out of the alignment entirely instead of leaving them uncounted.
  it('does not claim an N', () => {
    expect(isNoBaseByte(N_UPPER)).toBe(false)
  })
})
