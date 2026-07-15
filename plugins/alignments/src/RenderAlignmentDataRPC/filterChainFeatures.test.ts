import { SimpleFeature } from '@jbrowse/core/util'

import { filterChainFeatures } from './executeRenderAlignmentData.ts'

const PROPER_PAIR = 0x2
const SUPPLEMENTARY = 0x800

// A two-read chain sharing one QNAME with the given orientation/flags.
function pair(name: string, orientation: string, flags: number) {
  return [
    new SimpleFeature({
      uniqueId: `${name}-1`,
      refName: 'ctgA',
      start: 0,
      end: 100,
      name,
      flags,
      pair_orientation: orientation,
    }),
    new SimpleFeature({
      uniqueId: `${name}-2`,
      refName: 'ctgA',
      start: 300,
      end: 400,
      name,
      flags,
      pair_orientation: orientation,
    }),
  ]
}

function names(features: { get: (k: string) => unknown }[]) {
  return [...new Set(features.map(f => f.get('name') as string))].sort()
}

describe('filterChainFeatures drawProperPairs=false', () => {
  test('hides concordant FR proper pairs', () => {
    const features = pair('proper', 'F1R2', PROPER_PAIR)
    expect(filterChainFeatures(features, true, false)).toHaveLength(0)
  })

  test('keeps discordant RR/LL/RL pairs even when flagged proper', () => {
    const features = [
      ...pair('rr', 'F1F2', PROPER_PAIR),
      ...pair('ll', 'R1R2', PROPER_PAIR),
      ...pair('rl', 'R1F2', PROPER_PAIR),
      ...pair('proper', 'F1R2', PROPER_PAIR),
    ]
    expect(names(filterChainFeatures(features, true, false))).toEqual([
      'll',
      'rl',
      'rr',
    ])
  })

  test('keeps pairs missing the proper-pair flag', () => {
    const features = pair('noflag', 'F1R2', 0)
    expect(names(filterChainFeatures(features, true, false))).toEqual([
      'noflag',
    ])
  })

  test('keeps proper pairs carrying a supplementary (chimeric) segment', () => {
    // BWA-MEM propagates the 0x2 flag onto supplementary records, so a proper
    // FR pair with a split segment is genuine SV evidence that must stay visible
    const chain = [
      ...pair('chimeric', 'F1R2', PROPER_PAIR),
      new SimpleFeature({
        uniqueId: 'chimeric-supp',
        refName: 'ctgA',
        start: 5000,
        end: 5100,
        name: 'chimeric',
        flags: PROPER_PAIR | SUPPLEMENTARY,
        pair_orientation: 'F1R2',
      }),
    ]
    expect(names(filterChainFeatures(chain, true, false))).toEqual(['chimeric'])
  })

  test('keeps everything when drawProperPairs is true', () => {
    const features = pair('proper', 'F1R2', PROPER_PAIR)
    expect(filterChainFeatures(features, true, true)).toHaveLength(2)
  })
})

describe('filterChainFeatures showOnlySplitAlignments=true', () => {
  test('hides chains with no supplementary segment', () => {
    const features = pair('plain', 'F1R2', 0)
    expect(filterChainFeatures(features, true, true, true)).toHaveLength(0)
  })

  test('keeps chains containing a supplementary segment', () => {
    const chain = [
      ...pair('chimeric', 'F1R2', PROPER_PAIR),
      new SimpleFeature({
        uniqueId: 'chimeric-supp',
        refName: 'ctgA',
        start: 5000,
        end: 5100,
        name: 'chimeric',
        flags: SUPPLEMENTARY,
        pair_orientation: 'F1R2',
      }),
    ]
    expect(names(filterChainFeatures(chain, true, true, true))).toEqual([
      'chimeric',
    ])
  })

  test('keeps everything when showOnlySplitAlignments is false', () => {
    const features = pair('plain', 'F1R2', 0)
    expect(filterChainFeatures(features, true, true, false)).toHaveLength(2)
  })
})

describe('filterChainFeatures dedup guard', () => {
  test('collapses records sharing an id (duplicate index-chunk emit)', () => {
    const [a, b] = pair('dup', 'F1R2', 0)
    // b reuses a's uniqueId → same id(); guard must drop the second
    const dup = new SimpleFeature({ ...b!.toJSON(), uniqueId: a!.id() })
    const out = filterChainFeatures([a!, dup], true, true)
    expect(out).toHaveLength(1)
  })

  test('returns the input array unchanged when there are no duplicates', () => {
    const features = pair('uniq', 'F1R2', 0)
    // no-dup fast path: same reference back, no copy
    expect(filterChainFeatures(features, true, true)).toBe(features)
  })
})
