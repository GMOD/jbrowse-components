/**
 * The batched counterpart to `fetchEachRegion`, which had no test of any kind.
 *
 * Two things it owns and nothing else did: the single `ctx.isStale()` guard
 * around the whole batch (a moved-on viewport skips both the commits and the
 * post-fetch step), and the length check that says an adapter answering a
 * different number of results than it was asked for is a bug rather than a
 * silent off-by-one in the pairing.
 *
 * The third is the one worth the file. `isRegionRefused` is what keeps a
 * refused region out of `loadedRegions`, and `loadedRegions` is the span
 * `isBlockCovered` judges the viewport against — so committing a refused region
 * makes the viewport read as covered against a payload nobody received. The
 * plan then answers `covered` on every later run, nothing refetches, and
 * because the ordinary fetch IS the gate's re-measure, nothing re-measures
 * either: frozen until reload, with nothing going red. See `regionCommit.ts`
 * for the whole rule.
 *
 * Both of this helper's callers are wiggle and `RenderWiggleData` has no
 * refusal path, so that branch is unreachable in the tree today. That is
 * exactly why it needs a test rather than why it does not: an edit hoisting the
 * commit out of the guard breaks nothing anyone can see.
 */
import { fetchAllRegions } from './MultiRegionDisplayMixin.ts'

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

// `self` supplies `fetchRegions`, which normally rotates the stop token, plus
// the gate's two commit members. Running `work` directly with a ctx the test
// controls isolates what this helper owns from that machinery.
function selfWith(
  ctx: FetchContext,
  loaded: number[],
  bytes: (number | undefined)[][] = [],
) {
  return {
    gateFetchState: () => ISSUED,
    commitFetchBytes: (perRegionBytes: (number | undefined)[]) => {
      bytes.push(perRegionBytes)
    },
    // these runners issue one call, so there is no sibling to cancel and
    // nothing here calls it — declared to satisfy the shared model shape
    cancelFetch: () => {
      throw new Error('a single-call runner has no batch to cancel')
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

function fresh(): FetchContext {
  return {
    stopToken: 'tok',
    isStale: () => false,
    statusCallback: () => {},
    // this suite hands `call` its own stub, so the envelope is never reached —
    // throwing says so rather than letting a future edit read an undefined RPC
    // as an empty answer
    callRpc() {
      throw new Error('callRpc is not stubbed in this test')
    },
  }
}

test('hands every needed region to one call, and commits each result', async () => {
  const loaded: number[] = []
  const asked: string[][] = []
  const results: [number, string][] = []
  let completed = 0
  await fetchAllRegions(selfWith(fresh(), loaded), NEEDED, {
    call: regions => {
      asked.push(regions.map(r => r.refName))
      return Promise.resolve(regions.map(r => `data:${r.refName}`))
    },
    onResult: (idx, result) => results.push([idx, result]),
    onComplete: () => {
      completed++
    },
  })
  // one call carrying both regions, which is the whole reason this helper is
  // not the per-region fan-out: BigWig coalesces adjacent on-disk blocks across
  // region boundaries, and N independent calls cannot
  expect(asked).toEqual([['ctgA', 'ctgB']])
  expect(results).toEqual([
    [2, 'data:ctgA'],
    [5, 'data:ctgB'],
  ])
  expect(loaded).toEqual([2, 5])
  expect(completed).toBe(1)
})

// The other half of "batched": `call` gets the fetch's own ctx, not a status
// slot of its own. `fetchEachRegion` fans the status callback out because its N
// parallel calls would otherwise clobber each other on the display's one status
// field; one call has nothing to aggregate with.
test('passes the fetch ctx straight through to call', async () => {
  const ctx = fresh()
  const seen: FetchContext[] = []
  await fetchAllRegions(selfWith(ctx, []), NEEDED, {
    call: (regions, callCtx) => {
      seen.push(callCtx)
      return Promise.resolve(regions.map(() => null))
    },
    onResult: () => {},
  })
  expect(seen).toHaveLength(1)
  expect(seen[0]!.stopToken).toBe(ctx.stopToken)
  expect(seen[0]!.statusCallback).toBe(ctx.statusCallback)
})

// One guard, not one per region — deliberately, and it is why this helper is
// separate rather than a mode on the other one: the batch commits its gate
// measurements atomically, so a viewport that moved while the single call was
// in flight has to drop the whole answer.
test('a viewport that moved commits nothing and skips the post-fetch step', async () => {
  const loaded: number[] = []
  const results: number[] = []
  let completed = 0
  await fetchAllRegions(
    selfWith({ ...fresh(), isStale: () => true }, loaded),
    NEEDED,
    {
      call: regions => Promise.resolve(regions.map(r => r.refName)),
      onResult: idx => results.push(idx),
      onComplete: () => {
        completed++
      },
    },
  )
  expect(results).toEqual([])
  expect(loaded).toEqual([])
  expect(completed).toBe(0)
})

describe('a region the worker refused', () => {
  const refused = { regionTooLarge: true as const, bytes: 9e9 }

  it('reaches the gate but neither the display store nor loadedRegions', async () => {
    const loaded: number[] = []
    const bytes: (number | undefined)[][] = []
    const results: [number, unknown][] = []
    let completed = 0
    await fetchAllRegions(selfWith(fresh(), loaded, bytes), NEEDED, {
      call: () => Promise.resolve([refused, 'data:ctgB']),
      onResult: (idx, result) => results.push([idx, result]),
      onComplete: () => {
        completed++
      },
    })
    // `onResult` is the payload path and a marker is not a payload; what the
    // refusal does reach is the gate, which is what raises the banner and what
    // lets it release once the user zooms
    expect(results).toEqual([[5, 'data:ctgB']])
    expect(bytes).toEqual([[9e9, undefined]])
    expect(loaded).toEqual([5])
    expect(completed).toBe(1)
  })

  it('does not take its neighbours down with it', async () => {
    const loaded: number[] = []
    await fetchAllRegions(selfWith(fresh(), loaded), NEEDED, {
      call: () => Promise.resolve(['data:ctgA', refused]),
      onResult: () => {},
    })
    expect(loaded).toEqual([2])
  })

  // A byte short-circuit returns before any features are counted, so it carries
  // `bytes` alone; a density refusal carries the index estimate it cleared as
  // well. The flag is the whole test, not what came with it.
  it('is refused whatever else the result carries', async () => {
    const loaded: number[] = []
    await fetchAllRegions(selfWith(fresh(), loaded), NEEDED, {
      call: () =>
        Promise.resolve([
          { regionTooLarge: true, featureCount: 4e6, bytes: 1 },
          { regionTooLarge: true },
        ]),
      onResult: () => {},
    })
    expect(loaded).toEqual([])
  })
})

// The pairing is positional — `results[i]` is `needed[i]` — so a short answer
// would silently attribute one region's data to another and mark it loaded
// under that region's span. It throws instead, and throws before anything is
// committed.
test('throws on a result count that does not match, committing nothing', async () => {
  const loaded: number[] = []
  const results: number[] = []
  await expect(
    fetchAllRegions(selfWith(fresh(), loaded), NEEDED, {
      call: () => Promise.resolve(['only-one']),
      onResult: idx => results.push(idx),
    }),
  ).rejects.toThrow('fetchAllRegions: adapter returned 1 results for 2 regions')
  expect(loaded).toEqual([])
  expect(results).toEqual([])
})
