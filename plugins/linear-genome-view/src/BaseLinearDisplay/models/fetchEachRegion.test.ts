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

// `self` only has to supply `fetchRegions`, which normally rotates the stop
// token and applies the byte gate. Running `work` directly with a ctx the test
// controls isolates the guards from that machinery.
function selfWith(ctx: FetchContext, loaded: number[] = []) {
  return {
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
      stopToken: 'tok',
      isStale: () => false,
      statusCallback: () => {},
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
