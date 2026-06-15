import { SimpleFeature } from '@jbrowse/core/util'

import { filterChainFeatures } from './executeRenderAlignmentData.ts'

const PROPER_PAIR = 0x2

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

  test('keeps everything when drawProperPairs is true', () => {
    const features = pair('proper', 'F1R2', PROPER_PAIR)
    expect(filterChainFeatures(features, true, true)).toHaveLength(2)
  })
})
