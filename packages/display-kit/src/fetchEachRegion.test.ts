/**
 * The two `ctx.isStale()` guards `fetchEachRegion` exists to own.
 *
 * The data-fetching guide calls the wrapper a correctness primitive rather than
 * a dedup, on the grounds that a display writing its own fan-out has to
 * remember both guards and a stale-data write is what forgetting one costs.
 * Neither guard had a test: `callEachRegion.test.ts` covers the fan-out with
 * `isStale: () => false`, and `FetchMixin.test.ts` covers when the flag flips,
 * so a `fetchEachRegion` that dropped either check kept every existing test
 * green while committing a moved-past viewport's data.
 *
 * The commit guard is per region, not one around the batch, which is the whole
 * reason it is not simply hoisted: a region that arrives before the user moves
 * on still commits.
 */
import { fetchEachRegion } from './fetchEachRegion.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { RegionFetchContext } from './regionCommit.ts'
import type { GateFetchState } from './regionTooLargeUtils.ts'

// what a mock stores for a region: the helpers require a payload back
const STORED = 'stored'

const NEEDED = [
  {
    region: { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
    displayedRegionIndex: 2,
  },
  {
    region: { refName: 'ctgB', start: 0, end: 100, assemblyName: 'volvox' },
    displayedRegionIndex: 5,
  },
]

const ISSUED: GateFetchState = {
  viewport: { spanBp: 100, key: 'ctgA:0-100' },
  gated: true,
  tierKey: undefined,
}

// `self` supplies `fetchRegions`, which normally rotates the signal, and
// the gate's two commit members, which the helper calls for every display.
// Running `work` directly with a ctx the test controls isolates the guards from
// that machinery.
function selfWith(
  ctx: FetchContext,
  loaded: number[] = [],
  bytes: (number | undefined)[][] = [],
  partials: boolean[] = [],
) {
  return {
    gateFetchState: () => ISSUED,
    commitFetchBytes: (
      perRegionBytes: (number | undefined)[],
      _issued: GateFetchState,
      partial?: boolean,
    ) => {
      bytes.push(perRegionBytes)
      partials.push(partial ?? false)
    },
    fetchRegions: (
      _needed: typeof NEEDED,
      work: (ctx: RegionFetchContext) => Promise<void>,
    ) =>
      work({
        ...ctx,
        commitRegion: idx => {
          loaded.push(idx)
        },
      }),
  }
}

test('commits every region and completes when nothing went stale', async () => {
  const committed: [number, string][] = []
  let completed = 0
  await fetchEachRegion(
    selfWith({
      signal: new AbortController().signal,
      isStale: () => false,
      statusCallback: () => {},
      callRpc() {
        throw new Error('callRpc is not stubbed in this test')
      },
    }),
    NEEDED,
    {
      call: region => Promise.resolve(region.refName),
      onResult: (idx, result) => committed.push([idx, result]),
      onComplete: () => {
        completed++
      },
    },
  )
  expect(committed).toEqual([
    [2, 'ctgA'],
    [5, 'ctgB'],
  ])
  expect(completed).toBe(1)
})

test('a viewport that moved before any result lands commits nothing', async () => {
  const committed: [number, string][] = []
  let completed = 0
  await fetchEachRegion(
    selfWith({
      signal: new AbortController().signal,
      isStale: () => true,
      statusCallback: () => {},
      callRpc() {
        throw new Error('callRpc is not stubbed in this test')
      },
    }),
    NEEDED,
    {
      call: region => Promise.resolve(region.refName),
      onResult: (idx, result) => committed.push([idx, result]),
      onComplete: () => {
        completed++
      },
    },
  )
  expect(committed).toEqual([])
  // the post-fetch step is guarded separately, and skipping the commits while
  // still running it is the shape of the bug the second guard prevents
  expect(completed).toBe(0)
})

// Staleness flips from inside the first commit rather than on a timer: both
// calls resolve immediately, so their continuations run in `needed` order and
// "the user moved on between the two regions landing" is exact rather than
// raced.
test('a region that arrived before the move still commits; a later one does not', async () => {
  const committed: [number, string][] = []
  let completed = 0
  let stale = false
  await fetchEachRegion(
    selfWith({
      signal: new AbortController().signal,
      isStale: () => stale,
      statusCallback: () => {},
      callRpc() {
        throw new Error('callRpc is not stubbed in this test')
      },
    }),
    NEEDED,
    {
      call: region => Promise.resolve(region.refName),
      onResult: (idx, result) => {
        committed.push([idx, result])
        stale = true
        return result
      },
      onComplete: () => {
        completed++
      },
    },
  )
  expect(committed).toEqual([[2, 'ctgA']])
  expect(completed).toBe(0)
})

// The other skip in the same expression, and it had no test either — the
// per-region twin of what `fetchAllRegions.test.ts` covers. `loadedRegions` is
// the span `isBlockCovered` judges the viewport against, so a refused region
// committed there reads as covered against a payload nobody received: the plan
// answers `covered` on every later run, nothing refetches, and since the
// ordinary fetch is the gate's own re-measure, nothing re-measures either.
//
// The refusal reaches the display's store nowhere at all — `onResult` is the
// payload path and a marker is not a payload — and reaches the GATE instead,
// through `commitFetchBytes`, which is what raises the banner and what lets it
// release once the user zooms.
// The refusing region is the second one, so this also pins the half the short
// circuit below must not break: a region that landed before the refusal keeps
// the commit it already made.
test('a region the worker refused is neither stored nor marked loaded, and its bytes still reach the gate', async () => {
  const loaded: number[] = []
  const bytes: (number | undefined)[][] = []
  const refused = { regionTooLarge: true as const, bytes: 9e9 }
  const committed: [number, unknown][] = []
  await fetchEachRegion(
    selfWith(
      {
        signal: new AbortController().signal,
        isStale: () => false,
        statusCallback: () => {},
        callRpc() {
          throw new Error('callRpc is not stubbed in this test')
        },
      },
      loaded,
      bytes,
    ),
    NEEDED,
    {
      call: region =>
        Promise.resolve(
          region.refName === 'ctgB' ? refused : { bytes: 10, value: 'ctgA' },
        ),
      onResult: (idx, result) => committed.push([idx, result]),
    },
  )
  expect(committed).toEqual([[2, { bytes: 10, value: 'ctgA' }]])
  expect(loaded).toEqual([2])
  // max, not sum: the budget is what one region may cost
  expect(bytes).toEqual([[10, 9e9]])
})

// The gate's verdict is display-wide and monotone: once one region is over
// budget, `tooLarge` replaces the whole subtree and no sibling can change that
// or be seen under it. So the siblings' downloads are pure cost, and the batch
// stops.
test('the first refusal commits the verdict and drops the rest of the batch', async () => {
  const loaded: number[] = []
  const bytes: (number | undefined)[][] = []
  const committed: [number, unknown][] = []
  let completed = 0
  await fetchEachRegion(
    selfWith(
      {
        signal: new AbortController().signal,
        isStale: () => false,
        statusCallback: () => {},
        callRpc() {
          throw new Error('callRpc is not stubbed in this test')
        },
      },
      loaded,
      bytes,
    ),
    NEEDED,
    {
      call: region =>
        Promise.resolve(
          region.refName === 'ctgA'
            ? { regionTooLarge: true as const, bytes: 9e9 }
            : { bytes: 10, value: 'ctgB' },
        ),
      onResult: (idx, result) => committed.push([idx, result]),
      onComplete: () => {
        completed++
      },
    },
  )
  // the sibling resolved, and was dropped rather than stored
  expect(committed).toEqual([])
  expect(loaded).toEqual([])
  // the refusal's own bytes, committed with the sibling still unmeasured, and
  // the batch tail adds no second commit
  expect(bytes).toEqual([[9e9, undefined]])
  expect(completed).toBe(1)
})

// The refusal aborts the fan-out's own signal, so a sibling still downloading
// stops at the socket. The fetch's signal, which the display's rotation owns,
// is left alone, and the batch ends without waiting for the sibling's reply,
// so the fetch is over the moment the refusal lands.
test('the first refusal aborts a sibling in flight and does not wait for it', async () => {
  const parent = new AbortController()
  const siblingSignals: AbortSignal[] = []
  const bytes: (number | undefined)[][] = []
  const partials: boolean[] = []
  await fetchEachRegion(
    selfWith(
      {
        signal: parent.signal,
        isStale: () => false,
        statusCallback: () => {},
        callRpc() {
          throw new Error('callRpc is not stubbed in this test')
        },
      },
      [],
      bytes,
      partials,
    ),
    NEEDED,
    {
      call: (region, ctx) => {
        if (region.refName === 'ctgA') {
          return Promise.resolve({ regionTooLarge: true as const, bytes: 9e9 })
        }
        siblingSignals.push(ctx.signal)
        return new Promise<never>(() => {})
      },
      onResult: () => STORED,
    },
  )
  expect(siblingSignals).toHaveLength(1)
  expect(siblingSignals[0]!.aborted).toBe(true)
  expect(parent.signal.aborted).toBe(false)
  expect(bytes).toEqual([[9e9, undefined]])
  expect(partials).toEqual([true])
})

// Two regions refusing in the same batch is the ordinary case at whole-genome
// zoom, and the second must not re-commit: each commit bumps `fetchGeneration`,
// so a commit per refused region is a burst of autorun re-runs where one is
// owed.
test('a batch where several regions refuse commits exactly once', async () => {
  const bytes: (number | undefined)[][] = []
  let completed = 0
  await fetchEachRegion(
    selfWith(
      {
        signal: new AbortController().signal,
        isStale: () => false,
        statusCallback: () => {},
        callRpc() {
          throw new Error('callRpc is not stubbed in this test')
        },
      },
      [],
      bytes,
    ),
    NEEDED,
    {
      call: () =>
        Promise.resolve({ regionTooLarge: true as const, bytes: 9e9 }),
      onResult: () => STORED,
      onComplete: () => {
        completed++
      },
    },
  )
  expect(bytes).toEqual([[9e9, undefined]])
  expect(completed).toBe(1)
})

// The gate state is captured before the first RPC goes out, never re-read at
// commit time — a view that moved during the round trip would otherwise label
// the measurement with a viewport it never covered.
test('the gate state handed to onComplete is the one captured at issue', async () => {
  const seen: GateFetchState[] = []
  await fetchEachRegion(
    selfWith({
      signal: new AbortController().signal,
      isStale: () => false,
      statusCallback: () => {},
      callRpc() {
        throw new Error('callRpc is not stubbed in this test')
      },
    }),
    NEEDED,
    {
      call: region => Promise.resolve(region.refName),
      onResult: () => STORED,
      onComplete: issued => {
        seen.push(issued)
      },
    },
  )
  expect(seen).toEqual([ISSUED])
})

// The ctx `call` receives is this region's, not the fetch's: a signal the
// fetch's aborts (one cancel takes the fan-out down) and its own
// `statusCallback` slot, so
// `statusCallback: ctx.statusCallback` at the call site aggregates the parallel
// regions into one bar instead of clobbering. The index is still the third
// argument for the displays that key their own bookkeeping off it.
test('call receives the region, its own ctx and the displayed region index', async () => {
  const parent = new AbortController()
  const ctx: FetchContext = {
    signal: parent.signal,
    isStale: () => false,
    statusCallback: () => {},
    callRpc() {
      throw new Error('callRpc is not stubbed in this test')
    },
  }
  const seen: [string, boolean, number][] = []
  const signals: AbortSignal[] = []
  await fetchEachRegion(selfWith(ctx), NEEDED, {
    call: (region, callCtx, displayedRegionIndex) => {
      seen.push([
        region.refName,
        callCtx.statusCallback === ctx.statusCallback,
        displayedRegionIndex,
      ])
      signals.push(callCtx.signal)
      return Promise.resolve(region.refName)
    },
    onResult: () => STORED,
  })
  expect(seen).toEqual([
    ['ctgA', false, 2],
    ['ctgB', false, 5],
  ])
  parent.abort()
  expect(signals.map(s => s.aborted)).toEqual([true, true])
})

// `partial` is a claim about the NUMBER, not about the refusal: it says the max
// is over whichever regions won the race rather than over the set, and
// `nextByteEstimate` drops such a reading as zoom evidence because comparing
// chr1's bytes to chr4's is not a comparison. So it has to be false whenever
// every region did report — a refusal from the last region to land, and every
// refusal on a single-region display, is ordinary evidence, and marking it
// partial would silently stop `zoomIneffective` ever accumulating.
test('a refusal is only partial when a region never reported', async () => {
  const run = async (refuseOn: string) => {
    const partials: boolean[] = []
    await fetchEachRegion(
      selfWith(
        {
          signal: new AbortController().signal,
          isStale: () => false,
          statusCallback: () => {},
          callRpc() {
            throw new Error('callRpc is not stubbed in this test')
          },
        },
        [],
        [],
        partials,
      ),
      NEEDED,
      {
        call: region =>
          Promise.resolve(
            region.refName === refuseOn
              ? { regionTooLarge: true as const, bytes: 9e9 }
              : { bytes: 10, value: region.refName },
          ),
        onResult: () => STORED,
      },
    )
    return partials
  }
  // ctgA is first, so ctgB never reported
  expect(await run('ctgA')).toEqual([true])
  // ctgB is last, so the batch measured everything before it stopped
  expect(await run('ctgB')).toEqual([false])
})
