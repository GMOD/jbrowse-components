import { SimpleFeature } from '@jbrowse/core/util'

import {
  anyGroupHasSashimi,
  buildChainIdMap,
  buildRawDataByGroup,
  buildReadIdIndexMap,
  orderedGroups,
} from './groupedDataMaps.ts'
import { partitionFeatures } from '../shared/groupFeatures.ts'

import type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from '../RenderAlignmentDataRPC/types.ts'
import type { GroupBy } from '../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

// Minimal PileupDataResult stub: only the fields these scans read.
function data(
  readIds: string[],
  readChainIndices?: number[],
  chainNames?: string[],
): PileupDataResult {
  return {
    readIds,
    readChainIndices: readChainIndices
      ? new Uint32Array(readChainIndices)
      : undefined,
    chainNames,
  } as unknown as PileupDataResult
}

function grouped(
  groups: { key: string; data: PileupDataResult }[],
): GroupedAlignmentsResult {
  return { groups: groups.map(g => ({ ...g, label: g.key })) }
}

test('orderedGroups dedupes group identities across regions, untagged last', () => {
  const order = orderedGroups(
    new Map([
      [
        0,
        grouped([
          { key: '+', data: data(['a']) },
          { key: '-', data: data(['b']) },
        ]),
      ],
      // '-' already seen in region 0; '' is new and must still sort last.
      [
        1,
        grouped([
          { key: '-', data: data(['c']) },
          { key: '', data: data(['d']) },
        ]),
      ],
    ]),
  )
  expect(order).toEqual([
    { key: '+', label: '+' },
    { key: '-', label: '-' },
    { key: '', label: '' },
  ])
})

test('orderedGroups sorts the cross-region union, not by first-seen region', () => {
  // Region 0 has only reverse-strand reads, so '-' is seen first; region 1 adds
  // '+' and untagged. A plain first-seen merge would yield ['-','+',''] — reverse
  // ahead of forward. The merged set must re-sort to ['+','-',''].
  const order = orderedGroups(
    new Map([
      [0, grouped([{ key: '-', data: data(['a']) }])],
      [
        1,
        grouped([
          { key: '+', data: data(['b']) },
          { key: '-', data: data(['c']) },
          { key: '', data: data(['d']) },
        ]),
      ],
    ]),
  )
  expect(order.map(g => g.key)).toEqual(['+', '-', ''])
})

test('orderedGroups keeps untagged last even when it is a region’s only group', () => {
  // The untagged group is the only one in the first region, so first-seen would
  // pin it first; sorting restores it to last.
  const order = orderedGroups(
    new Map([
      [0, grouped([{ key: '', data: data(['a']) }])],
      [
        1,
        grouped([
          { key: 'HP1', data: data(['b']) },
          { key: '', data: data(['c']) },
        ]),
      ],
    ]),
  )
  expect(order.map(g => g.key)).toEqual(['HP1', ''])
})

test('orderedGroups is empty for an empty fetch', () => {
  expect(orderedGroups(new Map())).toEqual([])
})

// Closed-loop cross-region proof: run the *real* worker per-region partition
// (`partitionFeatures`) on each region's reads, feed those results through the
// *real* main-thread merge (`orderedGroups`), and check the composed order.
// The isolated `orderedGroups` tests above hand-build the merged input; these
// remove that assumption by proving the worker actually emits the per-region
// order the merge has to repair — the two halves share `compareGroupKeys`, so a
// group missing from an early region still lands correctly.
function feat(id: string, fields: Record<string, unknown>): Feature {
  return new SimpleFeature({
    id,
    data: { uniqueId: id, refName: 'ctgA', start: 0, end: 100, ...fields },
  })
}

// Worker per-region partition → the RPC's grouped-result shape the merge reads.
function partitionRegion(
  features: Feature[],
  groupBy: GroupBy,
): GroupedAlignmentsResult {
  return {
    groups: partitionFeatures(features, groupBy).map(g => ({
      key: g.key,
      label: g.label,
      data: data(g.features.map(f => f.id())),
    })),
  }
}

test('cross-region strand: reverse-only early region does not stack above forward', () => {
  // Region 0 has only reverse reads, so the worker emits ['-']; region 1 has
  // both and emits ['+','-']. A first-seen merge would leave reverse first.
  const region0 = partitionRegion([feat('a', { flags: 16 })], {
    type: 'strand',
  })
  const region1 = partitionRegion(
    [feat('b', { flags: 0 }), feat('c', { flags: 16 })],
    { type: 'strand' },
  )
  expect(region0.groups.map(g => g.key)).toEqual(['-'])
  expect(region1.groups.map(g => g.key)).toEqual(['+', '-'])
  const order = orderedGroups(
    new Map([
      [0, region0],
      [1, region1],
    ]),
  )
  expect(order.map(g => g.key)).toEqual(['+', '-'])
})

test('cross-region tag: untagged-only early region stays last after merge', () => {
  // Region 0 has only untagged reads (worker emits ['']); region 1 adds HP 1.
  // First-seen would pin '' first; the merge must restore untagged-last.
  const groupBy: GroupBy = { type: 'tag', tag: 'HP' }
  const region0 = partitionRegion([feat('a', {})], groupBy)
  const region1 = partitionRegion(
    [feat('b', { tags: { HP: 1 } }), feat('c', {})],
    groupBy,
  )
  expect(region0.groups.map(g => g.key)).toEqual([''])
  expect(region1.groups.map(g => g.key)).toEqual(['1', ''])
  const order = orderedGroups(
    new Map([
      [0, region0],
      [1, region1],
    ]),
  )
  expect(order.map(g => g.key)).toEqual(['1', ''])
})

test('buildReadIdIndexMap locates each read by region + group + row', () => {
  const map = buildReadIdIndexMap(
    new Map([
      [0, grouped([{ key: '+', data: data(['a', 'b']) }])],
      [1, grouped([{ key: '-', data: data(['c']) }])],
    ]),
  )
  expect(map.get('a')).toEqual({
    displayedRegionIndex: 0,
    groupKey: '+',
    idx: 0,
  })
  expect(map.get('b')).toEqual({
    displayedRegionIndex: 0,
    groupKey: '+',
    idx: 1,
  })
  expect(map.get('c')).toEqual({
    displayedRegionIndex: 1,
    groupKey: '-',
    idx: 0,
  })
  expect(map.get('missing')).toBeUndefined()
})

test('buildRawDataByGroup regroups regions into per-group region maps', () => {
  const a0 = data(['a'])
  const b0 = data(['b'])
  const a1 = data(['c'])
  const byGroup = buildRawDataByGroup(
    new Map([
      [
        0,
        grouped([
          { key: '+', data: a0 },
          { key: '-', data: b0 },
        ]),
      ],
      [1, grouped([{ key: '+', data: a1 }])],
    ]),
  )
  expect([...byGroup.keys()]).toEqual(['+', '-'])
  expect(byGroup.get('+')!.get(0)).toBe(a0)
  expect(byGroup.get('+')!.get(1)).toBe(a1)
  expect(byGroup.get('-')!.get(0)).toBe(b0)
  expect(byGroup.get('-')!.has(1)).toBe(false)
})

test('buildRawDataByGroup keeps the single ungrouped group under key ""', () => {
  const d = data(['a', 'b'])
  const byGroup = buildRawDataByGroup(
    new Map([[0, grouped([{ key: '', data: d }])]]),
  )
  expect([...byGroup.keys()]).toEqual([''])
  expect(byGroup.get('')!.get(0)).toBe(d)
})

test('buildChainIdMap is empty when linked-reads off', () => {
  const m = buildChainIdMap(
    new Map([[0, grouped([{ key: '', data: data(['a'], [0], ['chain0']) }])]]),
    'off',
  )
  expect(m.size).toBe(0)
})

test('buildChainIdMap unions a chain by name across regions', () => {
  // 'chain0' is the local chainIdx-0 in both regions; keying by name unions its
  // reads instead of letting region 1 overwrite region 0.
  const m = buildChainIdMap(
    new Map([
      [0, grouped([{ key: '', data: data(['a', 'b'], [0, 1], ['c0', 'c1']) }])],
      [1, grouped([{ key: '', data: data(['c'], [0], ['c0']) }])],
    ]),
    'normal',
  )
  expect(m.get('c0')).toEqual(['a', 'c'])
  expect(m.get('c1')).toEqual(['b'])
})

test('buildChainIdMap keyed by name never collides across groups', () => {
  // Both groups number their chains from 0, so group '1' and group '2' each have
  // a local chainIdx 0 for *different* chains; keying by name keeps them apart
  // (index keying would merge them).
  const m = buildChainIdMap(
    new Map([
      [
        0,
        grouped([
          { key: '1', data: data(['a', 'b'], [0, 0], ['hp1chain']) },
          { key: '2', data: data(['c', 'd'], [0, 0], ['hp2chain']) },
        ]),
      ],
    ]),
    'normal',
  )
  expect(m.get('hp1chain')).toEqual(['a', 'b'])
  expect(m.get('hp2chain')).toEqual(['c', 'd'])
})

function sashimiData(sashimiCounts: number[]): PileupDataResult {
  return { sashimiCounts } as unknown as PileupDataResult
}

test('anyGroupHasSashimi: true when any group has a junction at/above threshold', () => {
  const m = new Map([
    [
      0,
      grouped([
        { key: '+', data: sashimiData([1, 2]) },
        { key: '-', data: sashimiData([0, 5]) },
      ]),
    ],
  ])
  expect(anyGroupHasSashimi(m, 5)).toBe(true)
  expect(anyGroupHasSashimi(m, 6)).toBe(false)
})

test('anyGroupHasSashimi: false when no group has any junction', () => {
  const m = new Map([[0, grouped([{ key: '', data: sashimiData([]) }])]])
  expect(anyGroupHasSashimi(m, 0)).toBe(false)
})
