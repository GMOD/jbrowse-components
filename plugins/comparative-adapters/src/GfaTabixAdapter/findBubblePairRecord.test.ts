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

  it('flips cs when view ref carries the higher-numbered allele', () => {
    // Record stored as (0, 1) with CS '*ac' meaning allele0 base=a, allele1 base=c.
    // View ref carries allele 1, query carries allele 0.
    // CS spec: *XY means ref=X, query=Y. Since view ref has allele1 (base c)
    // and query has allele0 (base a), the returned CS should be '*ca'.
    const bubbles: BubbleEntry[] = [
      {
        alleleA: 0,
        alleleB: 1,
        identity: 0.8,
        cs: '*ac',
        genomesA: new Set([1]),
        genomesB: new Set([0]),
      },
    ]
    // gIdx=1 carries allele 0, refGenomeIdx=0 carries allele 1
    const result = findBubblePairRecord(bubbles, 0, 1, 1, 0)
    expect(result?.cs).toBe('*ca')
    expect(result?.identity).toBe(0.8)
  })

  it('flips indel cs when reversed', () => {
    // CS '+acgt' means insertion of 'acgt' in query relative to ref (allele0→allele1).
    // When view ref is allele1 and query is allele0, it flips to '-acgt'
    // (deletion in query relative to ref).
    const bubbles: BubbleEntry[] = [
      {
        alleleA: 0,
        alleleB: 1,
        identity: 0.5,
        cs: '+acgt',
        genomesA: new Set([1]),
        genomesB: new Set([0]),
      },
    ]
    const result = findBubblePairRecord(bubbles, 0, 1, 1, 0)
    expect(result?.cs).toBe('-acgt')
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
