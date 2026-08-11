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
  // The retry check's exemption, and this display is the reason it exists: with
  // the triangle off `shouldFetch` is false forever, so a reload legitimately
  // reaches no fetch. LD answers `!showLDTriangle` here, off the same slot.
  loadingSuppressed: boolean
  rpcProps(): Record<string, unknown>
  performLDFetch(): void
  clearByteEstimate(): void
  gateMeasurementStale: boolean
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
