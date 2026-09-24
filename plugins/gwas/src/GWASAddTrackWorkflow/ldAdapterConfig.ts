import { isUriLocation } from '@jbrowse/core/util'
import { siblingLocation } from '@jbrowse/core/util/indexCandidates'
import { getFileName, makeIndexType } from '@jbrowse/core/util/tracks'

import type { FileLocation } from '@jbrowse/core/util/types'

// `.bgz` is the name htslib's own tools give a bgzipped file
export function isTabixLocation(loc: FileLocation): boolean {
  return /\.b?gz$/.test(getFileName(loc))
}

// undefined for a blob or file handle, which has no directory to look in
export function deriveTbiLocation(loc: FileLocation): FileLocation | undefined {
  return siblingLocation(loc, `${getFileName(loc)}.tbi`)
}

export function needsExplicitIndex(loc: FileLocation): boolean {
  return deriveTbiLocation(loc) === undefined
}

export function makeTabixIndex(location: FileLocation | undefined) {
  return {
    indexType: makeIndexType(location && getFileName(location), 'CSI', 'TBI'),
    location,
  }
}

// Both PLINK adapters expand a `uri` shorthand, the tabix one deriving
// `<uri>.tbi`, so only a non-URL location or a custom index is spelt out.
export function buildLdAdapterConfig(
  ldLocation: FileLocation,
  ldIndexLocation?: FileLocation,
): Record<string, unknown> {
  const isTabix = isTabixLocation(ldLocation)
  const type = isTabix ? 'PlinkLDTabixAdapter' : 'PlinkLDAdapter'
  if (isUriLocation(ldLocation) && !(isTabix && ldIndexLocation)) {
    return { type, uri: ldLocation.uri }
  } else if (isTabix) {
    return {
      type,
      ldLocation,
      index: makeTabixIndex(ldIndexLocation ?? deriveTbiLocation(ldLocation)),
    }
  } else {
    return { type, ldLocation }
  }
}
