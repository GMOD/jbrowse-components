import { isLocalPathLocation, isUriLocation } from './types/index.ts'

import type { FileLocation } from './types/index.ts'

/**
 * A `UriLocation` as the absolute address it actually fetches — its `uri`
 * resolved against `baseUri`, so a config's relative path reads as the URL the
 * network saw rather than the fragment the config held.
 */
export function resolveUri({
  uri,
  baseUri = '',
}: {
  uri: string
  baseUri?: string
}) {
  try {
    return new URL(uri, baseUri).href
  } catch {
    return uri
  }
}

/**
 * Where a location's bytes come from, as an address worth showing someone, or
 * undefined when it has none.
 *
 * "None" is the honest answer for a Blob and a FileHandle: they are bytes the
 * user handed the page, with no address to go and check. It is the answer a
 * stalled-load notice needs — the notice exists to name a server that stopped
 * answering, and there is no server behind either of those.
 */
export function getLocationUri(location: FileLocation) {
  if (isUriLocation(location)) {
    return resolveUri(location)
  }
  if (isLocalPathLocation(location)) {
    return location.localPath
  }
  return undefined
}

/**
 * A download phase that names the file it is fetching, for the stalled-load
 * notice — a source-carrying phase when the location has an address to show, and
 * the bare label when it does not, which is the same thing the phase helpers
 * always took.
 */
export function downloadPhase(message: string, location: FileLocation) {
  const source = getLocationUri(location)
  return source === undefined ? message : { message, source }
}
