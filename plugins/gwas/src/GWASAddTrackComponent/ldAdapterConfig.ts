import { siblingLocation } from '@jbrowse/core/util/indexCandidates'
import { getFileName, makeIndexType } from '@jbrowse/core/util/tracks'

import type { FileLocation } from '@jbrowse/core/util/types'

// Not core's format table: it claims only `.ld` and `.vcor` names, and its
// `makeIndex` keeps only a location's `uri` and `baseUri`, dropping an
// internet account that `siblingLocation` keeps.

// `.bgz` is the name htslib's own tools give a bgzipped file
export function isTabixLocation(loc: FileLocation): boolean {
  return /\.b?gz$/.test(getFileName(loc))
}

// undefined for a blob or file handle, which has no directory to look in
function deriveTbiLocation(loc: FileLocation): FileLocation | undefined {
  return siblingLocation(loc, `${getFileName(loc)}.tbi`)
}

export function needsExplicitIndex(loc: FileLocation): boolean {
  return deriveTbiLocation(loc) === undefined
}

function tabixIndex(loc: FileLocation, index?: FileLocation) {
  const location = index ?? deriveTbiLocation(loc)
  return {
    indexType: makeIndexType(location && getFileName(location), 'CSI', 'TBI'),
    location,
  }
}

// The full location, not the `uri` shorthand, which keeps only `uri` and
// `baseUri` and so drops an internet account
export function buildLdAdapterConfig(
  ldLocation: FileLocation,
  ldIndexLocation?: FileLocation,
): Record<string, unknown> {
  return isTabixLocation(ldLocation)
    ? {
        type: 'PlinkLDTabixAdapter',
        ldLocation,
        index: tabixIndex(ldLocation, ldIndexLocation),
      }
    : { type: 'PlinkLDAdapter', ldLocation }
}
