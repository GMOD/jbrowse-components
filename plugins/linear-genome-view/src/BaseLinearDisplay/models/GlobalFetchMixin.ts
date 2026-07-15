import { types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'
import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.tsx'

/**
 * Rendering-agnostic foundation for any display holding a single global
 * (non-regional) dataset. Owns the *fetch* concern only — no GPU rendering — so
 * it is shared by GPU global displays (via GlobalDataDisplayMixin) AND
 * main-thread SVG ones (the arc displays), which compose it directly. That's the
 * whole reason it's split out from GlobalDataDisplayMixin: fetch (cancellation,
 * staleness, region-too-large, reload, the svgReady export gate) is orthogonal
 * to how the display paints, so a non-GPU display shouldn't have to drag in
 * RenderLifecycleMixin to get it.
 *
 * Composes:
 *   - RegionTooLargeMixin (regionTooLarge, force-load, …)
 *   - FetchMixin (runFetch, cancelFetch, isLoading, error, statusMessage,
 *                 fetchGeneration)
 *
 * Installs no autoruns — each display owns its fetch trigger, sharing the
 * `installGlobalFetchAutorun` skeleton. `displayPhase` lives in
 * GlobalDataDisplayMixin, not here, because it reads `renderError` from
 * RenderLifecycleMixin — the one genuinely GPU-only piece.
 *
 * #stateModel GlobalFetchMixin
 * #category display
 */
export default function GlobalFetchMixin() {
  return types
    .compose(
      'GlobalFetchMixin',
      RegionTooLargeMixin(),
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
       * Satisfies the `reload` contract `DisplayChrome` (and the arc SVG chrome)
       * require of every display. Clears any error and bumps `reloadCounter` so
       * the display's fetch autorun re-runs. A subclass whose reload needs extra
       * teardown can override and chain.
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

export type GlobalFetchMixinType = ReturnType<typeof GlobalFetchMixin>
