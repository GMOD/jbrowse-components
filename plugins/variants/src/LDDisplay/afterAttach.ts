import {
  installGlobalFetchAutorun,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'

import type { RegionByteEstimate } from '@jbrowse/core/data_adapters/BaseAdapter/types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

interface LDModel extends IAnyStateTreeNode {
  showLDTriangle: boolean
  regionTooLarge: boolean
  isMinimized: boolean
  reloadCounter: number
  rpcProps(): Record<string, unknown>
  performLDFetch(): void
  setByteEstimate(stats?: RegionByteEstimate): void
}

export function doAfterAttach(self: LDModel) {
  // A force-load (raising userByteLimit) also clears regionTooLarge and
  // bumps reloadCounter, so the byte limit needs no tracker of its own — either
  // of those (already tracked) refires the fetch. regionTooLarge is a derived
  // getter (see shared.ts), so it self-releases on zoom-in with no imperative
  // clear; nothing here needs to watch or reset it.
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
    self.setByteEstimate(undefined)
  })
}
