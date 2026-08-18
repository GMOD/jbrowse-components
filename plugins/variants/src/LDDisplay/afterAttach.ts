import {
  installGlobalFetchAutorun,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves to `any` and
// silently turns off checking for every member below. See the note on
// `FetchSelf` in canvas's fetchMultiRowFeatures.ts.
interface LDModel extends IStateTreeNode {
  showLDTriangle: boolean
  isMinimized: boolean
  reloadCounter: number
  // The retry check's two hooks, both `FetchMixin`'s. LD is the reason the
  // first exists: with the triangle off `shouldFetch` is false forever, so a
  // reload legitimately reaches no fetch, and LD answers `!showLDTriangle`
  // there off the same slot. It takes the default `false` for the second — its
  // fetch waits on no other autorun.
  loadingSuppressed: boolean
  awaitingPrerequisite: boolean
  rpcProps(): Record<string, unknown>
  // `FetchMixin`'s serialization of the above, which is what the skeleton
  // tracks — the payload's own reads must not enter the dependency set.
  rpcPropsCacheKey: string
  performLDFetch(): void
  clearByteEstimate(): void
  // `RegionTooLargeMixin`'s combined skip, which is what the skeleton reads —
  // its two terms are deliberately not named here, so no local expression can
  // re-derive it.
  gateSkipsMeasuredViewport: boolean
}

export function doAfterAttach(self: LDModel) {
  // `regionTooLarge` is deliberately NOT a term here. The skeleton owns the
  // too-large skip, because a blocked display still has to run its fetch once
  // per settled viewport to re-measure — `byteGateBlocksFetch` measures and
  // stops, so it costs an index read, not a download. Restating it here would
  // skip that and freeze the estimate at the viewport it was captured over,
  // which is what used to leave the banner to be released by arithmetic.
  // `reload()` refires through `reloadCounter`, which the skeleton reads above
  // its gate.
  installGlobalFetchAutorun(self, {
    shouldFetch: () => self.showLDTriangle,
    fetch: () => {
      self.performLDFetch()
    },
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
