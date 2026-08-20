import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.ts'
import FetchMixin from './FetchMixin.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'

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
 * RenderLifecycleMixin — the one genuinely GPU-only piece. A non-GPU composer
 * (arc) defines its own one-line `displayPhase` over the same shared
 * `computeDisplayPhase`, passing `renderError: undefined`.
 *
 * #stateModel GlobalFetchMixin
 * #displayFoundationDef The same single-global fetch foundation without the render lifecycle, so a non-GPU display that paints main-thread SVG does not drag it in.
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
    .views(self => ({
      /**
       * #getter
       * The containing LinearGenomeView, typed once so no consumer repeats the
       * `getContainingView` cast. Same getter, same name, as
       * `MultiRegionDisplayMixin`'s — declared in both rather than hoisted into
       * the `RegionTooLargeMixin` they share, because that mixin is named for
       * the byte gate and a display composes exactly one of these two families,
       * so the pair can never shadow each other. See the note there for why the
       * name is `lgv` and not `view`.
       */
      get lgv(): LinearGenomeViewModel {
        return getContainingView(self) as LinearGenomeViewModel
      },
      /**
       * #getter
       * This family's answer to the shared freshness question every display
       * foundation must answer: the held data corresponds to what is on screen
       * right now — fetched, and fetched *for this viewport*. The mixin owns no
       * data state, so a global display must express it; the two in tree do so
       * differently (HiC and LD add their own "data arrived" term to
       * `StaleViewportRescaleMixin`'s `viewportFresh` snapshot compare, arc
       * compares a region signature via `isDataCurrent`), which is exactly what
       * the hook is for.
       *
       * Default false, so a display that forgets the override never exports —
       * a hung export is diagnosable, a stale one silently ships wrong pixels.
       */
      get dataCurrent(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Policy single-sourced in `computeSvgReady`; this family supplies only
       * its `dataCurrent` predicate. Note it requires the dataset to actually be
       * current, NOT merely "not currently fetching": the fetch trigger is a
       * debounced `afterAttach` autorun, so at export time `isLoading` can still
       * be false with no data yet — a `displayPhase !== 'loading'` test would
       * then capture an empty render. Never gates on `canvasDrawn`, which an
       * off-screen export never sets. Off-screen renderers gate on it via
       * `awaitSvgReady(model)`.
       */
      get svgReady(): boolean {
        return foundationSvgReady(self)
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
