import { isRegionRefused, measuredBytes } from '@jbrowse/core/rpc/byteBudget'
import { createStatusFanOut } from '@jbrowse/core/util'

import type { GateFetchState } from '../../shared/regionTooLargeUtils.ts'
import type { FetchContext } from './FetchMixin.ts'
import type { IndexedRegion } from './planRegionFetch.ts'
import type { RegionFetchContext } from './regionCommit.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What the three fan-out helpers below need a display to be. The two gate
 * members are `RegionTooLargeMixin`'s, which every display in this family
 * composes through `MultiRegionDisplayMixin` — they are here rather than in a
 * separate gated variant because the helpers commit the byte axis for every
 * display, and one that never passes a `byteLimit` measures nothing and commits
 * nothing.
 */
export interface FetchEachRegionModel extends IStateTreeNode {
  fetchRegions: (
    needed: IndexedRegion[],
    work: (ctx: RegionFetchContext) => Promise<void>,
  ) => Promise<void>
  gateFetchState: () => GateFetchState
  commitFetchBytes: (
    perRegionBytes: (number | undefined)[],
    issued: GateFetchState,
  ) => void
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
    ) => Promise<R | RegionTooLargeResult>
    onResult: (displayedRegionIndex: number, result: R) => void
    onComplete?: (issued: GateFetchState) => void
  },
) {
  // Captured before anything is issued, so the byte measurements this batch
  // brings back are judged against the viewport and the tier they were asked
  // for rather than whatever the view moved to during the round trip.
  const issued = self.gateFetchState()
  await self.fetchRegions(needed, async ctx => {
    // per-region guard, not one around the batch: a region that arrives before
    // the user moves on still commits
    const perRegion = fanOutStatus(ctx, needed.length)
    const results = await Promise.all(
      needed.map(async ({ region, displayedRegionIndex }, i) => {
        const result = await opts.call(
          region,
          perRegion[i]!,
          displayedRegionIndex,
        )
        // A refused region stored nothing, so neither the display's store nor
        // `loadedRegions` may claim it — the viewport would read as covered
        // against a payload nobody received. See RegionFetchContext.
        if (!ctx.isStale() && !isRegionRefused(result)) {
          opts.onResult(displayedRegionIndex, result)
          ctx.commitRegion(displayedRegionIndex)
        }
        return result
      }),
    )
    if (!ctx.isStale()) {
      self.commitFetchBytes(results.map(measuredBytes), issued)
      opts.onComplete?.(issued)
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
    call: (
      regions: Region[],
      ctx: FetchContext,
    ) => Promise<(R | RegionTooLargeResult)[]>
    onResult: (displayedRegionIndex: number, result: R) => void
    onComplete?: (issued: GateFetchState) => void
  },
) {
  const issued = self.gateFetchState()
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
        if (!isRegionRefused(result)) {
          opts.onResult(displayedRegionIndex, result)
          ctx.commitRegion(displayedRegionIndex)
        }
      })
      self.commitFetchBytes(results.map(measuredBytes), issued)
      opts.onComplete?.(issued)
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
 * a viewport that moved drops all of it, and a refusal refuses the set.
 */
export async function fetchRegionsBatched<R>(
  self: FetchEachRegionModel,
  regions: IndexedRegion[],
  opts: {
    call: (
      regions: IndexedRegion[],
      ctx: FetchContext,
    ) => Promise<R | RegionTooLargeResult>
    commit: (result: R) => void
  },
) {
  const issued = self.gateFetchState()
  await self.fetchRegions(regions, async ctx => {
    const result = await opts.call(regions, ctx)
    if (!ctx.isStale()) {
      self.commitFetchBytes([measuredBytes(result)], issued)
      // One payload covers the whole set, so a refusal refuses the set: nothing
      // is committed and nothing is marked loaded, for the reason spelled out
      // in `RegionFetchContext`.
      if (!isRegionRefused(result)) {
        opts.commit(result)
        for (const { displayedRegionIndex } of regions) {
          ctx.commitRegion(displayedRegionIndex)
        }
      }
    }
  })
}
