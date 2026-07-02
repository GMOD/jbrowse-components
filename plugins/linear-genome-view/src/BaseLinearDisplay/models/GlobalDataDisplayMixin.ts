import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'

import FetchMixin from './FetchMixin.ts'
import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.tsx'

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
 * installs no autoruns. Fetch triggering is left entirely to the display's
 * own afterAttach autorun so each display can express its own trigger
 * conditions (HiC: viewport change; LD: viewport + showLDTriangle + etc).
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
