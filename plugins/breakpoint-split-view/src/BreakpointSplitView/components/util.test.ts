import {
  classifyVariantFeatures,
  getMatchedBreakendFeatures,
} from './util.ts'

import type { Feature } from '@jbrowse/core/util'

function fakeFeature(id: string, type: string) {
  return {
    id: () => id,
    get: (k: string) => (k === 'type' ? type : undefined),
  } as unknown as Feature
}

// BND features carry refName, start (0-based), and ALT with a breakend string
// parseable by @gmod/vcf's parseBreakend, e.g. "N]chr2:200]"
function fakeBnd(
  id: string,
  refName: string,
  start: number,
  mateRef: string,
  matePos1Based: number,
) {
  const fields: Record<string, unknown> = {
    type: 'breakend',
    refName,
    start,
    ALT: [`N]${mateRef}:${matePos1Based}]`],
  }
  return {
    id: () => id,
    get: (k: string) => fields[k],
  } as unknown as Feature
}

function mapOf(...feats: Feature[]) {
  return new Map(feats.map(f => [f.id(), f] as const))
}

describe('getMatchedBreakendFeatures', () => {
  // A at chr1:100 (0-based) = position 101 (1-based) pointing to chr2:200
  // B at chr2:199 (0-based) = position 200 (1-based) pointing to chr1:101
  const A = fakeBnd('a', 'chr1', 100, 'chr2', 200)
  const B = fakeBnd('b', 'chr2', 199, 'chr1', 101)

  test('pairs two mutually-referencing BND features', () => {
    const result = getMatchedBreakendFeatures(mapOf(A, B))
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(2)
  })

  test('result is the same regardless of iteration order', () => {
    expect(getMatchedBreakendFeatures(mapOf(A, B))).toHaveLength(1)
    expect(getMatchedBreakendFeatures(mapOf(B, A))).toHaveLength(1)
  })

  test('unpaired BND produces no matches', () => {
    expect(getMatchedBreakendFeatures(mapOf(A))).toHaveLength(0)
  })

  test('two independent BND pairs produce two groups', () => {
    const C = fakeBnd('c', 'chr3', 0, 'chr4', 500)
    const D = fakeBnd('d', 'chr4', 499, 'chr3', 1)
    const result = getMatchedBreakendFeatures(mapOf(A, B, C, D))
    expect(result).toHaveLength(2)
  })

  test('two BNDs sharing the same MatePosition are not incorrectly merged', () => {
    // E and F both point to chr2:200, but are not mates of each other
    const E = fakeBnd('e', 'chr5', 0, 'chr2', 200)
    const F = fakeBnd('f', 'chr6', 0, 'chr2', 200)
    // B is the real mate of A; E and F are orphans pointing to the same spot
    const result = getMatchedBreakendFeatures(mapOf(A, B, E, F))
    // only the real A-B pair should match; E and F land in different buckets
    expect(result).toHaveLength(1)
  })
})

describe('classifyVariantFeatures', () => {
  test('translocation wins over paired_feature and breakend', () => {
    expect(
      classifyVariantFeatures(
        mapOf(
          fakeFeature('a', 'paired_feature'),
          fakeFeature('b', 'translocation'),
          fakeFeature('c', 'breakend'),
        ),
      ),
    ).toBe('translocation')
  })

  test('paired wins over breakend', () => {
    expect(
      classifyVariantFeatures(
        mapOf(
          fakeFeature('a', 'breakend'),
          fakeFeature('b', 'paired_feature'),
        ),
      ),
    ).toBe('paired')
  })

  test('defaults to breakend', () => {
    expect(
      classifyVariantFeatures(mapOf(fakeFeature('a', 'breakend'))),
    ).toBe('breakend')
  })

  test('empty defaults to breakend', () => {
    expect(classifyVariantFeatures(new Map())).toBe('breakend')
  })
})
