import {
  installGlobalFetchAutorun,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'

import { ldFetchPhases } from './ldFetchPhases.ts'

import type { LDFetchSelf } from './ldFetchPhases.ts'
import type { FetchContext } from '@jbrowse/plugin-linear-genome-view'

// The skeleton's own hosting requirements, on top of what the fetch phases need.
interface LDModel extends LDFetchSelf {
  reloadCounter: number
  // The retry check's two hooks, both `FetchMixin`'s. LD is the reason the
  // first exists: with the triangle off `prepare` declines forever, so a reload
  // legitimately reaches no fetch, and LD answers `!showLDTriangle` there off
  // the same slot. It takes the default `false` for the second — its fetch
  // waits on no other autorun.
  loadingSuppressed: boolean
  awaitingPrerequisite: boolean
  // `FetchMixin`'s serialization of `rpcProps()`, which is what the skeleton
  // tracks — the payload's own reads must not enter the dependency set.
  rpcPropsCacheKey: string
  runFetch: (work: (ctx: FetchContext) => Promise<void>) => Promise<void>
  clearByteEstimate(): void
  // `RegionTooLargeMixin`'s combined skip, which is what the skeleton reads —
  // its two terms are deliberately not named here, so no local expression can
  // re-derive it.
  gateSkipsMeasuredViewport: boolean
}

export function doAfterAttach(self: LDModel) {
  // `reload()` refires through `reloadCounter`, which the skeleton reads above
  // the phases.
  installGlobalFetchAutorun(self, {
    ...ldFetchPhases(self),
    delay: 500,
    name: 'LDDisplayRender',
  })

  // Drop the cached byte estimate on chromosome navigation. The estimate
  // intentionally survives viewport changes so the derived regionTooLarge
  // banner doesn't flicker on pan; this is the one path that clears it, scoped
  // to actual region-list mutation, so a previous region's estimate can't gate
  // the new region against the wrong stats and wedge refetch.
  onDisplayedRegionsChange(self, () => {
    self.clearByteEstimate()
  })
}
