import { findBubblePairRecord } from './gfaTabixUtils.ts'

// BubbleEntry shape as used in gfaTabixUtils
interface BubbleEntry {
  alleleA: number
  alleleB: number
  identity: number
  cs: string
  genomesA: Set<number>
  genomesB: Set<number>
}

describe('findBubblePairRecord', () => {
  it('returns cs as-is when alleleA is the reference allele', () => {
    // alleleA=0 (ref), alleleB=1 (query): genome 0 → ref, genome 1 → query
    // CS '*ac': ref base = a, query base = c — correct orientation
    const bubbles: BubbleEntry[] = [
      {
        alleleA: 0,
        alleleB: 1,
        identity: 0.5,
        cs: '*ac',
        genomesA: new Set([0]),
        genomesB: new Set([1]),
      },
    ]
    const result = findBubblePairRecord(bubbles, 0, 1, 1, 0)
    expect(result?.cs).toBe('*ac')
  })

  it('returns undefined when query carries same allele as ref', () => {
    const bubbles: BubbleEntry[] = [
      {
        alleleA: 0,
        alleleB: 1,
        identity: 1,
        cs: '*ac',
        genomesA: new Set([0, 1]),
        genomesB: new Set(),
      },
    ]
    // both query (1) and ref (0) carry alleleA → no difference
    const result = findBubblePairRecord(bubbles, 0, 1, 1, 0)
    expect(result).toBeUndefined()
  })
})
