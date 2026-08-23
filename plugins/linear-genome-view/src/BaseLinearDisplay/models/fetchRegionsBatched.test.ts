/**
 * The monolithic helper: one call over the whole region set, one payload, one
 * commit, and every issued region marked loaded together.
 *
 * Its two callers are the ones whose worker answer cannot be split — variants'
 * `cellData` and MAF's per-batch sample union — so what this file pins is that
 * the batch is atomic in both directions: a viewport that moved commits
 * nothing, and a result that lands commits every region rather than the ones a
 * per-region helper would have matched up.
 *
 * The region list being the *argument* is the third: variants ignores the
 * plan's `needed` entirely and derives its own set from the mode, so `call` and
 * the commits have to name the same list or the display marks loaded a span it
 * never asked for.
 */
import { fetchRegionsBatched } from './MultiRegionDisplayMixin.ts'

import type { GateFetchState } from '../../shared/regionTooLargeUtils.ts'
import type { FetchContext } from './FetchMixin.ts'
import type { RegionFetchContext } from './regionCommit.ts'

const REGIONS = [
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
  loaded: number[] = [],
  bytes: (number | undefined)[][] = [],
) {
  return {
    gateFetchState: () => ISSUED,
    commitFetchBytes: (perRegionBytes: (number | undefined)[]) => {
      bytes.push(perRegionBytes)
    },
    fetchRegions: (
      _needed: typeof REGIONS,
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

test('one call over the whole set, one commit, every region loaded', async () => {
  const loaded: number[] = []
  const asked: number[][] = []
  const committed: string[] = []
  await fetchRegionsBatched(selfWith(fresh(), loaded), REGIONS, {
    call: regions => {
      asked.push(regions.map(r => r.displayedRegionIndex))
      return Promise.resolve('cellData')
    },
    commit: result => committed.push(result),
  })
  // the indices, not just the spans: variants sends `displayedRegionIndices`
  // alongside the regions so the worker can key its payload by them
  expect(asked).toEqual([[2, 5]])
  expect(committed).toEqual(['cellData'])
  expect(loaded).toEqual([2, 5])
})

// One guard, at the only granularity that exists here — there is one result, so
// a viewport that moved drops all of it rather than half a payload whose
// cross-region decision was made against a superseded set.
test('a viewport that moved commits nothing and marks nothing loaded', async () => {
  const loaded: number[] = []
  let committed = 0
  await fetchRegionsBatched(
    selfWith({ ...fresh(), isStale: () => true }, loaded),
    REGIONS,
    {
      call: () => Promise.resolve('cellData'),
      commit: () => {
        committed++
      },
    },
  )
  expect(committed).toBe(0)
  expect(loaded).toEqual([])
})

// `ctx` goes straight through, unlike the fan-out helpers' per-region slots:
// one call has no parallel siblings to aggregate a status bar with. MAF fans
// out inside its own `call` and opens its slots there.
test('passes the fetch ctx straight through to call', async () => {
  const ctx = fresh()
  const seen: FetchContext[] = []
  await fetchRegionsBatched(selfWith(ctx), REGIONS, {
    call: (_regions, callCtx) => {
      seen.push(callCtx)
      return Promise.resolve(undefined)
    },
    commit: () => {},
  })
  expect(seen).toHaveLength(1)
  expect(seen[0]!.stopToken).toBe(ctx.stopToken)
  expect(seen[0]!.statusCallback).toBe(ctx.statusCallback)
})

// One payload covers the set, so a refusal refuses the set. A refusal
// committed here would make every region read as covered against a payload
// nobody received: the plan answers `covered` forever, and since the ordinary
// fetch IS the gate's re-measure, nothing re-measures either. What the refusal
// does reach is the gate, which is what puts a size in the banner.
test('a refused batch commits nothing and marks nothing loaded, but its bytes reach the gate', async () => {
  const loaded: number[] = []
  const bytes: (number | undefined)[][] = []
  const refused = { regionTooLarge: true as const, bytes: 9e9 }
  const committed: unknown[] = []
  await fetchRegionsBatched(selfWith(fresh(), loaded, bytes), REGIONS, {
    call: () => Promise.resolve(refused),
    commit: result => committed.push(result),
  })
  expect(committed).toEqual([])
  expect(loaded).toEqual([])
  expect(bytes).toEqual([[9e9]])
})
