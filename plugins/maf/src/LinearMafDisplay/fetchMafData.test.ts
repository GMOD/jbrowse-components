import { isStopped, stopTokenSignal } from '@jbrowse/core/util'

import {
  fetchMafAlignmentData,
  fetchMafSummaryData,
  unionSampleSets,
} from './fetchMafData.ts'

import type { Sample } from '../types.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { RegionFetchContext } from '@jbrowse/display-kit/MultiRegionDisplayMixin'

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
  // what the fetch marked loaded. MAF's batch is atomic: the sample set is a
  // decision over every region, so one refused region refuses the batch and
  // nothing is marked loaded.
  const loadedIndices: number[] = []
  const committedBytes: (number | undefined)[][] = []
  const cleared: string[] = []
  const framesFetched: number[] = []
  const framesBlocked: boolean[] = []
  return {
    reported,
    loadedIndices,
    committedBytes,
    cleared,
    framesFetched,
    framesBlocked,
    self: {
      adapterConfig: {},
      // `RegionTooLargeMixin`'s two commit members, which the fan-out helper
      // calls for every display
      gateFetchState: () => ({
        viewport: { spanBp: 100, key: 'k' },
        gated: true,
        tierKey: undefined,
      }),
      commitFetchBytes: (bytes: (number | undefined)[]) => {
        committedBytes.push(bytes)
      },
      annotationDataActive: false,
      annotationAdapterConfig: undefined as Record<string, unknown> | undefined,
      resolvedByteLimit: () => 1_000_000 as number | undefined,
      fetchRegions: (
        _needed: unknown,
        work: (ctx: RegionFetchContext) => unknown,
      ) =>
        Promise.resolve(
          work({
            stopToken: 'tok',
            isStale: () => false,
            statusCallback: (s: RpcStatus) => reported.push(s),
            // the real envelope, over this file's mocked rpcManager, so the
            // converted fetch sites exercise the same injection production does
            callRpc(method, args) {
              return mockRpcCall('session-1', method, {
                ...args,
                stopToken: this.stopToken,
                statusCallback: this.statusCallback,
              })
            },
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

// The gate is one argument at the call and one commit after it. Each tier's RPC
// measures the file IT reads — the alignment index on the detail path, the
// `summaryAdapter` sub-adapter on the summary one — so the number the banner
// quotes always describes the download that was refused.
describe('the byte gate rides in the tier fetch', () => {
  test.each([
    ['alignment', fetchMafAlignmentData],
    ['summary', fetchMafSummaryData],
  ])('%s fetch sends the resolved byte budget', async (_name, fetchFn) => {
    const { self } = makeSelf()
    await fetchFn(self as any, NEEDED)

    for (const call of mockRpcCall.mock.calls) {
      expect(call[2].byteLimit).toBe(1_000_000)
    }
  })

  test('a force-loaded display sends no budget, so the worker measures nothing', async () => {
    const { self } = makeSelf()
    self.resolvedByteLimit = () => undefined
    await fetchMafAlignmentData(self as any, NEEDED)

    for (const call of mockRpcCall.mock.calls) {
      expect(call[2].byteLimit).toBeUndefined()
    }
  })

  // One refused region refuses the batch, because the sample union is a
  // decision over all of them: a set derived from the regions that happened to
  // fit is not the set this viewport has. The largest measurement still reaches
  // the gate, which is what puts a size in the banner and releases it on a
  // later zoom.
  test('a refused region refuses the batch, and its bytes still reach the gate', async () => {
    const { self, loadedIndices, committedBytes } = makeSelf()
    mockRpcCall.mockImplementation((_s: string, _m: string, args: any) =>
      Promise.resolve(
        args.regions[0].refName === 'ctgA'
          ? { regionTooLarge: true, bytes: 9e9 }
          : {
              samples: [],
              treeNewick: undefined,
              samplesCanonical: false,
              regionData: { blocks: [] },
              bytes: 10,
            },
      ),
    )

    await fetchMafAlignmentData(self as any, NEEDED)

    expect(loadedIndices).toEqual([])
    expect(committedBytes).toEqual([[9e9]])
  })

  // The refusal stops the batch's own token, so a sibling still downloading
  // aborts at the socket and is simply absent from what the gate is handed; the
  // fetch's token, which the display's cancel owns, is left alone.
  test('the first refusal aborts the siblings still in flight', async () => {
    const { self, loadedIndices, committedBytes } = makeSelf()
    const siblingTokens: string[] = []
    mockRpcCall.mockImplementation((_s: string, _m: string, args: any) => {
      if (args.regions[0].refName === 'ctgA') {
        return Promise.resolve({ regionTooLarge: true, bytes: 9e9 })
      }
      siblingTokens.push(args.stopToken)
      return new Promise((_resolve, reject) => {
        stopTokenSignal(args.stopToken).signal.addEventListener('abort', () => {
          reject(new Error('aborted'))
        })
      })
    })

    await fetchMafAlignmentData(self as any, NEEDED)

    expect(loadedIndices).toEqual([])
    expect(committedBytes).toEqual([[9e9]])
    expect(siblingTokens).toHaveLength(1)
    expect(siblingTokens[0]).not.toBe('tok')
    expect(isStopped(siblingTokens[0])).toBe(true)
    expect(isStopped('tok')).toBe(false)
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
// `gateEnabled`'s own docstring rejects — "off means nothing is watching, and
// 'this tier is cheap' is a premise, not a bound". It carries a `byteLimit`
// like the other two, so the worker measures the frames file before it reads
// it — no probe on the critical path.
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

  // The frames RPC answers records or a refusal, exactly as the two main ones
  // do; the other methods keep their own shapes. `refuse` switches which of the
  // two the frames call gives back.
  function respondWith(refuse: boolean) {
    mockRpcCall.mockImplementation((_s: string, method: string) =>
      Promise.resolve(
        method === 'LinearMafGetAnnotationData' && refuse
          ? { regionTooLarge: true }
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

  // The budget travels with the read rather than ahead of it: the worker
  // measures the annotation adapter itself and refuses in the same round trip,
  // so nothing on the critical path waits on a separate probe.
  test('sends the budget with the read, and no pre-flight probe', async () => {
    const { self } = framesSelf()
    respondWith(false)
    await fetchMafAlignmentData(self as any, NEEDED)

    expect(callsTo('CoreGetRegionByteEstimate')).toHaveLength(0)
    const frames = callsTo('LinearMafGetAnnotationData')
    expect(frames).toHaveLength(NEEDED.length)
    expect(frames[0]![2].adapterConfig).toEqual({ type: 'BigBedAdapter' })
    expect(frames[0]![2].byteLimit).toBe(1_000_000)
  })

  test('reads the frames when the region is under the limit', async () => {
    const { self, framesFetched, framesBlocked } = framesSelf()
    respondWith(false)
    await fetchMafAlignmentData(self as any, NEEDED)

    expect(framesFetched).toEqual([0, 3])
    expect(framesBlocked).toEqual([false])
  })

  // The overlay is auxiliary, so declining is soft — the alignment still
  // arrives and nothing else on screen changes, which is exactly why the skip
  // has to be reported rather than silent.
  test('declines an over-budget read and says so, without failing the fetch', async () => {
    const { self, framesFetched, framesBlocked } = framesSelf()
    respondWith(true)
    await fetchMafAlignmentData(self as any, NEEDED)

    expect(framesFetched).toEqual([])
    expect(framesBlocked).toEqual([true])
    // the main fetch is untouched
    expect(callsTo('LinearMafGetAlignmentData')).toHaveLength(2)
  })

  // Force-load exempts the track outright, on every axis — one informed click
  // covers this read too, rather than leaving the overlay mysteriously off
  // after the banner is gone. It reaches here as an undefined
  // `resolvedByteLimit()`, which is the whole "may anything gate right now"
  // question rather than force-load alone, and an absent `byteLimit` is what
  // makes the worker measure nothing.
  test('force-load lifts it, and the worker then measures nothing', async () => {
    const { self, framesFetched } = framesSelf({
      resolvedByteLimit: () => undefined,
    })
    respondWith(false)
    await fetchMafAlignmentData(self as any, NEEDED)
    expect(
      callsTo('LinearMafGetAnnotationData')[0]![2].byteLimit,
    ).toBeUndefined()
    expect(framesFetched).toEqual([0, 3])
  })

  // The strip spans the viewport, so drawing it over only the regions that fit
  // would read as "these exons are all there are".
  test('one refused region refuses the overlay', async () => {
    const { self, framesFetched, framesBlocked } = framesSelf()
    mockRpcCall.mockImplementation((_s: string, method: string, args: any) =>
      Promise.resolve(
        method === 'LinearMafGetAnnotationData' &&
          args.regions[0].refName === 'ctgB'
          ? { regionTooLarge: true }
          : {
              samples: [],
              treeNewick: undefined,
              samplesCanonical: false,
              regionData: { blocks: [] },
              records: [],
            },
      ),
    )
    await fetchMafAlignmentData(self as any, NEEDED)
    expect(framesFetched).toEqual([])
    expect(framesBlocked).toEqual([true])
  })

  // The summary tier is where the span gets large enough for this to matter, so
  // it has to be gated on that path too — not only on the alignment's.
  test('applies on the summary tier as well', async () => {
    const { self, framesFetched, framesBlocked } = framesSelf()
    respondWith(true)
    await fetchMafSummaryData(self as any, NEEDED)
    expect(framesFetched).toEqual([])
    expect(framesBlocked).toEqual([true])
  })

  // A track with the overlay off pays for none of this.
  test('reads nothing when no consumer wants the frames', async () => {
    const { self } = framesSelf({ annotationDataActive: false })
    respondWith(false)
    await fetchMafAlignmentData(self as any, NEEDED)
    expect(callsTo('LinearMafGetAnnotationData')).toHaveLength(0)
  })
})
