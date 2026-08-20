import {
  fetchMafAlignmentData,
  fetchMafSummaryData,
  unionSampleSets,
} from './fetchMafData.ts'

import type { Sample } from '../types.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { RegionFetchContext } from '@jbrowse/plugin-linear-genome-view'

const mockRpcCall = jest.fn()

// the real barrel apart from the session lookup: the fetch splits its two
// concurrent branches with `createStatusFanOut` from here, and `callEachRegion`
// splits each of those per region, so a stub would be testing the stub
jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getSession: () => ({ rpcManager: { call: mockRpcCall } }),
}))
jest.mock('@jbrowse/core/util/tracks', () => ({
  getRpcSessionId: () => 'session-1',
}))

function sample(id: string): Sample {
  return { id, label: id }
}

function result(...ids: string[]) {
  return {
    result: {
      samples: ids.map(sample),
      treeNewick: undefined,
      samplesCanonical: false,
    },
  }
}

describe('unionSampleSets', () => {
  test('skips a region that discovered nothing', () => {
    // A sample-discovery track over a viewport whose first buffered region is a
    // MAF gap (no blocks → no samples) but a later region has alignments.
    const set = unionSampleSets([result(), result('hg38', 'mm10')])
    expect(set?.samples.map(s => s.id)).toEqual(['hg38', 'mm10'])
  })

  test('unions regions that discovered different genomes, first-seen order', () => {
    // Neither region's set can stand for the batch: the worker drops samples
    // missing from the client's order, so picking one hides the other's rows.
    const set = unionSampleSets([result('hg38', 'mm10'), result('hg38', 'rn6')])
    expect(set?.samples.map(s => s.id)).toEqual(['hg38', 'mm10', 'rn6'])
  })

  test('collapses to the one set when every region reports it', () => {
    // Configured-samples tracks return the same complete set for every region.
    const set = unionSampleSets([result('hg38'), result('hg38')])
    expect(set?.samples.map(s => s.id)).toEqual(['hg38'])
  })

  test('is empty when every region is empty', () => {
    // All-gap viewport; `setSamples` unions this into the known rows, so an
    // empty batch leaves them alone rather than blanking them.
    const set = unionSampleSets([result(), result()])
    expect(set?.samples).toEqual([])
  })

  test('returns undefined when there are no results', () => {
    expect(unionSampleSets([])).toBeUndefined()
  })
})

const NEEDED = [
  {
    region: { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
    displayedRegionIndex: 0,
  },
  {
    region: { refName: 'ctgB', start: 0, end: 100, assemblyName: 'volvox' },
    displayedRegionIndex: 3,
  },
]

// Duck-typed stand-in for the display: `fetchRegions` normally comes from
// MultiRegionDisplayMixin and owns stop-token rotation + staleness, none of
// which this test exercises — it just runs the work callback with a fresh ctx.
function makeSelf() {
  const reported: RpcStatus[] = []
  // what the fetch marked loaded — MAF gates pre-flight, so a refusal returns
  // before the work callback and everything reaching it is stored
  const loadedIndices: number[] = []
  const cleared: string[] = []
  const framesFetched: number[] = []
  const framesBlocked: boolean[] = []
  return {
    reported,
    loadedIndices,
    cleared,
    framesFetched,
    framesBlocked,
    self: {
      adapterConfig: {},
      annotationDataActive: false,
      annotationAdapterConfig: undefined as Record<string, unknown> | undefined,
      gateByteLimit: 1_000_000,
      gateActive: true,
      fetchRegions: (
        _needed: unknown,
        work: (ctx: RegionFetchContext) => unknown,
      ) =>
        Promise.resolve(
          work({
            stopToken: 'tok',
            isStale: () => false,
            statusCallback: (s: RpcStatus) => reported.push(s),
            commitRegion: (idx: number) => {
              loadedIndices.push(idx)
            },
          }),
        ).then(() => {}),
      setRpcData: () => {},
      setSummaryData: () => {},
      setFramesData: (i: number) => {
        framesFetched.push(i)
      },
      setFramesGateBlocked: (blocked: boolean) => {
        framesBlocked.push(blocked)
      },
      clearAlignmentData: () => {
        cleared.push('alignment')
      },
      setSamples: () => {},
    },
  }
}

beforeEach(() => {
  mockRpcCall.mockReset()
  mockRpcCall.mockResolvedValue({
    samples: [],
    treeNewick: undefined,
    samplesCanonical: false,
    regionData: { blocks: [] },
    records: [],
  })
})

// Regression: the MAF RPCs accept `statusCallback` (BaseMafRpcArgs), the
// executors forward it into the adapter opts, and the adapters wrap their reads
// in `updateStatus` — but the client call sites omitted it, so a MAF track's
// loading overlay showed no download progress at all. Pin the wiring at the one
// place that was missing.
describe('MAF fetch progress reporting', () => {
  test.each([
    ['alignment', fetchMafAlignmentData],
    ['summary', fetchMafSummaryData],
  ])('%s fetch passes a per-region statusCallback', async (_name, fetchFn) => {
    const { self, reported } = makeSelf()
    await fetchFn(self as any, NEEDED)

    expect(mockRpcCall).toHaveBeenCalledTimes(2)
    const sent = mockRpcCall.mock.calls.map(c => c[2].statusCallback)
    for (const cb of sent) {
      expect(typeof cb).toBe('function')
    }
    // a slot each, so the two concurrent per-region fetches aggregate into one
    // bar rather than clobbering each other
    expect(sent[0]).not.toBe(sent[1])
    sent[0]({ message: 'Downloading', current: 30, total: 100 })
    sent[1]({ message: 'Downloading', current: 10, total: 100 })
    expect(reported.at(-1)).toEqual({
      message: 'Downloading',
      current: 40,
      total: 200,
    })
  })
})

// The swap is one-directional on purpose. Entering summary mode drops the
// alignment blocks so the GPU sequence canvas paints nothing under the summary
// overlay; zooming back in keeps the summary records, because `regionHasData`
// tests `summaryDataMap` in summary mode and that retention is what lets the
// zoom back out reuse the cache rather than re-read the summary adapter.
describe('summary/detail data swap', () => {
  test('the summary fetch drops alignment blocks', async () => {
    const { self, cleared } = makeSelf()
    await fetchMafSummaryData(self as any, NEEDED)
    expect(cleared).toEqual(['alignment'])
  })

  test('the alignment fetch keeps summary records', async () => {
    const { self, cleared } = makeSelf()
    await fetchMafAlignmentData(self as any, NEEDED)
    expect(cleared).toEqual([])
  })
})

// The display's byte gate measures exactly one file — the alignment, or the
// summary past the swap point — and `mafFrames` is a third, fetched
// concurrently with whichever of those won. So nothing was watching it, and it
// is not small by nature: one record per CDS exon *per species*, over the
// buffered region, at every zoom the summary tier reaches. That is the premise
// `measuresBytesPreFlight`'s own docstring rejects — "off means nothing is
// watching, and 'this tier is cheap' is a premise, not a bound".
describe('the CDS-frame read is measured against its own file', () => {
  function framesSelf(over: Record<string, unknown> = {}) {
    const made = makeSelf()
    Object.assign(made.self, {
      annotationDataActive: true,
      annotationAdapterConfig: { type: 'BigBedAdapter' },
      ...over,
    })
    return made
  }

  // The frames RPC returns `{records}` and the two main ones return their own
  // shapes; one resolver serves all three, with the estimate switched per test.
  function respondWith(bytes: number | undefined) {
    mockRpcCall.mockImplementation((_s: string, method: string) =>
      Promise.resolve(
        method === 'CoreGetRegionByteEstimate'
          ? bytes
          : {
              samples: [],
              treeNewick: undefined,
              samplesCanonical: false,
              regionData: { blocks: [] },
              records: [],
            },
      ),
    )
  }

  const callsTo = (method: string) =>
    mockRpcCall.mock.calls.filter(c => c[1] === method)

  test('measures the annotation adapter, not the one the banner is about', async () => {
    const { self } = framesSelf()
    respondWith(500)
    await fetchMafAlignmentData(self as any, NEEDED)

    const estimates = callsTo('CoreGetRegionByteEstimate')
    expect(estimates).toHaveLength(1)
    expect(estimates[0]![2].adapterConfig).toEqual({ type: 'BigBedAdapter' })
    // one measurement for the batch, quoting every region the read covers
    expect(estimates[0]![2].regions).toHaveLength(NEEDED.length)
  })

  test('reads the frames when the estimate is under the limit', async () => {
    const { self, framesFetched, framesBlocked } = framesSelf()
    respondWith(500)
    await fetchMafAlignmentData(self as any, NEEDED)

    expect(callsTo('LinearMafGetAnnotationData')).toHaveLength(2)
    expect(framesFetched).toEqual([0, 3])
    expect(framesBlocked).toEqual([false])
  })

  // The overlay is auxiliary, so declining is soft — the alignment still
  // arrives and nothing else on screen changes, which is exactly why the skip
  // has to be reported rather than silent.
  test('declines an over-budget read and says so, without failing the fetch', async () => {
    const { self, framesFetched, framesBlocked } = framesSelf()
    respondWith(50_000_000)
    await fetchMafAlignmentData(self as any, NEEDED)

    expect(callsTo('LinearMafGetAnnotationData')).toHaveLength(0)
    expect(framesFetched).toEqual([])
    expect(framesBlocked).toEqual([true])
    // the main fetch is untouched
    expect(callsTo('LinearMafGetAlignmentData')).toHaveLength(2)
  })

  // Force-load exempts the track outright, on every axis — one informed click
  // covers this read too, rather than leaving the overlay mysteriously off
  // after the banner is gone. It reaches here as `gateActive`, which is the
  // whole "may anything gate right now" question rather than force-load alone.
  test('force-load lifts it, and skips the measurement entirely', async () => {
    const { self, framesFetched } = framesSelf({ gateActive: false })
    respondWith(50_000_000)
    await fetchMafAlignmentData(self as any, NEEDED)
    expect(callsTo('CoreGetRegionByteEstimate')).toHaveLength(0)
    expect(framesFetched).toEqual([0, 3])
  })

  // An adapter quoting no index estimate is "unmeasurable", not "too large" —
  // the same reading `CoreGetRegionByteEstimate` documents for its undefined,
  // and the same one the main gate takes.
  test('reads the frames when the adapter cannot be measured', async () => {
    const { self, framesFetched } = framesSelf()
    respondWith(undefined)
    await fetchMafAlignmentData(self as any, NEEDED)
    expect(framesFetched).toEqual([0, 3])
  })

  // The summary tier is where the span gets large enough for this to matter, so
  // it has to be gated on that path too — not only on the alignment's.
  test('applies on the summary tier as well', async () => {
    const { self, framesFetched, framesBlocked } = framesSelf()
    respondWith(50_000_000)
    await fetchMafSummaryData(self as any, NEEDED)
    expect(framesFetched).toEqual([])
    expect(framesBlocked).toEqual([true])
  })

  // A track with the overlay off pays for none of this.
  test('measures nothing when no consumer wants the frames', async () => {
    const { self } = framesSelf({ annotationDataActive: false })
    respondWith(500)
    await fetchMafAlignmentData(self as any, NEEDED)
    expect(callsTo('CoreGetRegionByteEstimate')).toHaveLength(0)
  })
})
