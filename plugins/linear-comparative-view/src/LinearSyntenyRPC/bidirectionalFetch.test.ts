import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import { executeSyntenyFeaturesAndPositions } from './executeSyntenyFeaturesAndPositions.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

// A synteny band asks its adapter about the QUERY row. An alignment anchored on
// a target-row contig whose other end is somewhere the query row is not showing
// is therefore never requested, and no bookkeeping downstream can recover one —
// which made the view's answer depend on which genome the user stacked on top.
// `targetView.fetchRegions` is the view asking for the second query.
//
// The two fetches are kept apart by WHERE THE QUERY END LANDS, not by joining
// them on a shared id: PIF and all-vs-all give one record's two rows unrelated
// ids on purpose, and a join that silently mismatches draws a ribbon twice.

const QUERY_ASM = 'query'
const TARGET_ASM = 'target'

function region(assemblyName: string, refName: string, end = 10000): Region {
  return { assemblyName, refName, start: 0, end }
}

const queryView = {
  bpPerPx: 1,
  offsetPx: 0,
  width: 800,
  displayedRegions: [region(QUERY_ASM, 'q1')],
  fetchRegions: [region(QUERY_ASM, 'q1')],
}

const targetView = {
  bpPerPx: 1,
  offsetPx: 0,
  displayedRegions: [region(TARGET_ASM, 't1')],
  windowRegions: [region(TARGET_ASM, 't1')],
}

// Anchored on `refName`, mate on `mateRefName`, in whichever perspective the
// caller asked about — which is what every pairwise adapter returns for a
// region query (`PairwiseAdapterBase.facingSides` picks the side, and the row is
// oriented to it).
function alignment({
  id,
  refName,
  start,
  mateRefName,
  mateStart,
}: {
  id: string
  refName: string
  start: number
  mateRefName: string
  mateStart: number
}): Feature {
  return new SimpleFeature({
    uniqueId: id,
    refName,
    start,
    end: start + 100,
    strand: 1,
    mate: {
      refName: mateRefName,
      start: mateStart,
      end: mateStart + 100,
      assemblyName: refName.startsWith('q') ? TARGET_ASM : QUERY_ASM,
    },
  })
}

// Dispatches on the assembly the regions name, which is exactly what the
// adapter does — so a test feature only ever arrives through the fetch that
// would really have produced it.
function run({
  fromQuery = [],
  fromTarget = [],
  targetFetchRegions,
  queryDisplayed,
  queryFetched,
  targetDisplayed,
}: {
  fromQuery?: Feature[]
  fromTarget?: Feature[]
  targetFetchRegions?: Region[]
  // wider than what the query row FETCHED, which is the only place the ribbon
  // class can be: displayed up there, outside the window asked for
  queryDisplayed?: Region[]
  queryFetched?: Region[]
  targetDisplayed?: Region[]
}) {
  const calls: Region[][] = []
  const getFeaturesInMultipleRegionsArray = jest.fn(
    async (regions: Region[]) => {
      calls.push(regions)
      return regions[0]?.assemblyName === QUERY_ASM ? fromQuery : fromTarget
    },
  )
  jest
    .mocked(getFeatureAdapterOrThrow)
    .mockResolvedValue({ getFeaturesInMultipleRegionsArray } as never)
  return {
    calls,
    result: executeSyntenyFeaturesAndPositions({
      pluginManager: {} as PluginManager,
      sessionId: 't1',
      adapterConfig: { type: 'PAFAdapter' },
      queryView: {
        ...queryView,
        displayedRegions: queryDisplayed ?? queryView.displayedRegions,
        fetchRegions: queryFetched ?? queryView.fetchRegions,
      },
      targetView: {
        ...targetView,
        displayedRegions: targetDisplayed ?? targetView.displayedRegions,
        windowRegions: targetDisplayed ?? targetView.windowRegions,
        fetchRegions: targetFetchRegions,
      },
    }),
  }
}

test('without the second fetch the adapter is asked once, about the query row', async () => {
  const { calls, result } = run({
    fromQuery: [
      alignment({
        id: 'a',
        refName: 'q1',
        start: 100,
        mateRefName: 't1',
        mateStart: 100,
      }),
    ],
  })
  const { value } = await result

  expect(calls).toEqual([[region(QUERY_ASM, 'q1')]])
  expect(value.targetOffscreenMates.mateRefNameDict).toEqual([])
})

test('the second fetch asks about the target row, and only when asked', async () => {
  const { calls, result } = run({
    targetFetchRegions: [region(TARGET_ASM, 't1')],
  })
  await result

  expect(calls).toEqual([[region(QUERY_ASM, 'q1')], [region(TARGET_ASM, 't1')]])
})

// The class the query-axis fetch cannot see: anchored on a contig the target row
// IS showing, with its query end on a contig the row above is not.
test('an alignment anchored on the target row is counted against the query contig it names', async () => {
  const { result } = run({
    targetFetchRegions: [region(TARGET_ASM, 't1')],
    fromTarget: [
      alignment({
        id: 'b',
        refName: 't1',
        start: 500,
        mateRefName: 'q9',
        mateStart: 0,
      }),
    ],
  })
  const { targetOffscreenMates } = (await result).value

  expect(targetOffscreenMates.mateRefNameDict).toEqual(['q9'])
  expect([...targetOffscreenMates.counts]).toEqual([1])
  // placed on the TARGET axis, which is the only axis it has
  expect([...targetOffscreenMates.starts]).toEqual([500])
  expect([...targetOffscreenMates.ends]).toEqual([600])
})

// THE DISJOINTNESS PREDICATE, and the reason no join key is needed. An
// alignment whose query end lands on a displayed query contig was already the
// first fetch's to answer for; counting it here would report one alignment as
// two, on top of whatever the first fetch did with it.
test('an alignment whose query end is on a displayed query contig is not counted twice', async () => {
  const shared = {
    refName: 'q1',
    start: 100,
    mateRefName: 't1',
    mateStart: 500,
  }
  const { result } = run({
    targetFetchRegions: [region(TARGET_ASM, 't1')],
    fromQuery: [alignment({ id: 'q-side', ...shared })],
    // the same alignment as the target row sees it, which is a different row of
    // the file with a different id — PIF stores both, sorted apart
    fromTarget: [
      alignment({
        id: 't-side',
        refName: 't1',
        start: 500,
        mateRefName: 'q1',
        mateStart: 100,
      }),
    ],
  })
  const { targetOffscreenMates, featureIds } = (await result).value

  expect(targetOffscreenMates.mateRefNameDict).toEqual([])
  // ...and the ribbon it does draw is drawn once
  expect(featureIds).toEqual(['q-side'])
})

// Adjacent fetch regions return a block that straddles them twice, which here
// would inflate a count rather than draw a ribbon twice.
test('one alignment returned by two fetch regions is counted once', async () => {
  const dup = alignment({
    id: 'c',
    refName: 't1',
    start: 500,
    mateRefName: 'q9',
    mateStart: 0,
  })
  const { result } = run({
    targetFetchRegions: [region(TARGET_ASM, 't1')],
    fromTarget: [dup, dup],
  })
  const { targetOffscreenMates } = (await result).value

  expect([...targetOffscreenMates.counts]).toEqual([1])
})

// The mirror of the query axis's own rule: a contig neither row displays is
// still an alignment that goes somewhere, but it has no position on the target
// axis to be marked at, so it is counted and not placed.
test('an alignment anchored outside the target row s regions is not counted', async () => {
  const { result } = run({
    targetFetchRegions: [region(TARGET_ASM, 't1')],
    fromTarget: [
      alignment({
        id: 'd',
        refName: 't9',
        start: 500,
        mateRefName: 'q9',
        mateStart: 0,
      }),
    ],
  })
  const { targetOffscreenMates } = (await result).value

  expect(targetOffscreenMates.mateRefNameDict).toEqual([])
})

// The third class the second fetch finds: a query end on a contig the row above
// IS displaying, merely outside the window it fetched. There is a second
// endpoint, so this is a ribbon — and it is one no single-axis fetch could have
// returned, because that fetch is scoped to a query window it is not in.
test('an alignment whose query end is outside the fetched window becomes a ribbon', async () => {
  const { result } = run({
    // displayed is the whole contig; the window fetched is its first tenth
    queryDisplayed: [region(QUERY_ASM, 'q1', 100000)],
    targetFetchRegions: [region(TARGET_ASM, 't1')],
    fromTarget: [
      alignment({
        id: 'far',
        refName: 't1',
        start: 500,
        mateRefName: 'q1',
        mateStart: 50000,
      }),
    ],
  })
  const { featureIds, refNameDict, starts, targetOffscreenMates } = (
    await result
  ).value

  // drawn, once, and turned round: the query axis is where its refName is now
  expect(featureIds).toEqual(['far'])
  expect(refNameDict).toEqual(['q1'])
  expect([...starts]).toEqual([50000])
  // ...and not also counted as something with nowhere to land
  expect(targetOffscreenMates.mateRefNameDict).toEqual([])
})

// Its mate is the end it was anchored on before the flip, which is what the
// ribbon's far corners are drawn from — swapped one way and not the other is a
// ribbon running to the wrong place on the wrong row.
test('a recovered ribbon names the target row as its mate', async () => {
  const { result } = run({
    queryDisplayed: [region(QUERY_ASM, 'q1', 100000)],
    targetFetchRegions: [region(TARGET_ASM, 't1')],
    fromTarget: [
      alignment({
        id: 'far',
        refName: 't1',
        start: 500,
        mateRefName: 'q1',
        mateStart: 50000,
      }),
    ],
  })
  const { mateRefNameDict, mateStarts } = (await result).value

  expect(mateRefNameDict).toEqual(['t1'])
  expect([...mateStarts]).toEqual([500])
})

function slice(
  assemblyName: string,
  refName: string,
  start: number,
  end: number,
) {
  return { assemblyName, refName, start, end }
}

function block({
  id,
  refName,
  start,
  end,
  mateRefName,
  mateStart,
  mateEnd,
  CIGAR,
}: {
  id: string
  refName: string
  start: number
  end: number
  mateRefName: string
  mateStart: number
  mateEnd: number
  CIGAR?: string
}): Feature {
  return new SimpleFeature({
    uniqueId: id,
    refName,
    start,
    end,
    strand: 1,
    CIGAR,
    mate: {
      refName: mateRefName,
      start: mateStart,
      end: mateEnd,
      assemblyName: refName.startsWith('q') ? TARGET_ASM : QUERY_ASM,
    },
  })
}

// A displayed contig is not a displayed locus: the facing row can show a slice
// of the mate's contig that the mate falls outside, and the alignment then has
// no ribbon to draw and has to be marked like one whose contig is not shown.
test('a mate outside every displayed slice of its contig is marked on the query axis', async () => {
  const { result } = run({
    targetDisplayed: [slice(TARGET_ASM, 't1', 0, 1000)],
    fromQuery: [
      alignment({
        id: 'a',
        refName: 'q1',
        start: 100,
        mateRefName: 't1',
        mateStart: 5000,
      }),
    ],
  })
  const { featureIds, offscreenMates } = (await result).value

  expect(featureIds).toEqual([])
  expect(offscreenMates.mateRefNameDict).toEqual(['t1'])
  expect([...offscreenMates.counts]).toEqual([1])
  expect([...offscreenMates.starts]).toEqual([100])
  expect([...offscreenMates.mateStarts]).toEqual([5000])
})

test('an alignment the two slices share no part of is marked', async () => {
  const { result } = run({
    queryDisplayed: [slice(QUERY_ASM, 'q1', 1000, 2000)],
    queryFetched: [slice(QUERY_ASM, 'q1', 1000, 2000)],
    targetDisplayed: [slice(TARGET_ASM, 't1', 0, 500)],
    fromQuery: [
      block({
        id: 'a',
        refName: 'q1',
        start: 0,
        end: 3000,
        mateRefName: 't1',
        mateStart: 0,
        mateEnd: 3000,
      }),
    ],
  })
  const { featureIds, offscreenMates } = (await result).value

  expect(featureIds).toEqual([])
  expect([...offscreenMates.counts]).toEqual([1])
  // clamped to the query slice, and still the block's own length
  expect([...offscreenMates.starts]).toEqual([0])
  expect([...offscreenMates.ends]).toEqual([1000])
  expect([...offscreenMates.lengths]).toEqual([3000])
})

// A chain wider than the window is re-anchored to the part the window shows,
// which moves its mate; the whole chain's mate reaching the facing slice says
// nothing about whether the part on screen does.
test('a clipped chain whose visible part maps outside the facing slice is marked there', async () => {
  const { result } = run({
    queryDisplayed: [region(QUERY_ASM, 'q1', 100000)],
    queryFetched: [slice(QUERY_ASM, 'q1', 0, 1000)],
    targetDisplayed: [slice(TARGET_ASM, 't1', 90000, 100000)],
    fromQuery: [
      block({
        id: 'chain',
        refName: 'q1',
        start: 0,
        end: 100000,
        mateRefName: 't1',
        mateStart: 0,
        mateEnd: 100000,
        CIGAR: '100000M',
      }),
    ],
  })
  const { featureIds, offscreenMates } = (await result).value

  expect(featureIds).toEqual([])
  expect([...offscreenMates.counts]).toEqual([1])
  expect(offscreenMates.mateEnds[0]).toBeLessThanOrEqual(1000)
})

// The mirror: a query end on a contig the row above shows, outside every slice
// of it, has no ribbon either, and its only position is on the target axis.
test('a target-anchored alignment whose query end misses every query slice is marked on the target axis', async () => {
  const { result } = run({
    targetFetchRegions: [region(TARGET_ASM, 't1')],
    fromTarget: [
      alignment({
        id: 'b',
        refName: 't1',
        start: 500,
        mateRefName: 'q1',
        mateStart: 50000,
      }),
    ],
  })
  const { featureIds, targetOffscreenMates } = (await result).value

  expect(featureIds).toEqual([])
  expect(targetOffscreenMates.mateRefNameDict).toEqual(['q1'])
  expect([...targetOffscreenMates.starts]).toEqual([500])
  expect([...targetOffscreenMates.mateStarts]).toEqual([50000])
})
