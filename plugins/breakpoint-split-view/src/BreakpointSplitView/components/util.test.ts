import { classifyVariantFeatures } from './util.ts'

import type { Feature } from '@jbrowse/core/util'

function fakeFeature(id: string, type: string) {
  return {
    id: () => id,
    get: (k: string) => (k === 'type' ? type : undefined),
  } as unknown as Feature
}

function mapOf(...feats: Feature[]) {
  return new Map(feats.map(f => [f.id(), f] as const))
}

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
