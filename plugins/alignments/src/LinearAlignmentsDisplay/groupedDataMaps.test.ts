import {
  buildChainIdMap,
  buildRawDataByGroup,
  buildReadIdIndexMap,
  orderedGroups,
} from './groupedDataMaps.ts'

import type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from '../RenderAlignmentDataRPC/types.ts'

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

test('orderedGroups dedupes group identities in first-seen order across regions', () => {
  const order = orderedGroups(
    new Map([
      [
        0,
        grouped([
          { key: '+', data: data(['a']) },
          { key: '-', data: data(['b']) },
        ]),
      ],
      // '-' already seen in region 0; '' is new and keeps its first-seen slot.
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

test('orderedGroups is empty for an empty fetch', () => {
  expect(orderedGroups(new Map())).toEqual([])
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
