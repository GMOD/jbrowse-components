import {
  installGlobalFetchAutorun,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'

import { ldFetchPhases } from './ldFetchPhases.ts'

import type { LDFetchSelf } from './ldFetchPhases.ts'
import type { GlobalFetchAutorunHost } from '@jbrowse/plugin-linear-genome-view'

// The skeleton's own hosting requirements (`GlobalFetchAutorunHost`, the
// interface the skeleton itself is typed against) on top of what the fetch
// phases need.
interface LDModel extends LDFetchSelf, GlobalFetchAutorunHost {
  clearByteEstimate(): void
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
