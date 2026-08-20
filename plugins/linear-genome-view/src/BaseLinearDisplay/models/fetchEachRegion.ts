import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { createStatusFanOut } from '@jbrowse/core/util'

import type { FetchContext } from './FetchMixin.ts'
import type { RegionFetchContext } from './MultiRegionDisplayMixin.ts'
import type { IndexedRegion } from './planRegionFetch.ts'
import type { Region } from '@jbrowse/core/util'

interface FetchEachRegionModel {
  fetchRegions: (
    needed: IndexedRegion[],
    work: (ctx: RegionFetchContext) => Promise<void>,
  ) => Promise<void>
}

/**
 * One context per concurrent region, each carrying its own status slot, so the
 * N of them aggregate into a single Σcurrent/Σtotal bar rather than
 * last-writer-wins on the display's one status field.
 *
 * A copy of the ctx rather than a separate `slot()` on it because a display
 * should not have to know which kind of context it holds: the field is called
 * `statusCallback` in both, and `statusCallback: ctx.statusCallback` at the RPC
 * call site is correct in the fan-out and in the batched case alike. Displays
 * used to reach back to the model for `makeRegionStatusCallback(index)`, and
 * the whole hazard was that forgetting to looked exactly like remembering to.
 *
 * The fan-out's lifetime is this batch's: slots are never reclaimed, and the
 * batch is the thing that ends.
 */
function fanOutStatus<C extends FetchContext>(ctx: C, count: number): C[] {
  const slot = createStatusFanOut(ctx.statusCallback)
  return Array.from({ length: count }, () => ({
    ...ctx,
    statusCallback: slot(),
  }))
}

/**
 * The per-region fan-out on its own, without the `fetchRegions` wrapper: issue
 * `call` for every needed region in parallel and return the results paired with
 * their `displayedRegionIndex`, in `needed` order. Callers get one collected
 * array to commit from, which is what a cross-region decision needs (MAF picks
 * the sample set from whichever region actually discovered samples).
 *
 * Use this only inside a `fetchRegions` work callback you already own — it does
 * no staleness checking of its own, because the *caller* decides the
 * granularity: {@link fetchEachRegion} guards per region so an early result
 * still commits, while a display that commits atomically guards once around the
 * whole batch. Prefer `fetchEachRegion` unless you need the collected array or
 * a concurrent side-fetch under the same stop token.
 */
export function callEachRegion<R>(
  needed: IndexedRegion[],
  ctx: FetchContext,
  call: (
    region: Region,
    ctx: FetchContext,
    displayedRegionIndex: number,
  ) => Promise<R>,
): Promise<{ displayedRegionIndex: number; result: R }[]> {
  const perRegion = fanOutStatus(ctx, needed.length)
  return Promise.all(
    needed.map(async ({ region, displayedRegionIndex }, i) => ({
      displayedRegionIndex,
      result: await call(region, perRegion[i]!, displayedRegionIndex),
    })),
  )
}

/**
 * Run one RPC `call` per needed region, in parallel, under a single
 * stale-guarded `fetchRegions` wrapper. Centralizes the fan-out plus the two
 * `ctx.isStale()` guards every per-region display repeated by hand: skip a
 * region's commit, and skip the post-fetch step, once the user has moved on.
 * Forgetting either guard is a stale-data write, so this is a correctness
 * primitive as much as a dedup.
 *
 * `call` keeps the literal RPC method name at the call site, so its typed args
 * (`RpcCallArgs<M>`) and return (`RpcCallReturn<M>`) survive — `R` is inferred
 * from `call` and flows into `onResult` with no cast. The helper owns the
 * control flow; the display still owns its typed payload, into which it injects
 * `statusCallback: ctx.statusCallback` — the ctx `call` is handed, which is that
 * region's own status slot, so the parallel per-region fetches aggregate into
 * one bar instead of clobbering each other.
 * A display whose fetch genuinely diverges — canvas (prune + fold a too-large
 * result), MAF (a concurrent annotation fetch + a cross-region sample pick),
 * alignments (chain payload) — keeps its own `fetchNeeded` and calls
 * `fetchRegions` directly. MAF and alignments then reach for
 * {@link callEachRegion} for the fan-out; `LinearBasicDisplay` does not, and
 * should not — its per-region call already returns the `displayedRegionIndex`
 * inside its own result shape, so the pairing `callEachRegion` exists to provide
 * would be a second wrapper to unwrap. Its plain `Promise.all` is the right
 * answer there, and the single `ctx.isStale()` around the batch is deliberate:
 * it commits the batch's gate measurements atomically.
 */
export async function fetchEachRegion<R>(
  self: FetchEachRegionModel,
  needed: IndexedRegion[],
  opts: {
    call: (
      region: Region,
      ctx: FetchContext,
      displayedRegionIndex: number,
    ) => Promise<R>
    onResult: (displayedRegionIndex: number, result: R) => void
    onComplete?: () => void
  },
) {
  await self.fetchRegions(needed, async ctx => {
    // per-region guard, not one around the batch: a region that arrives before
    // the user moves on still commits
    const perRegion = fanOutStatus(ctx, needed.length)
    await Promise.all(
      needed.map(async ({ region, displayedRegionIndex }, i) => {
        const result = await opts.call(
          region,
          perRegion[i]!,
          displayedRegionIndex,
        )
        if (!ctx.isStale()) {
          opts.onResult(displayedRegionIndex, result)
          // beside the store, and skipped for a region the worker refused for
          // size — `loadedRegions` must describe data that exists, or the
          // viewport reads as covered against a payload nobody received. See
          // RegionFetchContext.
          if (!isRegionRefused(result)) {
            ctx.commitRegion(displayedRegionIndex, region)
          }
        }
      }),
    )
    if (!ctx.isStale()) {
      opts.onComplete?.()
    }
  })
}

/**
 * Batched counterpart to {@link fetchEachRegion}: hands every needed region to
 * a single RPC `call`, which returns one result per region aligned to the input
 * order (`results[i]` ↔ `needed[i]`). Use when the adapter serves all regions in
 * one pass more efficiently than N independent calls — e.g. BigWig coalesces
 * adjacent on-disk blocks across region boundaries (`getFeaturesAsArraysMulti`),
 * which the per-region fan-out can't exploit; collapsed-intron views (many small
 * regions on one refName) benefit most. The single `ctx.isStale()` guard is the
 * same correctness primitive as the per-region helper — a moved-on viewport
 * skips both the commit and the post-fetch step. `call` keeps the literal RPC
 * method name at the call site so its typed args/return survive and `R` flows
 * into `onResult` with no cast.
 */
export async function fetchAllRegions<R>(
  self: FetchEachRegionModel,
  needed: IndexedRegion[],
  opts: {
    call: (regions: Region[], ctx: FetchContext) => Promise<R[]>
    onResult: (displayedRegionIndex: number, result: R) => void
    onComplete?: () => void
  },
) {
  await self.fetchRegions(needed, async ctx => {
    const results = await opts.call(
      needed.map(n => n.region),
      ctx,
    )
    if (!ctx.isStale()) {
      if (results.length !== needed.length) {
        throw new Error(
          `fetchAllRegions: adapter returned ${results.length} results for ${needed.length} regions`,
        )
      }
      needed.forEach(({ displayedRegionIndex, region }, i) => {
        const result = results[i]!
        opts.onResult(displayedRegionIndex, result)
        if (!isRegionRefused(result)) {
          ctx.commitRegion(displayedRegionIndex, region)
        }
      })
      opts.onComplete?.()
    }
  })
}
