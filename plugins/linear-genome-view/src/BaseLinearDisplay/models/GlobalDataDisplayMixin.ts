import { GpuLifecycleMixin } from '@jbrowse/core/gpu/GpuLifecycleMixin'
import { types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'
import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.tsx'

export type { FetchContext } from './FetchMixin.ts'

/**
 * Mixin for GPU displays that hold a single global (non-regional) dataset —
 * HiC contact matrix, LD triangle, variant matrix, etc.
 *
 * Composes:
 *   - GpuLifecycleMixin (attachBackend, renderNow, …)
 *   - RegionTooLargeMixin (regionTooLarge, regionCannotBeRendered, …)
 *   - FetchMixin (runFetch, cancelFetch, isLoading, error, statusMessage,
 *                 fetchGeneration)
 *
 * Unlike MultiRegionDisplayMixin, this mixin owns no per-region state and
 * installs no autoruns. Fetch triggering is left entirely to the display's
 * own afterAttach autorun so each display can express its own trigger
 * conditions (HiC: viewport change; LD: viewport + showLDTriangle + etc).
 */
export default function GlobalDataDisplayMixin() {
  return types.compose(
    'GlobalDataDisplayMixin',
    RegionTooLargeMixin(),
    GpuLifecycleMixin(),
    FetchMixin(),
    types.model({}),
  )
}

export type GlobalDataDisplayMixinType = ReturnType<
  typeof GlobalDataDisplayMixin
>
