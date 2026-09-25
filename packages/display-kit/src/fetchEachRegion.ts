import { isRegionRefused, measuredBytes } from '@jbrowse/core/rpc/byteBudget'
import { fanOutStatus } from '@jbrowse/core/util/fetchContext'
import { runInAction } from 'mobx'

import {
  measurementOf,
  measurementOfEach,
  openGateCommit,
} from './gateCommit.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { IndexedRegion } from './planRegionFetch.ts'
import type { RegionFetchContext, RegionPayload } from './regionCommit.ts'
import type { GateCommitHost, GateFetchState } from './regionTooLargeUtils.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util/types/data'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What the three fan-out helpers below need a display to be. The two gate
 * members are `RegionTooLargeMixin`'s, which every display in this family
 * composes through `MultiRegionDisplayMixin` — required here rather than in a
 * separate gated variant because the helpers commit the byte axis for every
 * display, and one that never passes a `byteLimit` measures nothing and commits
 * nothing.
 */
export interface FetchEachRegionModel extends IStateTreeNode, GateCommitHost {
  fetchRegions: (
    needed: IndexedRegion[],
    work: (ctx: RegionFetchContext) => Promise<void>,
  ) => Promise<void>
  /**
   * `FetchMixin`'s, which every display on these helpers composes.
   *
   * It carries a contract with `fetchRegions` that the types cannot state:
   * calling this makes the running work callback's `ctx.isStale()` answer true.
   * {@link gateBatch} deliberately does not depend on that for its own commit
   * count, so a cancel that left the guard open would not corrupt the gate —
   * but the siblings still in flight would go on storing payloads and marking
   * regions loaded behind a banner that hides them.
   */
  cancelFetch: () => void
}

/**
 * The per-region fan-out on its own, without the `fetchRegions` wrapper: issue
 * `call` for every needed region in parallel and return the results paired with
 * their `displayedRegionIndex`, in `needed` order. Callers get one collected
 * array to commit from, which a cross-region decision needs (MAF picks the
 * sample set from whichever region actually discovered samples).
 *
 * Use this only inside a `call` one of the wrappers below hands you — it does no
 * staleness checking of its own, because the *caller* decides the granularity:
 * {@link fetchEachRegion} guards per region so an early result still commits,
 * while {@link fetchRegionsBatched} guards once around the whole batch. Its one
 * caller is MAF, which needs both the collected array (the sample set is a
 * cross-region pick) and a concurrent side-fetch under the same signal.
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
 * {@link openGateCommit} plus the two things a per-region fan-out adds to it:
 * the measurement it derives rather than reads, and the cancel a refusal owes.
 *
 * **This runner derives `partial` from its own landed count**, where a runner
 * handed one payload can only read the claim off it. The number is the max over
 * whichever regions won the race rather than over the set — but only when some
 * region really did not report: a refusal from the last region to land, and
 * every refusal on a single-region display, measured the whole set and is
 * ordinary evidence.
 *
 * **A refusal commits before it cancels.** The other order strands the verdict:
 * the aborts reject the batch, the commit never lands, `nextGateState` stamps
 * `gateMeasuredViewportKey` only on a committed measurement, so
 * `gateSkipsMeasuredViewport` reads false and the plan re-issues every region
 * off the cancel's own generation bump — forever. `refuse()` is one call, so
 * there is no order to invert, and the commit-at-most-once half is
 * `openGateCommit`'s.
 */
function gateBatch(
  self: FetchEachRegionModel,
  size: number,
  onComplete?: (issued: GateFetchState) => void,
) {
  const gate = openGateCommit(self)
  const bytes: (number | undefined)[] = new Array(size)
  let landed = 0
  const finish = (refused: boolean) => {
    // a copy, because a refusal commits while siblings are still landing and
    // would otherwise hand the gate an array that goes on changing under it
    if (gate.commit({ perRegionBytes: [...bytes], partial: landed < size })) {
      onComplete?.(gate.issued)
      if (refused) {
        self.cancelFetch()
      }
    }
  }
  return {
    measured(i: number, result: unknown) {
      landed++
      bytes[i] = measuredBytes(result)
    },
    /** This region is over budget, so the batch is answered: stop the rest. */
    refuse: () => {
      finish(true)
    },
    /** Every region landed. */
    settle: () => {
      finish(false)
    },
  }
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
 * `onComplete`, which runs once and under the same guard — the base canvas
 * display commits its gate measurements there. That is the whole of what used
 * to justify a hand-rolled `Promise.all`: the per-region commits and the
 * atomic one are different granularities, not different loops.
 *
 * **The first refusal ends the batch** — the gate is a display-wide max, so no
 * sibling can change a refusal or be drawn under the banner it raises. The two
 * rules that makes the batch owe are {@link gateBatch}'s, not this loop's.
 * What they measured is in agent-docs/reference/REGION_TOO_LARGE.md.
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
    /**
     * What this region stores: the return is what the helper commits into
     * the per-region store, beside the span and the fetch inputs. A display
     * shapes its payload here and holds no map of its own.
     */
    onResult: (
      displayedRegionIndex: number,
      result: R,
      region: Region,
    ) => RegionPayload
    onComplete?: (issued: GateFetchState) => void
  },
) {
  const batch = gateBatch(self, needed.length, opts.onComplete)
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
        batch.measured(i, result)
        if (ctx.isStale()) {
          return
        }
        if (isRegionRefused(result)) {
          // A refused region stored nothing, so neither the display's store nor
          // `loadedRegions` may claim it — the viewport would read as covered
          // against a payload nobody received. See RegionFetchContext.
          batch.refuse()
        } else {
          ctx.commitRegion(
            displayedRegionIndex,
            opts.onResult(displayedRegionIndex, result, region),
          )
        }
      }),
    )
    if (!ctx.isStale()) {
      batch.settle()
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
 *
 * **Its refusal granularity is the region, and it is the third of three.**
 * {@link fetchEachRegion} stops the batch at the first refusal because N round
 * trips are still in flight; {@link fetchRegionsBatched} refuses the one
 * payload it asked for; this one already holds every result, so it stores the
 * regions that fit and drops the ones that did not, with nothing left to
 * cancel. No gated display is on it today — BigWig implements no
 * `getRegionByteSize` — so which of the three a gated one should want is the
 * open call in
 * agent-docs/ideas/waiting-on-a-call/per-region-banner-for-a-mixed-region-set.md,
 * and the answer is a property of the banner rather than of this loop.
 */
export async function fetchAllRegions<R>(
  self: FetchEachRegionModel,
  needed: IndexedRegion[],
  opts: {
    call: (
      regions: Region[],
      ctx: FetchContext,
    ) => Promise<(R | RegionTooLargeResult)[]>
    /** Stores the payload and returns it — see {@link fetchEachRegion}. */
    onResult: (displayedRegionIndex: number, result: R) => RegionPayload
    onComplete?: (issued: GateFetchState) => void
  },
) {
  const gate = openGateCommit(self)
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
          ctx.commitRegion(
            displayedRegionIndex,
            opts.onResult(displayedRegionIndex, result),
          )
        }
      })
      gate.commit(measurementOfEach(results))
      opts.onComplete?.(gate.issued)
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
 *
 * What each region stores is `payloadFor`'s slice of the batch, and by default
 * the batch itself: variants reads its own per-batch holder and answers
 * `regionHasData` itself, while MAF's batch is one result per region and the
 * store holds each region's own.
 */
export async function fetchRegionsBatched<R extends RegionPayload>(
  self: FetchEachRegionModel,
  regions: IndexedRegion[],
  opts: {
    call: (
      regions: IndexedRegion[],
      ctx: FetchContext,
    ) => Promise<R | RegionTooLargeResult>
    commit: (result: R) => void
    payloadFor?: (displayedRegionIndex: number, result: R) => RegionPayload
  },
) {
  const gate = openGateCommit(self)
  const payloadFor = opts.payloadFor ?? ((_, result) => result)
  await self.fetchRegions(regions, async ctx => {
    const result = await opts.call(regions, ctx)
    if (!ctx.isStale()) {
      // One transaction, so no observer sees the display's payload beside the
      // spans the previous batch marked loaded — an export gate did, after a
      // pan left the view inside the old span and off the new one.
      runInAction(() => {
        gate.commit(measurementOf(result))
        // One payload covers the whole set, so a refusal refuses the set:
        // nothing is committed and nothing is marked loaded, for the reason
        // spelled out in `RegionFetchContext`.
        if (!isRegionRefused(result)) {
          opts.commit(result)
          for (const { displayedRegionIndex } of regions) {
            ctx.commitRegion(
              displayedRegionIndex,
              payloadFor(displayedRegionIndex, result),
            )
          }
        }
      })
    }
  })
}
