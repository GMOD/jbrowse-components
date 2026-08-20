import { getType } from '@jbrowse/mobx-state-tree'

import type { FetchContext } from './FetchMixin.ts'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// This ESM package builds without @types/node, but consuming bundlers still
// string-replace `process.env.NODE_ENV`, so keep the reference and give it a
// minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

/**
 * A region a fetch stored, and which fetch stored it.
 *
 * One value rather than a `Region` map beside a key map: every operation
 * touched both — one `set`, one `delete`, one `clear` — so keeping them apart
 * bought nothing and cost three places to keep in step, with no reader-side
 * check to catch a slip. It is the same two-records-of-one-fact shape that made
 * a refused region read as covered, one level down, and the fix is the same:
 * store the fact once.
 *
 * Extending `Region` rather than wrapping one is what makes that free: the
 * twenty-odd readers that want the span keep reading it directly, and only
 * `isCacheValid` looks at the key.
 */
export interface LoadedRegion extends Region {
  /** the `regionFetchKey` the fetch that stored this region was issued under */
  fetchKey: string
}

/**
 * A {@link FetchContext} plus the one thing a per-region fetch can do that a
 * global one cannot: record that a region is loaded.
 *
 * **`commitRegion` is called where the payload is stored, and that is the whole
 * rule.** `loadedRegions` is the span `isBlockCovered` judges the viewport
 * against, so it has to describe data that exists. It used to be written by
 * `fetchRegions` from the region list it *asked* for, once the work callback
 * returned — a second writer, working off the request while the display worked
 * off the response, and the two disagree exactly when a fetch stores less than
 * it asked for. A region refused by the in-fetch size gate then read as covered
 * against data it never received: the plan answered `covered` on every later
 * run, so nothing refetched and — because the ordinary fetch IS the gate's
 * re-measure — nothing re-measured either. On the byte axis that is a banner no
 * zoom can release; on the density axis, which falls with `bpPerPx`, the banner
 * goes and the display paints the previous, narrower payload across the whole
 * viewport with nothing on screen to say so.
 *
 * **The span is not a parameter**, and that is the half that makes the rule
 * structural rather than advisory: `commitRegion` names an index, and
 * `fetchRegions` resolves it against the very `needed` list it issued. A display
 * can say "this region landed" and nothing else — it cannot name a span, so it
 * cannot claim one the fetch never asked for. What is left to get wrong is
 * forgetting the call, which costs a redundant refetch; the direction that cost
 * a display frozen until reload is now unreachable.
 *
 * The global family reached the same property from the other side.
 * `GlobalFetchPhases.commit` is a phase the skeleton invokes only when `run`
 * produced a result, so nothing is recorded from the request there either.
 * Per-region cannot simply adopt those phases: four displays make a
 * cross-region decision mid-fetch (a batched gate commit, a sample-set union, a
 * tag-map union, one RPC serving every region), and a strict per-region
 * `run`/`commit` has nowhere to put it. Same invariant, two shapes, and the
 * reason they differ is that one dataset arrives once and N regions stream.
 */
export interface RegionFetchContext extends FetchContext {
  /**
   * Record that this region's data is now held. Over the span `fetchRegions`
   * asked for it, resolved from `needed` — see above for why that is not the
   * caller's to choose. Ignored once the fetch is stale, which is the same
   * guard the write has always had, moved to where the write happens.
   */
  commitRegion: (displayedRegionIndex: number) => void
}

/**
 * The two dev-only checks on `commitRegion`'s contract, as a pair of no-ops in
 * production — the same shape as `makeSettingsLoopGuard` in `displayAutoruns`,
 * and for the same reason: the mechanism reads as mechanism, and what a
 * violation costs is stated once where the check is rather than inline where it
 * fires.
 *
 * They cover the two directions a commit can be wrong, and only one of them is
 * still reachable by construction:
 *
 * - **naming a region the fetch never asked for**, which has no honest span, so
 *   the commit is dropped. Only a display doing its own bookkeeping can manage
 *   it.
 * - **never committing at all**, which spins rather than freezing: nothing reads
 *   as covered, the plan asks again, the fetch ends, `fetchGeneration` bumps,
 *   and the autorun re-fires. Loud in a network tab and invisible in a test,
 *   which is the shape a check is worth having for.
 *
 * The second is counted rather than reported on sight: a fetch can legitimately
 * store nothing while `regionTooLarge` is still false for one settled cycle,
 * because the worker gates on the live `bpPerPx` and the main-thread verdict
 * reads the debounced one. That resolves within a debounce; a missing call does
 * not.
 */
export function makeCommitChecks(self: IStateTreeNode) {
  if (process.env.NODE_ENV === 'production') {
    return { unknownRegion: () => {}, fetchEnded: () => {} }
  }
  let emptyFetchRuns = 0
  return {
    unknownRegion(displayedRegionIndex: number, issued: Iterable<number>) {
      console.error(
        `[jbrowse display contract] commitRegion(${displayedRegionIndex}) names ` +
          `a region this fetch did not ask for (it issued ` +
          `${[...issued].join(', ') || 'none'}), so nothing was marked loaded. ` +
          `See RegionFetchContext.`,
      )
    },
    fetchEnded({ committed, gated }: { committed: number; gated: boolean }) {
      emptyFetchRuns = committed === 0 && !gated ? emptyFetchRuns + 1 : 0
      if (emptyFetchRuns === 3) {
        console.error(
          `[jbrowse display contract] ${getType(self).name}: three fetches in a ` +
            `row stored data for no region and nothing is gating them, so the ` +
            `plan will keep asking for the same regions. A work callback that ` +
            `stores a payload must call ` +
            `\`ctx.commitRegion(displayedRegionIndex)\` beside the store — see ` +
            `RegionFetchContext.`,
        )
      }
    },
  }
}
