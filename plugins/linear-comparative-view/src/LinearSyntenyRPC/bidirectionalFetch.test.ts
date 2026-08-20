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
}

// Anchored on `refName`, mate on `mateRefName`, in whichever perspective the
// caller asked about — which is what every pairwise adapter returns for a
// region query (`PairwiseAdapterBase.sideFor` picks the side, and the row is
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
}: {
  fromQuery?: Feature[]
  fromTarget?: Feature[]
  targetFetchRegions?: Region[]
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
      queryView,
      targetView: { ...targetView, fetchRegions: targetFetchRegions },
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
