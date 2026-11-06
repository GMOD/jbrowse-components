import {
  assertDisplayContract,
  makeRetryContractCheck,
  takeFetchStarted,
} from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import { getContainingTrack } from '@jbrowse/core/util/mstUtils'
import { getConfAssemblyNamesOrNone } from '@jbrowse/core/util/tracks'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

import {
  autorunOnReadyView,
  makeSettingsLoopGuard,
  onDisplayedRegionsChange,
} from './displayAutoruns.ts'
import { onTrackAssembly } from './foundationView.ts'
import { installClearHoverOnViewportChange } from './installClearHoverOnViewportChange.ts'
import {
  planRegionFetch,
  regionAssemblyMismatchMessage,
  retryOutcomeForPlan,
} from './planRegionFetch.ts'

import type { IndexedRegion } from './planRegionFetch.ts'
import type { RegionHost } from './regionHost.ts'
import type { FetchSkeletonHost } from '@jbrowse/core/util/installFetch'
import type { Region } from '@jbrowse/core/util/types/data'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What the per-region fetch autoruns read and call. Duck-typed, since the
 * mixin's `Instance` type would be circular here.
 */
export interface PerRegionFetchHost extends FetchSkeletonHost {
  error: unknown
  // required where the skeleton leaves it optional: the plan takes it as a term
  fetchCanceled: boolean
  fetchGeneration: number
  isLoading: boolean
  awaitingPrerequisite: boolean
  gateSkipsMeasuredViewport: boolean
  fetchSuspended: boolean
  /** read by the hover-clear reaction, which the too-large banner also fires */
  regionTooLarge: boolean
  loadedRegions: { get: (displayedRegionIndex: number) => Region | undefined }
  /**
   * The settings tier of `fetchInputs`; its identity moves only when
   * `rpcProps()` or the adapter config really changes.
   */
  settingsFetchInputs: unknown
  isCacheValid: (displayedRegionIndex: number) => boolean
  fetchNeeded: (needed: IndexedRegion[]) => void
  setError: (error?: unknown) => void
  clearAllRpcData: () => void
  invalidateSettings: () => void
  clearHoveredFeature: () => void
}

/**
 * What `FetchVisibleRegions` would fetch now, for that autorun and for a
 * `reload()` that fetches without waiting out its debounce.
 */
export function planVisibleRegionFetch(
  self: IStateTreeNode &
    Pick<
      PerRegionFetchHost,
      | 'error'
      | 'fetchCanceled'
      | 'gateSkipsMeasuredViewport'
      | 'fetchSuspended'
      | 'regionTooLarge'
      | 'isLoading'
      | 'loadedRegions'
      | 'isCacheValid'
    >,
  view: Pick<RegionHost, 'visibleRegions' | 'bufferedVisibleRegions'>,
) {
  return planRegionFetch({
    error: self.error,
    fetchCanceled: self.fetchCanceled,
    gateSkipsMeasuredViewport: self.gateSkipsMeasuredViewport,
    // tracked: the flip back to false is the fetch's wake
    suspended: self.fetchSuspended,
    // tracked: the flip back to false must re-fire the autorun, or the release
    // lands a viewport late
    gateBlocked: self.regionTooLarge,
    // tracked: costs one idle run at fetch start; `fetchGeneration` re-fires
    // at the end
    isLoading: () => self.isLoading,
    // tracked, behind a thunk: un-minimizing re-fires the fetch, and a
    // minimized track never reaches the viewport reads, so it skips pans
    minimized: () => getContainingTrack(self).minimized,
    sources: () => ({
      trackAssemblyNames: getConfAssemblyNamesOrNone(
        getContainingTrack(self).configuration,
      ),
      onTrackAssembly: onTrackAssembly(self),
      visibleRegions: view.visibleRegions,
      bufferedVisibleRegions: view.bufferedVisibleRegions,
      loadedRegion: idx => self.loadedRegions.get(idx),
      isCacheValid: idx => self.isCacheValid(idx),
    }),
  })
}

/**
 * Install the per-region fetch lifecycle: `DisplayedRegionsChange`,
 * `FetchVisibleRegions`, `SettingsInvalidate`,
 * `ClearBlockingStateOnViewportChange`, and the stored-hover clear.
 *
 * `planRegionFetch` owns the decision; this file owns the MobX dependency set,
 * which reads are tracked and which sit behind a thunk.
 * `installPerRegionFetchAutoruns.test.ts` pins that set per state. `untracked`
 * is for a read the body's own effect writes, or a contract check that must
 * not change the production dependency set.
 */
export function installPerRegionFetchAutoruns(self: PerRegionFetchHost) {
  // dev-only, and first, so a double install is reported
  assertDisplayContract(self)

  // reports a `reload()` whose fetch autorun run reaches no fetch
  const noteFetchAutorunRun = makeRetryContractCheck(self)

  // The byte estimate is `RegionTooLargeMixin`'s to drop, on the same trigger.
  //
  // #autorun `view.displayedRegions` changes | `clearAllRpcData()`
  onDisplayedRegionsChange(
    self,
    () => {
      self.clearAllRpcData()
    },
    'DisplayedRegionsChange',
  )

  const loopGuard = makeSettingsLoopGuard('SettingsInvalidate')
  // Every held region already fails `isCacheValid` when the settings tier
  // moves, so the plan refetches on its own; this supersedes the in-flight
  // fetch now and unblocks an errored display.
  //
  // #autorun `settingsFetchInputs`, the `rpcProps()` return and the adapter config compared structurally | `invalidateSettings()`: supersede the in-flight fetch, clear a blocking error or cancel, drop settings-baked data. `loadedRegions` stays, so the held data draws under the `staleSettingsDrawn` scrim until the refetch lands
  autorunOnReadyView(
    self,
    () => {
      void self.settingsFetchInputs
      loopGuard()
      self.invalidateSettings()
    },
    { name: 'SettingsInvalidate' },
  )

  // The flags are read untracked, or setting one would fire this and wipe it.
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

  // Install order does not matter: `leadingEdgeAutorun`'s first run is a
  // microtask, after every autorun above has made its first pass.
  //
  // #autorun the viewport, `fetchGeneration` after a fetch ends, or `reloadCounter` on a user retry | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. While `regionTooLarge` holds it runs that same fetch once per settled viewport — the fetch stops at whichever gate rejected it, and there is no measurement-only path. Skipped while `error` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized
  autorunOnReadyView(
    self,
    view => {
      // pure triggers, read above every gate (FETCH_KEYS.md)
      void self.fetchGeneration
      void self.reloadCounter

      const plan = planVisibleRegionFetch(self, view)

      // an override can decline inside `fetchNeeded`, so whether a fetch
      // started is read off the fetch-start flag
      if (plan.kind === 'fetch') {
        // cleared first, so the read below sees only this call's fetch
        takeFetchStarted(self)
        // not awaited: every override reaches `runFetch` in its synchronous
        // prefix
        self.fetchNeeded(plan.needed)
        const started = takeFetchStarted(self)
        noteFetchAutorunRun(started ? 'fetched' : 'declined')
        // arms the debounce; a run that fetched nothing stays on the leading
        // edge
        return started
      }

      if (plan.kind === 'assemblyMismatch') {
        self.setError(new Error(regionAssemblyMismatchMessage(plan)))
      }
      noteFetchAutorunRun(retryOutcomeForPlan(plan))
      return false
    },
    // a literal: `generateFetchAutorunDocs` reads the debounce off this call
    { name: 'FetchVisibleRegions', delay: 600, idleLeading: true },
  )

  // Drop a stored hover when the content it names moves, here so no display
  // storing one can forget it.
  addDisposer(self, installClearHoverOnViewportChange(self))
}
