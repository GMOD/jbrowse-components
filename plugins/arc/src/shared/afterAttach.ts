import {
  installGlobalFetchAutorun,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'

import { fetchArcFeatures } from './fetchArcFeatures.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'

export function doAfterAttach(self: ArcDisplayModel) {
  // Same shared trigger every global display uses (LD, HiC, variant matrix): a
  // debounced autorun that fetches when the data isn't already current.
  // `dataCurrent` tracks the static-block region signature so panning past a
  // block boundary refetches while a redundant pan within the loaded blocks does
  // not. `regionTooLarge` is deliberately not a term: the skeleton owns that
  // skip, and it lets a blocked display fetch once per settled viewport so the
  // pre-flight can re-measure — an index read, not a download. Reload bumps
  // `reloadCounter`, which the skeleton reads above its gate.
  installGlobalFetchAutorun(self, {
    shouldFetch: () => !self.dataCurrent,
    fetch: () => {
      // runFetch owns errors + cancellation; fire-and-forget is safe
      void fetchArcFeatures(self)
    },
    delay: 1000,
    name: 'ArcFetch',
  })

  // Drop the cached byte estimate on chromosome navigation (mirrors LD). It
  // intentionally survives viewport changes so the derived banner doesn't
  // flicker on pan; this is the one path that clears it, so a previous region's
  // estimate can't gate the new region against the wrong stats.
  onDisplayedRegionsChange(self, () => {
    self.clearByteEstimate()
  })
}
