import { RenderLifecycleMixin } from '@jbrowse/core/gpu/RenderLifecycleMixin'
import { types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'
import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.tsx'

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
 *
 * extends
 * - [RegionTooLargeMixin](../regiontoolargemixin)
 * - [RenderLifecycleMixin](../renderlifecyclemixin)
 * - [FetchMixin](../fetchmixin)
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
       * Shared with MultiRegionDisplayMixin's getter of the same name so
       * `DisplayLoadingOverlay` reads one signal across all GPU displays. A
       * global display has no per-region staleness axis (it either has its one
       * dataset or is fetching it), so this is just "fetch in flight, nothing
       * terminal up" — matching the legacy CanvasDisplayWrapper, and correctly
       * staying hidden over a display that's intentionally empty (e.g. LD with
       * the triangle toggled off, which fetches nothing).
       */
      get loadingOverlayVisible() {
        return (
          self.isLoading &&
          !self.regionTooLarge &&
          !self.error &&
          !self.renderError
        )
      },
    }))
}

export type GlobalDataDisplayMixinType = ReturnType<
  typeof GlobalDataDisplayMixin
>
