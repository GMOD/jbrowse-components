import {
  assertDisplayContract,
  makeRetryContractCheck,
  takeFetchFunnelEntered,
} from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import { getTrackAssemblyNames } from '@jbrowse/core/util/tracks'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

import {
  autorunOnReadyView,
  makeSettingsLoopGuard,
  onDisplayedRegionsChange,
} from './displayAutoruns.ts'
import { installClearHoverOnViewportChange } from './installClearHoverOnViewportChange.ts'
import {
  planRegionFetch,
  regionAssemblyMismatchMessage,
  retryOutcomeForPlan,
} from './planRegionFetch.ts'

import type { IndexedRegion } from './planRegionFetch.ts'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/** The debounce on `FetchVisibleRegions`, in ms. */
export const FETCH_VISIBLE_REGIONS_DELAY = 600

/**
 * What the per-region fetch autoruns read and call. Duck-typed rather than the
 * mixin's own `Instance` type: `MultiRegionDisplayMixin` composes this
 * installer, so a nominal type would be circular, and naming the members here
 * is also the list of what the autoruns are allowed to touch.
 */
export interface PerRegionFetchHost extends IStateTreeNode {
  error: unknown
  fetchCanceled: boolean
  fetchGeneration: number
  reloadCounter: number
  isLoading: boolean
  loadingSuppressed: boolean
  awaitingPrerequisite: boolean
  gateSkipsMeasuredViewport: boolean
  /** read by the hover-clear reaction, which the too-large banner also fires */
  regionTooLarge: boolean
  loadedRegions: { get: (displayedRegionIndex: number) => Region | undefined }
  rpcPropsCacheKey: string
  isCacheValid: (displayedRegionIndex: number) => boolean
  fetchNeeded: (needed: IndexedRegion[]) => void
  setError: (error?: unknown) => void
  clearAllRpcData: () => void
  clearByteEstimate: () => void
  clearHoveredFeature: () => void
}

/**
 * Install the per-region fetch lifecycle: `DisplayedRegionsChange`,
 * `FetchVisibleRegions`, `SettingsInvalidate`,
 * `ClearBlockingStateOnViewportChange`, and the stored-hover clear.
 *
 * The third fetch-family installer, beside `installGlobalFetchAutorun` and
 * `installComparativeFetchAutorun`. It is a function rather than an inline
 * `afterAttach` body for the reason those two are: **what this file decides is
 * the MobX dependency set**, and that is the half no pure function can express.
 * `planRegionFetch` owns the decision; this owns which reads are tracked, which
 * are `untracked` perf guards, and which sit behind a thunk so an early bail-out
 * does not subscribe to the viewport. `installPerRegionFetchAutoruns.test.ts`
 * is what fails when one of those moves.
 */
export function installPerRegionFetchAutoruns(self: PerRegionFetchHost) {
  // Dev-only: the contracts no type expresses (`afterAttach` not being chained
  // to super, `isCacheValid`/`rpcProps` being views). Runs before anything is
  // installed so a double-install is reported rather than merely happening.
  assertDisplayContract(self)

  // The other half of the same doctrine: the trigger reads below guarantee
  // `reload()` re-RUNS the fetch autorun, not that the run reaches a fetch. The
  // global family has had this since arc shipped a dead Retry; this family is
  // three times the size and had nothing.
  const noteFetchAutorunRun = makeRetryContractCheck(self)

  // Clear loaded data whenever the displayed-regions list changes, through the
  // same `onDisplayedRegionsChange` helper the two displays outside this family
  // (LD, arc) use — one spelling of the trigger, so this family's clear can't
  // come to mean something different from theirs. Fires once at mount as a
  // harmless no-op (nothing loaded yet).
  //
  // The cached byte estimate goes with it. displayedRegionIndex is reused
  // across chromosomes, so a stale estimate describes the previous
  // chromosome's numbers, and the banner would quote them at the new region
  // for the settled cycle it takes to re-measure. Only that long — the new
  // region moves `gateViewport.key`, so `gateMeasurementStale` lets the fetch
  // through and the next measurement corrects it. clearAllRpcData deliberately
  // leaves the estimate alone (no banner flicker on an ordinary
  // viewport-change clear), which is why the drop lives in this autorun rather
  // than in that action.
  //
  // One of two drops, not the only one: RegionTooLargeMixin's own
  // ClearByteEstimateOnTierSwap does the same when a display that swaps
  // adapters by zoom crosses tiers. Same rule on the other axis — the estimate
  // is about a fetch, and both change which fetch that is.
  //
  // #autorun `view.displayedRegions` changes | `clearAllRpcData()` **+ `clearByteEstimate()`** — one of the two places the cached byte estimate is dropped (the other is a tier swap)
  onDisplayedRegionsChange(
    self,
    () => {
      self.clearAllRpcData()
      self.clearByteEstimate()
    },
    'DisplayedRegionsChange',
  )

  // Fetch data when the visible viewport isn't covered by loaded data, with an
  // explicit buffer so scrolling doesn't blank the fringe.
  //
  // #autorun the viewport, `fetchGeneration` after a fetch ends, or `reloadCounter` on a user retry | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. While `regionTooLarge` holds it runs that same fetch once per settled viewport — the fetch stops at whichever gate rejected it, and there is no measurement-only path. Skipped while `error` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized
  autorunOnReadyView(
    self,
    view => {
      // Both pure triggers, read unconditionally and above every gate — see
      // ARCHITECTURE.md §"The global-fetch trigger list must be read
      // unconditionally". A fetch bumps `fetchGeneration` at every end;
      // `reload()` normally re-fires this through `clearAllRpcData`'s bump, but
      // an override that clears nothing would then not re-run the body at all,
      // and a dead button nobody re-runs is one the check below never gets a run
      // to judge.
      void self.fetchGeneration
      void self.reloadCounter

      const plan = planRegionFetch({
        error: self.error,
        fetchCanceled: self.fetchCanceled,
        gateSkipsMeasuredViewport: self.gateSkipsMeasuredViewport,
        // untracked: isLoading flips at fetch start, and tracking it would
        // re-fire this autorun mid-fetch. `fetchGeneration` at fetch end is
        // the real re-trigger.
        isLoading: () => untracked(() => self.isLoading),
        // tracked, and behind a thunk: `minimized` is what the display's
        // `isMinimized` getter resolves to, so un-minimizing re-fires this and
        // the fetch resumes — while a minimized track stays off the viewport's
        // dependency set below and so does not wake on every pan.
        minimized: () => getContainingTrack(self).minimized,
        sources: () => {
          const { assemblyManager } = getSession(self)
          return {
            trackAssemblyNames: getTrackAssemblyNames(getContainingTrack(self)),
            hasAssemblyName: (trackName, regionName) =>
              !!assemblyManager.get(trackName)?.hasName(regionName),
            visibleRegions: view.visibleRegions,
            bufferedVisibleRegions: view.bufferedVisibleRegions,
            // untracked: populating loadedRegions would re-fire this autorun,
            // and the fetchGeneration bump after setLoadedRegion is the signal
            loadedRegion: idx => untracked(() => self.loadedRegions.get(idx)),
            isCacheValid: idx => self.isCacheValid(idx),
          }
        },
      })

      if (plan.kind === 'assemblyMismatch') {
        self.setError(new Error(regionAssemblyMismatchMessage(plan)))
      }

      // One classification for the whole body, off the plan's own reason —
      // `retryOutcomeForPlan` says why each answers (or defers) an outstanding
      // `reload()`. A `fetch` plan answers nothing yet, because reaching
      // `fetchNeeded` is not reaching `fetchRegions`.
      const outcome = retryOutcomeForPlan(plan)
      if (outcome) {
        noteFetchAutorunRun(outcome)
        return
      }
      if (plan.kind !== 'fetch') {
        return
      }

      // Cleared first so the read below can only see this call's entry.
      takeFetchFunnelEntered(self)
      // Not awaited — and the classification depends on that. The override's
      // synchronous prefix has run by the time it hands back a promise, and
      // reaching `fetchRegions` is what every one of them does there.
      self.fetchNeeded(plan.needed)
      noteFetchAutorunRun(takeFetchFunnelEntered(self) ? 'fetched' : 'declined')
    },
    { name: 'FetchVisibleRegions', delay: FETCH_VISIBLE_REGIONS_DELAY },
  )

  // Re-fetch when the RPC payload changes. The cache key is what rpcProps()
  // *returns*, not what building it reads — see the `rpcPropsCacheKey` getter.
  //
  // #autorun `rpcPropsCacheKey`, the serialized `rpcProps()` return | `clearAllRpcData()`. Installed only when the display defines `rpcProps()`
  if ((self as { rpcProps?: () => unknown }).rpcProps) {
    const loopGuard = makeSettingsLoopGuard('SettingsInvalidate')
    autorunOnReadyView(
      self,
      () => {
        void self.rpcPropsCacheKey
        loopGuard()
        self.clearAllRpcData()
      },
      { name: 'SettingsInvalidate' },
    )
  }

  // When the viewport moves while an error or a canceled fetch is set, clear so
  // the fetch autorun retries. (The too-large gate is derived — a pure function
  // of the last measurement — so it clears on the next one and needs no clear
  // here; only the terminal error/cancel states, which are imperative flags,
  // do.) Reads them untracked so setting them doesn't trigger this autorun to
  // immediately wipe them — only the viewport read should fire it.
  //
  // #autorun `view.visibleRegions` | `clearAllRpcData()` when `error` or `fetchCanceled` is set, so the fetch autorun retries. Not `regionTooLarge`, which is derived and re-measured by the fetch autorun itself
  autorunOnReadyView(
    self,
    view => {
      void view.visibleRegions
      if (untracked(() => self.fetchCanceled || self.error)) {
        self.clearAllRpcData()
      }
    },
    { name: 'ClearBlockingStateOnViewportChange' },
  )

  // Drop a stored hover whenever the content it names moves or goes away.
  // Installed here rather than per display because the six displays that store
  // one all reach it through this foundation, and the failure mode is omission:
  // a seventh that forgets keeps naming what USED to be under the cursor, with
  // no error anywhere. Clears through `BaseDisplay.clearHoveredFeature`, whose
  // default is a no-op, so a display deriving its hover pays nothing.
  addDisposer(self, installClearHoverOnViewportChange(self))
}
