import { buildReadVsRefFeatures } from '@jbrowse/cigar-utils'
import { getSession } from '@jbrowse/core/util'

import type { AlignmentFeatureSerialized } from './util.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The split read's segments, ordered along the read — the same SA-tag
// decomposition the "read vs ref" launchers draw, reused here to list the
// junctions between adjacent segments.
export async function getSAFeatures({
  view,
  feature,
}: {
  view: LinearGenomeViewModel
  feature: AlignmentFeatureSerialized
}) {
  const { assemblyManager } = getSession(view)
  if (feature.CIGAR === undefined) {
    throw new Error('feature missing CIGAR')
  }
  if (feature.name === undefined) {
    throw new Error('feature missing name')
  }

  // Canonical refNames: if the read's refName is chr1 and the actual fasta
  // refName is 1, no track can be opened on the split view this panel links to.
  const assembly = await assemblyManager.waitForAssembly(view.assemblyNames[0]!)
  if (!assembly) {
    throw new Error('assembly not found')
  }

  return buildReadVsRefFeatures(feature, assembly.getCanonicalRefName2).features
}
