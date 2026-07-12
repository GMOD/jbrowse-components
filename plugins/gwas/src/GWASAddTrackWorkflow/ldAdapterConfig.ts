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

// Build the PLINK .ld adapter config for the `GWASAdapter`'s `ldAdapter`
// sub-adapter slot. A bgzipped (.gz) file uses the tabix adapter, a plain .ld
// file the in-memory one.
//
// Both PLINK adapters accept a `uri` shorthand (their `preProcessSnapshot` sets
// `ldLocation`, and the tabix one derives `<uri>.tbi`), which `getAdapter`
// expands when the sub-adapter is instantiated — so for a URL with no custom
// index we emit just `{ type, uri }`. The explicit `ldLocation`/`index` form is
// only needed for a non-URL location (blob/localPath, no `uri` to shorthand) or
// a custom tabix index the derived `.tbi` can't express.
export function buildLdAdapterConfig(
  ldLocation: FileLocation,
  ldIndexLocation?: FileLocation,
): Record<string, unknown> {
  const isTabix = locationName(ldLocation).endsWith('.gz')
  const type = isTabix ? 'PlinkLDTabixAdapter' : 'PlinkLDAdapter'
  if (isUriLocation(ldLocation) && !(isTabix && ldIndexLocation)) {
    return { type, uri: ldLocation.uri }
  } else if (isTabix) {
    return {
      type,
      ldLocation,
      index: {
        indexType: 'TBI',
        location: ldIndexLocation ?? deriveTbiLocation(ldLocation),
      },
    }
  } else {
    return { type, ldLocation }
  }
}
