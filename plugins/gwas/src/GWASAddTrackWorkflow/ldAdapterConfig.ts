import { isUriLocation } from '@jbrowse/core/util'

import type { FileLocation } from '@jbrowse/core/util/types'

// Path-ish name of a location, used only to sniff the .gz extension so we can
// pick the tabix vs plain PLINK .ld adapter.
export function locationName(loc: FileLocation): string {
  if (isUriLocation(loc)) {
    return loc.uri
  }
  if ('localPath' in loc) {
    return loc.localPath
  }
  if ('name' in loc) {
    return loc.name
  }
  return ''
}

// `<uri>.tbi` for a URL location, undefined otherwise (blob/localPath indexes
// must be supplied explicitly).
export function deriveTbiLocation(loc: FileLocation): FileLocation | undefined {
  return isUriLocation(loc)
    ? { uri: `${loc.uri}.tbi`, locationType: 'UriLocation' }
    : undefined
}

// Build the PLINK .ld adapter config for the Manhattan display's `ldAdapter`
// slot. A bgzipped (.gz) file uses the tabix adapter and needs an index — the
// caller's index location wins, otherwise we derive `<uri>.tbi` for URLs. A
// plain .ld file uses the in-memory adapter.
export function buildLdAdapterConfig(
  ldLocation: FileLocation,
  ldIndexLocation?: FileLocation,
): Record<string, unknown> {
  return locationName(ldLocation).endsWith('.gz')
    ? {
        type: 'PlinkLDTabixAdapter',
        ldLocation,
        index: {
          indexType: 'TBI',
          location: ldIndexLocation ?? deriveTbiLocation(ldLocation),
        },
      }
    : {
        type: 'PlinkLDAdapter',
        ldLocation,
      }
}
