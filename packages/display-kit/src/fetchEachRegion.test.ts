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
import { fetchEachRegion } from './MultiRegionDisplayMixin.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { RegionFetchContext } from './regionCommit.ts'
import type { GateFetchState } from './regionTooLargeUtils.ts'

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

// `self` supplies `fetchRegions`, which normally rotates the stop token, and
// the gate's two commit members, which the helper calls for every display.
// Running `work` directly with a ctx the test controls isolates the guards from
// that machinery.
//
// `cancelFetch` stands in for the real one's *observable* effect rather than its
// bookkeeping: `stopActiveFetch` closes the rotation's guard, so every later
// read of `ctx.isStale()` in the same batch answers true. A stub that only
// counted calls would let a cancelled batch go on committing siblings, which is
// the half of the contract worth pinning.
function selfWith(
  ctx: FetchContext,
  loaded: number[] = [],
  bytes: (number | undefined)[][] = [],
  cancels: number[] = [],
) {
  let canceled = false
  return {
    gateFetchState: () => ISSUED,
    commitFetchBytes: (perRegionBytes: (number | undefined)[]) => {
      bytes.push(perRegionBytes)
    },
    cancelFetch: () => {
      canceled = true
      cancels.push(bytes.length)
    },
    fetchRegions: (
      _needed: typeof NEEDED,
      work: (ctx: RegionFetchContext) => Promise<void>,
    ) =>
      work({
        ...ctx,
        isStale: () => canceled || ctx.isStale(),
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
      stopToken: 'tok',
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
      stopToken: 'tok',
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
      stopToken: 'tok',
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
        stopToken: 'tok',
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
//
// The commit has to land BEFORE the cancel, and this is the pin for it. Cancel
// first and the aborts reject the batch, the tail never commits, and the
// `fetchGeneration` bump re-runs an autorun against a gate holding no
// measurement and no viewport stamp — `gateSkipsMeasuredViewport` false, the
// plan re-issues, forever. Asserting the ORDER is what catches that: a
// commit-after-cancel implementation still commits, just uselessly.
test('the first refusal commits the verdict, then cancels the rest of the batch', async () => {
  const loaded: number[] = []
  const bytes: (number | undefined)[][] = []
  const cancels: number[] = []
  const committed: [number, unknown][] = []
  let completed = 0
  await fetchEachRegion(
    selfWith(
      {
        stopToken: 'tok',
        isStale: () => false,
        statusCallback: () => {},
        callRpc() {
          throw new Error('callRpc is not stubbed in this test')
        },
      },
      loaded,
      bytes,
      cancels,
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
  // the sibling resolved, and was dropped rather than stored: the cancel made
  // the ctx stale before its continuation ran
  expect(committed).toEqual([])
  expect(loaded).toEqual([])
  // the refusal's own bytes, committed with the sibling still unmeasured
  expect(bytes).toEqual([[9e9, undefined]])
  // one commit and one density commit, both before the single cancel, and the
  // batch tail adds no second pair
  expect(cancels).toEqual([1])
  expect(completed).toBe(1)
})

// Two regions refusing in the same batch is the ordinary case at whole-genome
// zoom, and the second must not re-commit or re-cancel: `cancelFetch` bumps
// `fetchGeneration`, so a bump per refused region is a burst of autorun re-runs
// where one is owed.
//
// The stub below flips its own staleness, as the real `cancelFetch` does. The
// test after it removes that, which is the point of `gateBatch` holding the
// count itself.
test('a batch where several regions refuse commits and cancels exactly once', async () => {
  const bytes: (number | undefined)[][] = []
  const cancels: number[] = []
  let completed = 0
  await fetchEachRegion(
    selfWith(
      {
        stopToken: 'tok',
        isStale: () => false,
        statusCallback: () => {},
        callRpc() {
          throw new Error('callRpc is not stubbed in this test')
        },
      },
      [],
      bytes,
      cancels,
    ),
    NEEDED,
    {
      call: () =>
        Promise.resolve({ regionTooLarge: true as const, bytes: 9e9 }),
      onResult: () => {},
      onComplete: () => {
        completed++
      },
    },
  )
  expect(bytes).toEqual([[9e9, undefined]])
  expect(cancels).toEqual([1])
  expect(completed).toBe(1)
})

// The gate state is captured before the first RPC goes out, never re-read at
// commit time — a view that moved during the round trip would otherwise label
// the measurement with a viewport it never covered.
test('the gate state handed to onComplete is the one captured at issue', async () => {
  const seen: GateFetchState[] = []
  await fetchEachRegion(
    selfWith({
      stopToken: 'tok',
      isStale: () => false,
      statusCallback: () => {},
      callRpc() {
        throw new Error('callRpc is not stubbed in this test')
      },
    }),
    NEEDED,
    {
      call: region => Promise.resolve(region.refName),
      onResult: () => {},
      onComplete: issued => {
        seen.push(issued)
      },
    },
  )
  expect(seen).toEqual([ISSUED])
})

// The ctx `call` receives is this region's, not the fetch's: same stop token
// (one cancel takes the fan-out down) but its own `statusCallback` slot, so
// `statusCallback: ctx.statusCallback` at the call site aggregates the parallel
// regions into one bar instead of clobbering. The index is still the third
// argument for the displays that key their own bookkeeping off it.
test('call receives the region, its own ctx and the displayed region index', async () => {
  const ctx: FetchContext = {
    stopToken: 'tok',
    isStale: () => false,
    statusCallback: () => {},
    callRpc() {
      throw new Error('callRpc is not stubbed in this test')
    },
  }
  const seen: [string, boolean, boolean, number][] = []
  await fetchEachRegion(selfWith(ctx), NEEDED, {
    call: (region, callCtx, displayedRegionIndex) => {
      seen.push([
        region.refName,
        callCtx.stopToken === ctx.stopToken,
        callCtx.statusCallback === ctx.statusCallback,
        displayedRegionIndex,
      ])
      return Promise.resolve(region.refName)
    },
    onResult: () => {},
  })
  expect(seen).toEqual([
    ['ctgA', true, false, 2],
    ['ctgB', true, false, 5],
  ])
})

// The once-ness is `gateBatch`'s, not a consequence of `cancelFetch` closing the
// rotation's guard. That guard does close in production and `FetchMixin.test.ts`
// pins it — but it is a contract between two members of a duck-typed interface
// that no type states, so a display implementing it differently, or a refactor
// of the rotation, would otherwise turn a documented invariant into a silent
// double commit. Here `cancelFetch` is inert and every region refuses.
test('commits once even if cancelFetch leaves the batch running', async () => {
  const bytes: (number | undefined)[][] = []
  const cancels: number[] = []
  let completed = 0
  const self = {
    gateFetchState: () => ISSUED,
    commitFetchBytes: (perRegionBytes: (number | undefined)[]) => {
      bytes.push(perRegionBytes)
    },
    cancelFetch: () => {
      cancels.push(bytes.length)
    },
    fetchRegions: (
      _needed: typeof NEEDED,
      work: (ctx: RegionFetchContext) => Promise<void>,
    ) =>
      work({
        stopToken: 'tok',
        isStale: () => false,
        statusCallback: () => {},
        callRpc() {
          throw new Error('callRpc is not stubbed in this test')
        },
        commitRegion: () => {},
      }),
  }
  await fetchEachRegion(self, NEEDED, {
    call: () => Promise.resolve({ regionTooLarge: true as const, bytes: 9e9 }),
    onResult: () => {},
    onComplete: () => {
      completed++
    },
  })
  expect(bytes).toHaveLength(1)
  expect(completed).toBe(1)
  expect(cancels).toEqual([1])
})
