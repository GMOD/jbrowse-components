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
  regionTooLarge: boolean
  isMinimized: boolean
  reloadCounter: number
  rpcProps(): Record<string, unknown>
  performLDFetch(): void
  clearByteEstimate(): void
}

export function doAfterAttach(self: LDModel) {
  // `regionTooLarge` is a derived getter (see shared.ts): a pure function of the
  // cached byte estimate, the viewport, and `forceLoadTrack`, so it self-releases
  // on zoom-in and flips on force-load with no imperative clear, and `shouldFetch`
  // reading it below is all the tracking either needs. `reload()` refires through
  // `reloadCounter`, which the skeleton reads above its gate.
  installGlobalFetchAutorun(self, {
    shouldFetch: () => self.showLDTriangle && !self.regionTooLarge,
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
