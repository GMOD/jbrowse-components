import { RenderLifecycleMixin } from '@jbrowse/core/gpu/RenderLifecycleMixin'
import { computeDisplayPhase } from '@jbrowse/core/gpu/displayPhase'
import { types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'
import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.tsx'

import type { DisplayPhase } from '@jbrowse/core/gpu/displayPhase'

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
    .views(self => ({
      /**
       * #getter
       * Same precedence as MultiRegionDisplayMixin (single-sourced in
       * `computeDisplayPhase`). A global display has no per-region staleness
       * axis — it either has its one dataset or is fetching it — so its
       * `loading` axis is simply "fetch in flight".
       */
      get displayPhase(): DisplayPhase {
        return computeDisplayPhase(self, () => self.isLoading)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Shared with MultiRegionDisplayMixin's getter of the same name so
       * `DisplayLoadingOverlay` reads one signal across all GPU displays.
       * Correctly stays hidden over a display that's intentionally empty (e.g.
       * LD with the triangle toggled off, which fetches nothing). Separate
       * `.views` block so it can read the sibling `displayPhase` getter.
       */
      get loadingOverlayVisible() {
        return self.displayPhase === 'loading'
      },
    }))
}

export type GlobalDataDisplayMixinType = ReturnType<
  typeof GlobalDataDisplayMixin
>
