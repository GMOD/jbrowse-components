import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'

import { arcFetchPhases } from './fetchArcFeatures.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'

export function doAfterAttach(self: ArcDisplayModel) {
  // Same shared trigger every global display uses (LD, HiC, variant matrix): a
  // debounced autorun that fetches when the data isn't already current.
  // `regionTooLarge` is deliberately not a term: the skeleton owns that skip,
  // and it lets a blocked display fetch once per settled viewport so the
  // pre-flight can re-measure — an index read, not a download. Reload bumps
  // `reloadCounter`, which the skeleton reads above the phases.
  installGlobalFetchAutorun(self, {
    ...arcFetchPhases(self),
    delay: 1000,
    name: 'ArcFetch',
  })
}
