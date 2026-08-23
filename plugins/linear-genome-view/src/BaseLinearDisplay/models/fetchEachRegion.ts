import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { createStatusFanOut } from '@jbrowse/core/util'

import type { FetchContext } from './FetchMixin.ts'
import type { IndexedRegion } from './planRegionFetch.ts'
import type { RegionFetchContext } from './regionCommit.ts'
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
 * Use this only inside a `call` one of the wrappers below hands you — it does no
 * staleness checking of its own, because the *caller* decides the granularity:
 * {@link fetchEachRegion} guards per region so an early result still commits,
 * while {@link fetchRegionsBatched} guards once around the whole batch. Its one
 * caller is MAF, which needs both the collected array (the sample set is a
 * cross-region pick) and a concurrent side-fetch under the same stop token.
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
 * A display with a batch-wide step after the regions land keeps it in
 * `onComplete`, which runs once and under the same guard — canvas's two feature
 * displays commit their gate measurements there. That is the whole of what used
 * to justify a hand-rolled `Promise.all`: the per-region commits and the
 * atomic one are different granularities, not different loops.
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
            ctx.commitRegion(displayedRegionIndex)
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
      needed.forEach(({ displayedRegionIndex }, i) => {
        const result = results[i]!
        opts.onResult(displayedRegionIndex, result)
        if (!isRegionRefused(result)) {
          ctx.commitRegion(displayedRegionIndex)
        }
      })
      opts.onComplete?.()
    }
  })
}

/**
 * The monolithic counterpart to the other two: one `call` over the whole region
 * set answering **one** payload that covers all of them, one `commit`, and then
 * every issued region marked loaded together. Where {@link fetchAllRegions}
 * batches the request and keeps the per-region results apart, this is for the
 * displays whose worker returns a value that cannot be split — multi-sample
 * variant's `cellData`, MAF's per-batch sample union — so the whole set is held
 * or none of it is.
 *
 * **The region list is the argument, not `needed`.** A display on this helper
 * decides its own set: variants ignores the plan's `needed` entirely and derives
 * one from the mode (`fetchRegionsForMode`), because the columns of a matrix
 * lay out across the whole visible width and a partial refetch has no meaning.
 * Whatever list is passed is both what `call` receives and what the commits name,
 * so the two cannot come apart.
 *
 * The single `ctx.isStale()` guard is the same correctness primitive the other
 * helpers own, at the only granularity that exists here: there is one result, so
 * a viewport that moved drops all of it. A refused result is delivered to
 * `commit` and marks nothing loaded, for the reason spelled out in
 * `RegionFetchContext`.
 */
export async function fetchRegionsBatched<R>(
  self: FetchEachRegionModel,
  regions: IndexedRegion[],
  opts: {
    call: (regions: IndexedRegion[], ctx: FetchContext) => Promise<R>
    commit: (result: R) => void
  },
) {
  await self.fetchRegions(regions, async ctx => {
    const result = await opts.call(regions, ctx)
    if (!ctx.isStale()) {
      opts.commit(result)
      if (!isRegionRefused(result)) {
        for (const { displayedRegionIndex } of regions) {
          ctx.commitRegion(displayedRegionIndex)
        }
      }
    }
  })
}
