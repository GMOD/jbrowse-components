import { SimpleFeature } from '@jbrowse/core/util'

import {
  isChainGroupableType,
  partitionChains,
  partitionFeatures,
} from './groupFeatures.ts'

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

test('first-of-pair strand groups single-end reads by their own strand', () => {
  // Unpaired reads (no SECOND_IN_PAIR flag) represent the fragment strand
  // directly: a forward single-end read (flags 0) is forward, not flipped.
  const features = [feat('fwd', { flags: 0 }), feat('rev', { flags: 0x10 })]
  const groups = partitionFeatures(features, { type: 'firstOfPairStrand' })
  expect(keys(groups)).toEqual(['+', '-'])
  expect(groups[0]!.features.map(f => f.id())).toEqual(['fwd'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['rev'])
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

test('numeric tag values order by magnitude, not code point', () => {
  // A numeric tag with values past 9 must stack 2 before 10 (not code-point
  // '10' < '2'); untagged still pins last.
  const features = [
    feat('a', { tags: { RG: 10 } }),
    feat('b', { tags: { RG: 2 } }),
    feat('c', {}),
    feat('d', { tags: { RG: 1 } }),
  ]
  const groups = partitionFeatures(features, { type: 'tag', tag: 'RG' })
  expect(keys(groups)).toEqual(['1', '2', '10', ''])
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

test('mapq top decade labels 250-254, not 250-259 (255 is unavailable)', () => {
  const features = [
    feat('a', { score: 252 }),
    feat('b', { score: 30 }),
    feat('c', { score: 255 }),
  ]
  const groups = partitionFeatures(features, { type: 'mapq' })
  const labelFor = (key: string) => groups.find(g => g.key === key)!.label
  expect(labelFor('250')).toBe('MAPQ 250-254')
  expect(labelFor('030')).toBe('MAPQ 30-39')
  expect(labelFor('255')).toBe('MAPQ unavailable')
})

test('duplicate grouping splits on the duplicate flag', () => {
  const features = [feat('a', { flags: 0x400 }), feat('b', { flags: 0 })]
  const groups = partitionFeatures(features, { type: 'duplicate' })
  expect(keys(groups).sort()).toEqual(['duplicate', 'nonduplicate'])
})

test('mate-assembly grouping splits synteny features by mate assembly', () => {
  const features = [
    feat('a', { mate: { assemblyName: 'peach' } }),
    feat('b', { mate: { assemblyName: 'cacao' } }),
    feat('c', { mate: { assemblyName: 'cacao' } }),
  ]
  const groups = partitionFeatures(features, { type: 'mateAssembly' })
  expect(keys(groups)).toEqual(['cacao', 'peach'])
  expect(groups[0]!.label).toBe('cacao')
  expect(groups[0]!.features.map(f => f.id())).toEqual(['b', 'c'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['a'])
})

test('mate-assembly grouping pins features with no mate assembly last', () => {
  const features = [
    feat('a', { mate: { assemblyName: 'peach' } }),
    feat('b', {}),
    feat('c', { mate: {} }),
  ]
  const groups = partitionFeatures(features, { type: 'mateAssembly' })
  expect(keys(groups)).toEqual(['peach', ''])
  expect(groups[1]!.label).toBe('No mate assembly')
  expect(groups[1]!.features.map(f => f.id())).toEqual(['b', 'c'])
})

test('isChainGroupableType allows only chain-consistent dimensions', () => {
  expect(isChainGroupableType('tag')).toBe(true)
  expect(isChainGroupableType('firstOfPairStrand')).toBe(true)
  expect(isChainGroupableType('pairOrientation')).toBe(true)
  expect(isChainGroupableType('mateAssembly')).toBe(true)
  expect(isChainGroupableType('strand')).toBe(false)
  expect(isChainGroupableType('supplementary')).toBe(false)
  expect(isChainGroupableType('mapq')).toBe(false)
  expect(isChainGroupableType('duplicate')).toBe(false)
  expect(isChainGroupableType(undefined)).toBe(false)
})

test('partitionChains ungrouped is a single section holding every read', () => {
  const features = [
    feat('a', { name: 'r1', flags: 0 }),
    feat('b', { name: 'r2', flags: 0 }),
  ]
  const groups = partitionChains(features, undefined)
  expect(groups).toHaveLength(1)
  expect(groups[0]!.key).toBe('')
  expect(groups[0]!.features).toHaveLength(2)
})

test('partitionChains keeps every read of a chain in one group', () => {
  // read1 (HP 1) and its mate read2 carry the same HP tag, but even if a mate
  // lacked the tag the representative read's key decides the whole chain.
  const features = [
    feat('r1a', { name: 'r1', flags: 0x40, tags: { HP: 1 } }),
    feat('r1b', { name: 'r1', flags: 0x80, tags: { HP: 1 } }),
    feat('r2a', { name: 'r2', flags: 0x40, tags: { HP: 2 } }),
    feat('r2b', { name: 'r2', flags: 0x80, tags: { HP: 2 } }),
  ]
  const groups = partitionChains(features, { type: 'tag', tag: 'HP' })
  expect(keys(groups)).toEqual(['1', '2'])
  expect(groups[0]!.features.map(f => f.id())).toEqual(['r1a', 'r1b'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['r2a', 'r2b'])
})

test('partitionChains keys a chain from its read1 representative', () => {
  // The mate (read2, no HP) would key as untagged, but the representative is the
  // primary read1, which carries HP 1 — so the whole chain lands in group '1'.
  const features = [
    feat('mate', { name: 'r1', flags: 0x80 }),
    feat('primary', { name: 'r1', flags: 0x40, tags: { HP: 1 } }),
  ]
  const groups = partitionChains(features, { type: 'tag', tag: 'HP' })
  expect(keys(groups)).toEqual(['1'])
  expect(groups[0]!.features).toHaveLength(2)
})

test('partitionChains ignores supplementary/secondary for the key', () => {
  // The only primary read is read2 (HP 9); the supplementary record (HP absent)
  // must not be picked as representative.
  const features = [
    feat('supp', { name: 'r1', flags: 0x800 }),
    feat('prim', { name: 'r1', flags: 0x80, tags: { HP: 9 } }),
  ]
  const groups = partitionChains(features, { type: 'tag', tag: 'HP' })
  expect(keys(groups)).toEqual(['9'])
})
