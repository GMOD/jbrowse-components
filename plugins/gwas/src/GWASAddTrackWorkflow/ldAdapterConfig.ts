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

// bgzip-compressed (tabix) vs plain file, sniffed from the .gz extension —
// picks the tabix adapter and, for tabix files, means an index is needed.
export function isTabixLocation(loc: FileLocation): boolean {
  return locationName(loc).endsWith('.gz')
}

// Sibling `.tbi` for a location we can derive one for — a URL or a localPath
// (matching core's makeIndex, which appends the suffix to both). A blob /
// file-handle upload has no derivable sibling path, so it returns undefined and
// its index must be supplied explicitly.
export function deriveTbiLocation(loc: FileLocation): FileLocation | undefined {
  if (isUriLocation(loc)) {
    return { uri: `${loc.uri}.tbi`, locationType: 'UriLocation' }
  } else if ('localPath' in loc) {
    return {
      localPath: `${loc.localPath}.tbi`,
      locationType: 'LocalPathLocation',
    }
  } else {
    return undefined
  }
}

// A tabix file needs its index supplied by hand exactly when we can't derive a
// sibling for it (a blob / file-handle upload, not a URL or local path).
export function needsExplicitIndex(loc: FileLocation): boolean {
  return deriveTbiLocation(loc) === undefined
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
  const isTabix = isTabixLocation(ldLocation)
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
