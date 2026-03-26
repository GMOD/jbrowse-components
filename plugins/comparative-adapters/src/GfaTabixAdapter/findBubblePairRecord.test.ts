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

// The CS tag format (minimap2 spec): *XY means ref base = X, query base = Y.
// Bubble records store CS in alleleA→alleleB direction, so X=alleleA base, Y=alleleB base.
// When the reference carries alleleB (reversed case), the CS must be flipped so that
// X becomes the ref base and Y becomes the query base.

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

  it('returns flipped cs when alleleB is the reference allele', () => {
    // alleleA=1 (query), alleleB=0 (ref): genome 1 → query, genome 0 → ref
    // CS '*ca': stored as alleleA→alleleB = query→ref direction
    // X='c' is the query base, Y='a' is the ref base — must flip to '*ac'
    // so that X='a' (ref) and Y='c' (query) per the CS spec
    const bubbles: BubbleEntry[] = [
      {
        alleleA: 1,
        alleleB: 0,
        identity: 0.5,
        cs: '*ca',
        genomesA: new Set([1]),
        genomesB: new Set([0]),
      },
    ]
    const result = findBubblePairRecord(bubbles, 0, 1, 1, 0)
    // Without the flip fix, this would incorrectly return cs='*ca'
    expect(result?.cs).toBe('*ac')
  })

  it('returns flipped cs for indels in reversed orientation', () => {
    // alleleA=1 (query), alleleB=0 (ref)
    // CS '+acgt': stored as alleleA→alleleB = insertion in query relative to ref
    // But alleleA is actually the query here, so +acgt is correct... wait:
    // In CS, +seq means inserted in query relative to ref.
    // alleleA→alleleB direction: alleleA is ref, alleleB is query.
    // If alleleA=1 (query genome) and alleleB=0 (ref genome):
    // the stored CS has alleleA=query as "ref" → +seq means inserted in alleleB (the actual ref) → should be -seq
    const bubbles: BubbleEntry[] = [
      {
        alleleA: 1,
        alleleB: 0,
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
