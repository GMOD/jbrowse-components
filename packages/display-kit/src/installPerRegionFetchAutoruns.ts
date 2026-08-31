import {
  assertDisplayContract,
  makeRetryContractCheck,
  takeFetchStarted,
} from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import { getContainingTrack, getSession } from '@jbrowse/core/util/mstUtils'
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
import type { Region } from '@jbrowse/core/util/types/data'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

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
  fetchInert: boolean
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
 * `planRegionFetch` owns the decision; this owns which reads are tracked and
 * which sit behind a thunk so an early bail-out does not subscribe to the
 * viewport. `installPerRegionFetchAutoruns.test.ts` is what fails when one of
 * those moves, and its last block states the whole set per state.
 *
 * `untracked` is allowed on two grounds only: a read the body's own effect
 * writes (`ClearBlockingStateOnViewportChange` clears the flags it reads, so
 * tracking them would re-fire it off `setError` and wipe the flag before any
 * viewport change), and a contract check that must not alter the production
 * dependency set. Anything else was a perf guard, and the two this file carried
 * (`isLoading`, `loadedRegions`) were measured on 2026-08-23 and removed: a
 * fetch shorter than the 600 ms debounce coalesces the flip into the run
 * `fetchGeneration` already owes, and a longer one costs one idle run of the
 * plan mid-fetch. Two runs per fetch cycle either way, three past the debounce.
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
  // The cached byte estimate is not cleared here: `RegionTooLargeMixin`'s own
  // `afterAttach` drops it on the same trigger, beside the tier swap.
  //
  // #autorun `view.displayedRegions` changes | `clearAllRpcData()`
  onDisplayedRegionsChange(
    self,
    () => {
      self.clearAllRpcData()
    },
    'DisplayedRegionsChange',
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
      // eslint-disable-next-line no-restricted-syntax -- self-write: clearAllRpcData clears the flags this reads
      if (untracked(() => self.fetchCanceled || self.error)) {
        self.clearAllRpcData()
      }
    },
    { name: 'ClearBlockingStateOnViewportChange' },
  )

  // Installed last, which reads as though it mattered and does NOT — the thing
  // that protects this is `leadingEdgeAutorun`'s first run being a microtask,
  // which no synchronous install can precede. Cold-open RPC count on the canvas
  // harness, all four combinations:
  //
  //   leading edge   installed   RPCs
  //   synchronous    first       2
  //   synchronous    last        1
  //   microtask      first       1
  //   microtask      last        1
  //
  // The duplicate was real while the leading edge was the install call itself:
  // the three autoruns above each fire once at install, two of them call
  // `clearAllRpcData`, and a fetch issued before them was cancelled by
  // `SettingsInvalidate`'s first pass and reissued with identical arguments — a
  // round trip per track on every track open that only a call count could see.
  // The microtask retired that, in the same commit that moved this call. Left
  // where it is because reading in install order is worth something; do not add
  // a test pinning the position, and do not restore an ordering constraint here
  // if the leading edge ever changes — fix the leading edge.
  //
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
        // tracked, and above the coverage read: while the banner is up this
        // run owes a re-measure, and the flip back to false has to re-fire
        // the autorun or the release lands a viewport late
        gateBlocked: self.regionTooLarge,
        // tracked: the flip at fetch start costs one idle run, measured
        // below, and `fetchGeneration` at fetch end is the re-trigger
        isLoading: () => self.isLoading,
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
            loadedRegion: idx => self.loadedRegions.get(idx),
            isCacheValid: idx => self.isCacheValid(idx),
          }
        },
      })

      // A fetch is the one plan whose retry answer the plan cannot give:
      // reaching `fetchNeeded` is not reaching a fetch, since an override can
      // decline inside it, so the fetch-start flag classifies this one.
      if (plan.kind === 'fetch') {
        // Cleared first so the read below can only see this call's fetch.
        takeFetchStarted(self)
        // Not awaited — and the classification depends on that. The override's
        // synchronous prefix has run by the time it hands back a promise, and
        // reaching `FetchMixin.runFetch` is what every one of them does there.
        self.fetchNeeded(plan.needed)
        const started = takeFetchStarted(self)
        noteFetchAutorunRun(started ? 'fetched' : 'declined')
        // arms the debounce, and only here: a run that planned nothing, or an
        // override that declined inside `fetchNeeded`, has coalesced nothing
        // and must stay on the leading edge
        return started
      }

      if (plan.kind === 'assemblyMismatch') {
        self.setError(new Error(regionAssemblyMismatchMessage(plan)))
      }
      // Every other exit answers off the plan's own reason —
      // `retryOutcomeForPlan` says which, in one place rather than at each of
      // the five returns that used to carry its own call.
      noteFetchAutorunRun(retryOutcomeForPlan(plan))
      return false
    },
    // the debounce stays a literal here: `generateFetchAutorunDocs` reads it off
    // this call to write the docs' autorun table, so a named constant would put
    // the number back in the docs' hands
    { name: 'FetchVisibleRegions', delay: 600 },
  )

  // Drop a stored hover whenever the content it names moves or goes away.
  // Installed here rather than per display because the six displays that store
  // one all reach it through this foundation, and the failure mode is omission:
  // a seventh that forgets keeps naming what USED to be under the cursor, with
  // no error anywhere. Clears through `BaseDisplay.clearHoveredFeature`, whose
  // default is a no-op, so a display deriving its hover pays nothing.
  addDisposer(self, installClearHoverOnViewportChange(self))
}
