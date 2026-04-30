import { findBubblePair } from './bubbleOverlay.ts'

import type { BubbleSite } from './bubbleOverlay.ts'

function biallelicSite(
  cs: string,
  identity: number,
  alleleByGenome: [number, number][],
): BubbleSite {
  return {
    start: 0,
    end: 1,
    alleleByGenome: new Map(alleleByGenome),
    pairs: new Map([['0-1', { cs, identity }]]),
  }
}

describe('findBubblePair', () => {
  it('returns cs as-is when ref carries the lower allele', () => {
    // CS '*ac': allele0 base=a, allele1 base=c. View ref carries allele 0,
    // query carries allele 1 → straight CS.
    const site = biallelicSite('*ac', 0.5, [
      [0, 0], // genome 0 has allele 0 (ref)
      [1, 1], // genome 1 has allele 1 (query)
    ])
    expect(findBubblePair(site, 1, 0)?.cs).toBe('*ac')
  })

  it('flips cs when view ref carries the higher allele', () => {
    // Same CS '*ac' (allele0 base=a, allele1 base=c). View ref carries allele
    // 1 (base c), query carries allele 0 (base a). CS spec: *XY = ref→query,
    // so output should be '*ca'.
    const site = biallelicSite('*ac', 0.8, [
      [0, 1], // ref carries allele 1
      [1, 0], // query carries allele 0
    ])
    const result = findBubblePair(site, 1, 0)
    expect(result?.cs).toBe('*ca')
    expect(result?.identity).toBe(0.8)
  })

  it('flips indel cs when reversed', () => {
    // CS '+acgt' = insertion in allele1 vs allele0. When ref=allele1 and
    // query=allele0, the same edit is a deletion → '-acgt'.
    const site = biallelicSite('+acgt', 0.5, [
      [0, 1],
      [1, 0],
    ])
    expect(findBubblePair(site, 1, 0)?.cs).toBe('-acgt')
  })

  it('returns undefined when query carries same allele as ref', () => {
    const site = biallelicSite('*ac', 1, [
      [0, 0],
      [1, 0], // query also has allele 0
    ])
    expect(findBubblePair(site, 1, 0)).toBeUndefined()
  })
})
