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
): PileupDataResult {
  return {
    readIds,
    readChainIndices: readChainIndices
      ? new Uint32Array(readChainIndices)
      : undefined,
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
    new Map([[0, grouped([{ key: '', data: data(['a'], [0]) }])]]),
    'off',
  )
  expect(m.size).toBe(0)
})

test('buildChainIdMap groups read ids by chain index across regions', () => {
  const m = buildChainIdMap(
    new Map([
      [0, grouped([{ key: '', data: data(['a', 'b'], [0, 1]) }])],
      [1, grouped([{ key: '', data: data(['c'], [0]) }])],
    ]),
    'normal',
  )
  expect(m.get(0)).toEqual(['a', 'c'])
  expect(m.get(1)).toEqual(['b'])
})
