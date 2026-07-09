import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'

import FetchMixin from './FetchMixin.ts'
import { autorunOnReadyView } from './MultiRegionDisplayMixin.ts'
import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.tsx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

export type { FetchContext } from './FetchMixin.ts'

/**
 * Mixin for GPU displays that hold a single global (non-regional) dataset —
 * HiC contact matrix, LD triangle, variant matrix, etc.
 *
 * Composes:
 *   - RenderLifecycleMixin (attachRenderingBackend, renderNow, …)
 *   - RegionTooLargeMixin (regionTooLarge, regionCannotBeRendered, …)
 *   - FetchMixin (runFetch, cancelFetch, isLoading, error, statusMessage,
 *                 fetchGeneration)
 *
 * Unlike MultiRegionDisplayMixin, this mixin owns no per-region state and
 * installs no autoruns. Fetch triggering is left to the display's own
 * afterAttach autorun so each display can express its own trigger conditions
 * (HiC: viewport change; LD: viewport + showLDTriangle + etc). The shared
 * skeleton of that autorun lives in `installGlobalFetchAutorun` (below) — a
 * display supplies only its own `shouldFetch` gate + `fetch` action.
 *
 * #stateModel GlobalDataDisplayMixin
 * #category display
 */
export default function GlobalDataDisplayMixin() {
  return types
    .compose(
      'GlobalDataDisplayMixin',
      RegionTooLargeMixin(),
      RenderLifecycleMixin(),
      FetchMixin(),
      types.model({}),
    )
    .volatile(() => ({
      /**
       * #volatile
       * Bumped by `reload()` to retrigger a global display's fetch autorun.
       * Each display reads `void self.reloadCounter` in its `afterAttach` fetch
       * autorun so a user-initiated reload re-runs the fetch even when no
       * viewport/setting changed.
       */
      reloadCounter: 0,
    }))
    .views(self => ({
      /**
       * #getter
       * Same precedence as MultiRegionDisplayMixin (single-sourced in
       * `computeDisplayPhase`). A global display has no per-region staleness
       * axis — it either has its one dataset or is fetching it — so its
       * `loading` axis is simply "fetch in flight".
       */
      get displayPhase(): DisplayPhase {
        // fetchCanceled keeps the overlay up (showing its retry affordance)
        // even though isLoading has gone false after the user canceled
        return computeDisplayPhase(
          self,
          () => self.isLoading || self.fetchCanceled,
        )
      },
    }))
    .views(() => ({
      /**
       * #getter
       * Overridable hook (default false): a subclass returns true once its
       * single global dataset has actually been fetched — even when the fetch
       * committed an empty result. The mixin owns no data state, so a global
       * display must express this; it is the global-display analog of
       * `MultiRegionDisplayMixin.viewportWithinLoadedData`.
       */
      get dataLoaded(): boolean {
        return false
      },
      /**
       * #getter
       * Overridable hook (default false): a subclass returns true to mark an
       * extra terminal state where off-screen export can proceed with no loaded
       * data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).
       */
      get svgReadyExtraTerminal(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an
       * off-screen (SVG) export can read final data. Like that mixin it requires
       * the dataset to actually be loaded (or a terminal error / too-large /
       * extra state), NOT merely "not currently fetching": the fetch trigger is
       * a debounced `afterAttach` autorun, so at export time `isLoading` can
       * still be false with no data yet — a `displayPhase !== 'loading'` test
       * would then capture an empty render. Never gates on `canvasDrawn`, which
       * an off-screen export never sets. Off-screen renderers gate on it via
       * `awaitSvgReady(model)`.
       */
      get svgReady(): boolean {
        return (
          self.dataLoaded ||
          !!self.error ||
          self.regionTooLarge ||
          self.svgReadyExtraTerminal
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Satisfies the `reload` contract `DisplayChrome` requires of every
       * display (the per-region foundation provides its own). Clears any error
       * and bumps `reloadCounter` so the display's fetch autorun re-runs. A
       * subclass whose reload needs extra teardown can override and chain.
       */
      reload() {
        self.setError(undefined)
        // clear the durable user-cancel flag synchronously so the overlay flips
        // from "canceled" to "loading" immediately, rather than lingering until
        // the debounced fetch autorun runs runFetch (which also clears it)
        self.fetchCanceled = false
        self.reloadCounter += 1
      },
    }))
}

export type GlobalDataDisplayMixinType = ReturnType<
  typeof GlobalDataDisplayMixin
>

interface GlobalFetchAutorunHost extends IAnyStateTreeNode {
  isMinimized: boolean
  reloadCounter: number
  rpcProps?: () => unknown
}

/**
 * Install the fetch-trigger autorun for a `GlobalDataDisplayMixin` display.
 *
 * Unlike `MultiRegionDisplayMixin` (which installs its four fetch autoruns for
 * you), this mixin installs none — each global display owns its trigger. But
 * every global trigger shares the same skeleton: skip while the track is
 * minimized or the viewport has no content blocks; track `rpcProps()` +
 * `reloadCounter` so a settings change or a manual `reload()` refires; and
 * debounce. This helper owns that skeleton so a display supplies only its own
 * `shouldFetch` gate (reading — and thereby MobX-tracking — its display-specific
 * fetch inputs) and its `fetch` action.
 *
 * Runs through `autorunOnReadyView`, so the body never reads a throwing view
 * getter (`dynamicBlocks`, `width`) before the view is initialized, and
 * re-runs automatically once it is.
 *
 * `rpcProps()` loop hazard: unlike MultiRegion's `SettingsInvalidate` (which
 * clears data in a *separate, undelayed* autorun and so loops synchronously if
 * `rpcProps()` reads fetch-derived state — caught by `makeSettingsLoopGuard`),
 * this autorun reads `rpcProps()` and triggers `fetch()` in the *same* debounced
 * body. A fetch-derived value in `rpcProps()` here loops on the async-fetch
 * cadence (refetch → commit → `rpcProps()` changes → reschedule after `delay` →
 * refetch), a slow network thrash rather than a synchronous freeze, so a
 * within-tick counter cannot distinguish it from legitimate rapid interaction.
 * The invariant is the same: `rpcProps()` must read only user-controlled
 * settings, never fetched data (see ARCHITECTURE.md "rpcProps() loop trap").
 */
export function installGlobalFetchAutorun(
  self: GlobalFetchAutorunHost,
  opts: {
    shouldFetch: () => boolean
    fetch: () => void
    delay: number
    name: string
  },
) {
  autorunOnReadyView(
    self,
    view => {
      if (
        !self.isMinimized &&
        view.dynamicBlocks.contentBlocks.length > 0 &&
        opts.shouldFetch()
      ) {
        // Track user settings + manual reload so either refires the fetch.
        void self.rpcProps?.()
        void self.reloadCounter
        opts.fetch()
      }
    },
    { delay: opts.delay, name: opts.name },
  )
}
