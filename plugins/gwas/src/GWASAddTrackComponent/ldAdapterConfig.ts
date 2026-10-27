import { matchFormat } from '@jbrowse/add-track-core'
import { adapterConfigFromSpec } from '@jbrowse/core/util'
import { siblingLocation } from '@jbrowse/core/util/indexCandidates'
import { getFileName } from '@jbrowse/core/util/tracks'

import type { FileLocation } from '@jbrowse/core/util/types'

// `.bgz` is the name htslib's own tools give a bgzipped file
export function isTabixLocation(loc: FileLocation): boolean {
  return /\.b?gz$/.test(getFileName(loc))
}

// A blob or file handle has no directory to find a sibling index in
export function needsExplicitIndex(loc: FileLocation): boolean {
  return siblingLocation(loc, getFileName(loc)) === undefined
}

// The adapter type as a hint, since the format table claims only `.ld` and
// `.vcor` names and this form takes any PLINK LD table
export function buildLdAdapterConfig(
  ldLocation: FileLocation,
  ldIndexLocation?: FileLocation,
): Record<string, unknown> {
  const adapterType = isTabixLocation(ldLocation)
    ? 'PlinkLDTabixAdapter'
    : 'PlinkLDAdapter'
  const spec = matchFormat(getFileName(ldLocation), adapterType)?.spec
  const config =
    spec && adapterConfigFromSpec(spec, ldLocation, ldIndexLocation)
  if (!config) {
    throw new Error(`No format table entry for ${adapterType}`)
  }
  return config
}
