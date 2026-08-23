import { isLocalPathLocation, isUriLocation } from './types/data.ts'

import type { FileLocation } from './types/data.ts'

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
 * An address with its query string dropped, which is what makes it safe to put
 * on screen. A presigned S3 or GCS link carries its credential in the query — a
 * few hundred characters of `?X-Amz-Signature=…` — and a notice that renders one
 * puts it in front of whoever is looking at the screen and into every screenshot
 * of it. The host and path are the whole diagnostic anyway.
 *
 * Same reasoning as {@link getFileName}'s own strip. A URL only: `?` is a legal
 * character in a POSIX filename, so a path keeps whatever it was given, and a
 * scheme is what tells the two apart when the caller has a bare string rather
 * than a typed location.
 */
export function redactSource(source: string) {
  return source.includes('://') ? source.split(/[?#]/)[0]! : source
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
    return redactSource(resolveUri(location))
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
 *
 * **Only for a read this process does not perform.** Anything going through
 * `fetchAndMaybeUnzip` takes its source off the filehandle and needs none of
 * this; what is left is the readers that open a handle and then do their own
 * reads through it — `@gmod/twobit` and `@gmod/indexedfasta` — where the phase
 * has to be built from the config the handle was opened from instead.
 */
export function downloadPhase(message: string, location: FileLocation) {
  const source = getLocationUri(location)
  return source === undefined ? message : { message, source }
}
