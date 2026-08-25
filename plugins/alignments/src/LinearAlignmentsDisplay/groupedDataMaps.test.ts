import { SimpleFeature } from '@jbrowse/core/util'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  OVERFLOW_GROUP_KEY,
  overflowLabel,
  partitionFeatures,
} from '../shared/groupFeatures.ts'
import {
  buildSashimiDownKeys,
  buildReadIdsByChainName,
  buildRawDataByGroup,
  buildReadIdIndexMap,
  hasNamedGroups,
  orderedGroups,
} from './groupedDataMaps.ts'

import type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from '../RenderAlignmentDataRPC/types.ts'
import type { GroupBy } from '../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

// Minimal PileupDataResult stub: only the fields these scans read.
function data(
  readKeys: string[],
  readChainIndices?: number[],
  chainNames?: string[],
): PileupDataResult {
  return makePileupDataResult({
    readKeys,
    readChainIndices: readChainIndices
      ? new Uint32Array(readChainIndices)
      : undefined,
    chainNames,
  })
}

function grouped(
  groups: {
    key: string
    data: PileupDataResult
    label?: string
    mergedKeys?: string[]
  }[],
): GroupedAlignmentsResult {
  return { groups: groups.map(g => ({ label: g.key, ...g })) }
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

// `MAX_GROUPS` is enforced per worker call and one call sees one region, so each
// region merges its own tail and no one of them knows what the DRAWN lane holds.
// First-seen-wins took region 0's label — "2 merged values" over a lane holding
// four distinct ones, since region 1 merged an overlapping but larger set.
test('orderedGroups counts the overflow lane over the cross-region union', () => {
  const order = orderedGroups(
    new Map([
      [
        0,
        grouped([
          { key: 'v1', data: data(['a']) },
          {
            key: OVERFLOW_GROUP_KEY,
            data: data(['b']),
            label: overflowLabel(2),
            mergedKeys: ['v8', 'v9'],
          },
        ]),
      ],
      [
        1,
        grouped([
          { key: 'v1', data: data(['c']) },
          {
            key: OVERFLOW_GROUP_KEY,
            data: data(['d']),
            label: overflowLabel(3),
            mergedKeys: ['v9', 'v10', 'v11'],
          },
        ]),
      ],
    ]),
  )
  expect(order.map(g => g.key)).toEqual(['v1', OVERFLOW_GROUP_KEY])
  // v8, v9, v10, v11 — the union, not either region's own count
  expect(order.at(-1)!.label).toBe(overflowLabel(4))
})

// Nothing to relabel when the cap never fired, and the union must not invent a
// lane out of an absent one.
test('orderedGroups leaves an uncapped fetch alone', () => {
  const order = orderedGroups(
    new Map([[0, grouped([{ key: 'v1', data: data(['a']) }])]]),
  )
  expect(order).toEqual([{ key: 'v1', label: 'v1' }])
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

// `groupOrder` IS the filtered order, so the drop belongs here rather than in a
// `.filter` at the one call site — the same rule the other regroupers in this
// file apply to their own walks.
test('orderedGroups drops a hidden lane', () => {
  const rpcDataMap = new Map([
    [
      0,
      grouped([
        { key: '+', data: data(['a']) },
        { key: '-', data: data(['b']) },
      ]),
    ],
  ])
  expect(orderedGroups(rpcDataMap, new Set(['-']))).toEqual([
    { key: '+', label: '+' },
  ])
  expect(orderedGroups(rpcDataMap)).toHaveLength(2)
})

// The labels gate reads the sections the worker actually emitted, because the
// `groupBy` setting can be set while the fetch is ungrouped.
test('hasNamedGroups is false for an ungrouped or degraded fetch', () => {
  // ungrouped: the worker's singleSection, keyed '' with no label
  expect(hasNamedGroups([{ key: '', label: '' }])).toBe(false)
  // chain mode + a per-read dimension: groupBy stays set, but groupByForMode
  // degrades the partition to that same unnamed single section
  expect(hasNamedGroups([])).toBe(false)
})

test('hasNamedGroups is true whenever a section carries a name', () => {
  expect(hasNamedGroups([{ key: '+', label: 'Forward strand' }])).toBe(true)
  // a catch-all bucket is still a named section — every dimension names its own
  expect(hasNamedGroups([{ key: '', label: 'HP: none' }])).toBe(true)
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
  const region0 = partitionRegion([feat('a', { flags: 16, strand: -1 })], {
    type: 'strand',
  })
  const region1 = partitionRegion(
    [feat('b', { flags: 0, strand: 1 }), feat('c', { flags: 16, strand: -1 })],
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

// A hidden lane's entries were unreachable anyway — `findFeatureInRpcData`
// resolves them through `laidOutByGroup`, which is built from the filtered
// `groupOrder` — and each one spelled a `readIdAt` string to get there.
test('buildReadIdIndexMap drops the reads of a hidden lane', () => {
  const map = buildReadIdIndexMap(
    new Map([
      [
        0,
        grouped([
          { key: 'peach', data: data(['a']) },
          { key: 'self', data: data(['b']) },
        ]),
      ],
    ]),
    new Set(['self']),
  )
  expect(map.get('a')?.groupKey).toBe('peach')
  expect(map.get('b')).toBeUndefined()
})

// This map is what `findFeatureInRpcData` resolves a hover or a click through,
// so it is keyed by the id STRING even though the result ships numeric keys —
// `featureIdUnderMouse` is a string, and MST saves and restores it. Deferred
// until something is hovered, which is what keeps the build off a cold render.
test('buildReadIdIndexMap spells numeric keys back into ids', () => {
  const map = buildReadIdIndexMap(
    new Map([
      [
        0,
        grouped([
          {
            key: '+',
            data: makePileupDataResult({
              readKeys: new Float64Array([4096, 8192]),
              readIdPrefix: 'J9v2mQ1xKp-',
            }),
          },
        ]),
      ],
    ]),
  )
  expect(map.get('J9v2mQ1xKp-4096')).toEqual({
    displayedRegionIndex: 0,
    groupKey: '+',
    idx: 0,
  })
  expect(map.get('J9v2mQ1xKp-8192')?.idx).toBe(1)
  expect(map.get('4096')).toBeUndefined()
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

// The source-level filter every cross-group walk of this map then inherits —
// the arc scale pooling and the derivative-path chain scan alike, neither of
// which re-applies `hiddenGroupKeys` on its own.
test('buildRawDataByGroup drops hidden group keys entirely', () => {
  const shown = data(['a'])
  const hidden = data(['b'])
  const byGroup = buildRawDataByGroup(
    new Map([
      [
        0,
        grouped([
          { key: '+', data: shown },
          { key: '-', data: hidden },
        ]),
      ],
    ]),
    new Set(['-']),
  )
  expect([...byGroup.keys()]).toEqual(['+'])
  expect(byGroup.has('-')).toBe(false)
})

test('buildRawDataByGroup keeps every group when nothing is hidden', () => {
  const byGroup = buildRawDataByGroup(
    new Map([
      [
        0,
        grouped([
          { key: '+', data: data(['a']) },
          { key: '-', data: data(['b']) },
        ]),
      ],
    ]),
    new Set<string>(),
  )
  expect([...byGroup.keys()]).toEqual(['+', '-'])
})

test('buildRawDataByGroup keeps the single ungrouped group under key ""', () => {
  const d = data(['a', 'b'])
  const byGroup = buildRawDataByGroup(
    new Map([[0, grouped([{ key: '', data: d }])]]),
  )
  expect([...byGroup.keys()]).toEqual([''])
  expect(byGroup.get('')!.get(0)).toBe(d)
})

test('buildReadIdsByChainName is empty when linked-reads off', () => {
  const m = buildReadIdsByChainName(
    new Map([[0, grouped([{ key: '', data: data(['a'], [0], ['chain0']) }])]]),
    false,
  )
  expect(m.size).toBe(0)
})

test('buildReadIdsByChainName unions a chain by name across regions', () => {
  // 'chain0' is the local chainIdx-0 in both regions; keying by name unions its
  // reads instead of letting region 1 overwrite region 0.
  const m = buildReadIdsByChainName(
    new Map([
      [0, grouped([{ key: '', data: data(['a', 'b'], [0, 1], ['c0', 'c1']) }])],
      [1, grouped([{ key: '', data: data(['c'], [0], ['c0']) }])],
    ]),
    true,
  )
  expect(m.get('c0')).toEqual(['a', 'c'])
  expect(m.get('c1')).toEqual(['b'])
})

test('buildReadIdsByChainName keyed by name never collides across groups', () => {
  // Both groups number their chains from 0, so group '1' and group '2' each have
  // a local chainIdx 0 for *different* chains; keying by name keeps them apart
  // (index keying would merge them).
  const m = buildReadIdsByChainName(
    new Map([
      [
        0,
        grouped([
          { key: '1', data: data(['a', 'b'], [0, 0], ['hp1chain']) },
          { key: '2', data: data(['c', 'd'], [0, 0], ['hp2chain']) },
        ]),
      ],
    ]),
    true,
  )
  expect(m.get('hp1chain')).toEqual(['a', 'b'])
  expect(m.get('hp2chain')).toEqual(['c', 'd'])
})

// The read ids here are resolved through `readIdIndexMap`, which drops the same
// lanes, so a hidden lane's chain could only ever have highlighted nothing.
test('buildReadIdsByChainName drops the chains of a hidden lane', () => {
  const m = buildReadIdsByChainName(
    new Map([
      [
        0,
        grouped([
          { key: 'peach', data: data(['a'], [0], ['peachchain']) },
          { key: 'self', data: data(['b'], [0], ['selfchain']) },
        ]),
      ],
    ]),
    true,
    new Set(['self']),
  )
  expect([...m.keys()]).toEqual(['peachchain'])
})

// [start, end, count] per junction.
function junctionData(junctions: [number, number, number][]): PileupDataResult {
  return makePileupDataResult({
    sashimiX1: new Uint32Array(junctions.map(j => j[0])),
    sashimiX2: new Uint32Array(junctions.map(j => j[1])),
    sashimiCounts: new Uint32Array(junctions.map(j => j[2])),
    sashimiStrands: new Int8Array(junctions.length),
    sashimiMotifs: new Uint8Array(junctions.length),
  })
}

// Two interleaving junctions, the second thinly supported.
const crossing: [number, number, number][] = [
  [100, 500, 20],
  [300, 700, 2],
]

// Every region of these fixtures is on one chromosome; the per-refName partition
// itself is covered in features/sashimi/junctions.test.ts.
function downKeys(
  rpcDataMap: Parameters<typeof buildSashimiDownKeys>[0],
  minSashimiScore: number,
  mode: 'up' | 'down' | 'auto',
) {
  return buildSashimiDownKeys(rpcDataMap, {
    minSashimiScore,
    hideNonCanonicalJunctions: false,
    mode,
    refNameFor: () => 'chr1',
  })
}

// The lanes the strip is reserved for: the keys whose set is non-empty, which is
// how `model.sashimiDownArcLanes` reads this for `belowCoverageBandsInput`.
function lanes(...args: Parameters<typeof downKeys>) {
  return [...downKeys(...args)]
    .filter(([, down]) => down.size > 0)
    .map(([key]) => key)
}

test('auto reserves the strip only while a crossing pair survives the score filter', () => {
  const m = new Map([[0, grouped([{ key: '', data: junctionData(crossing) }])]])
  expect(lanes(m, 0, 'auto')).toEqual([''])
  // filtering the 2-read junction leaves nothing to cross => nothing goes down
  expect(lanes(m, 5, 'auto')).toEqual([])
})

test('auto ignores nested + disjoint junctions', () => {
  const m = new Map([
    [
      0,
      grouped([
        {
          key: '',
          data: junctionData([
            [100, 700, 9], // nests the next two
            [200, 400, 9],
            [100, 200, 9], // shares a donor => nested, not crossing
            [800, 900, 9], // disjoint
          ]),
        },
      ]),
    ],
  ])
  expect(lanes(m, 0, 'auto')).toEqual([])
})

test('auto pools a group across regions, but not across groups', () => {
  const split = new Map([
    [0, grouped([{ key: '+', data: junctionData([crossing[0]!]) }])],
    [1, grouped([{ key: '+', data: junctionData([crossing[1]!]) }])],
  ])
  expect(lanes(split, 0, 'auto')).toEqual(['+'])
  // same two junctions, but each group assigns sides alone => neither crosses
  const perGroup = new Map([
    [
      0,
      grouped([
        { key: '+', data: junctionData([crossing[0]!]) },
        { key: '-', data: junctionData([crossing[1]!]) },
      ]),
    ],
  ])
  expect(lanes(perGroup, 0, 'auto')).toEqual([])
})

// A lane with no junction must be named as not needing the
// strip, so `computeStackedSections` can drop it rather than leaving dead space.
test('buildSashimiDownKeys: names only the lanes needing the strip', () => {
  const m = new Map([
    [
      0,
      grouped([
        { key: 'has', data: junctionData([[100, 700, 3]]) },
        { key: 'none', data: junctionData([]) },
        { key: 'filtered', data: junctionData([[200, 400, 1]]) },
      ]),
    ],
  ])
  expect(lanes(m, 2, 'down')).toEqual(['has'])
  expect(lanes(m, 0, 'down')).toEqual(['has', 'filtered'])
  expect(lanes(m, 0, 'up')).toEqual([])
})

test('buildSashimiDownKeys: auto names only the lane whose junctions cross', () => {
  const m = new Map([
    [
      0,
      grouped([
        { key: 'crossing', data: junctionData(crossing) },
        {
          key: 'nested',
          data: junctionData([
            [100, 700, 9],
            [200, 400, 9],
          ]),
        },
      ]),
    ],
  ])
  expect(lanes(m, 0, 'auto')).toEqual(['crossing'])
})

test('buildSashimiDownKeys: the keys name the junctions the overlay will look up', () => {
  // The set is the whole sashimi side decision — the layout reserves off its
  // size and `computeSashimiArcs` places each arc off its membership, so a lane
  // has to name WHICH junction goes down, not just that one does.
  const m = new Map([[0, grouped([{ key: '', data: junctionData(crossing) }])]])
  expect([...downKeys(m, 0, 'auto').get('')!]).toEqual(['chr1:300:700'])
})

test('buildSashimiDownKeys: a hidden lane is never named', () => {
  const m = new Map([
    [
      0,
      grouped([
        { key: 'shown', data: junctionData([[100, 700, 3]]) },
        { key: 'self', data: junctionData(crossing) },
      ]),
    ],
  ])
  const keys = buildSashimiDownKeys(m, {
    minSashimiScore: 0,
    hideNonCanonicalJunctions: false,
    mode: 'down',
    refNameFor: () => 'chr1',
    hidden: new Set(['self']),
  })
  expect([...keys.keys()]).toEqual(['shown'])
})
