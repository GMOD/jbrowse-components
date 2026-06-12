import { SimpleFeature } from '@jbrowse/core/util'

import { partitionFeatures } from './groupFeatures.ts'

import type { Feature } from '@jbrowse/core/util'

function feat(uniqueId: string, fields: Record<string, unknown>): Feature {
  return new SimpleFeature({
    id: uniqueId,
    data: { uniqueId, refName: 'ctgA', start: 0, end: 100, ...fields },
  })
}

function keys(groups: { key: string }[]) {
  return groups.map(g => g.key)
}

test('ungrouped is a single section holding every read', () => {
  const features = [feat('a', { flags: 0 }), feat('b', { flags: 16 })]
  const groups = partitionFeatures(features, undefined)
  expect(groups).toHaveLength(1)
  expect(groups[0]!.key).toBe('')
  expect(groups[0]!.features).toHaveLength(2)
})

test('strand grouping splits forward/reverse by the reverse flag', () => {
  const features = [
    feat('a', { flags: 0 }),
    feat('b', { flags: 16 }),
    feat('c', { flags: 0 }),
  ]
  const groups = partitionFeatures(features, { type: 'strand' })
  expect(keys(groups)).toEqual(['+', '-'])
  expect(groups[0]!.features.map(f => f.id())).toEqual(['a', 'c'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['b'])
})

test('first-of-pair strand groups both mates of a pair together', () => {
  // read1 forward (flags 0x40) and read2 reverse (flags 0x10|0x80) are the two
  // mates of one forward-strand fragment, so they share the '+' group.
  const features = [
    feat('r1', { flags: 0x40 }),
    feat('r2', { flags: 0x10 | 0x80 }),
  ]
  const groups = partitionFeatures(features, { type: 'firstOfPairStrand' })
  expect(keys(groups)).toEqual(['+'])
  expect(groups[0]!.features).toHaveLength(2)
})

test('tag grouping sorts values and pins untagged reads last', () => {
  const features = [
    feat('a', { tags: { HP: 2 } }),
    feat('b', {}),
    feat('c', { tags: { HP: 1 } }),
    feat('d', { tags: { HP: 1 } }),
  ]
  const groups = partitionFeatures(features, { type: 'tag', tag: 'HP' })
  expect(keys(groups)).toEqual(['1', '2', ''])
  expect(groups[2]!.label).toBe('HP: none')
  expect(groups[0]!.features.map(f => f.id())).toEqual(['c', 'd'])
})

test('mapq buckets sort numerically via zero-padded keys', () => {
  const features = [
    feat('a', { score: 60 }),
    feat('b', { score: 5 }),
    feat('c', { score: 255 }),
  ]
  const groups = partitionFeatures(features, { type: 'mapq' })
  expect(keys(groups)).toEqual(['000', '060', '255'])
})

test('duplicate grouping splits on the duplicate flag', () => {
  const features = [feat('a', { flags: 0x400 }), feat('b', { flags: 0 })]
  const groups = partitionFeatures(features, { type: 'duplicate' })
  expect(keys(groups).sort()).toEqual(['duplicate', 'nonduplicate'])
})
