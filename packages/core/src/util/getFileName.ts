import {
  isBlobLocation,
  isFileHandleLocation,
  isLocalPathLocation,
  isUriLocation,
} from './types/data.ts'

import type { FileLocation } from './types/data.ts'

function lastSegment(path: string) {
  return path.replaceAll('\\', '/').split('/').at(-1) ?? ''
}

// A query string is a request parameter, not part of the name: a presigned S3 or
// GCS link ends in a few hundred characters of `?X-Amz-Signature=...`, slashes
// included, and every caller here either shows the name to someone or matches
// an extension against the end of it. Stripped for a URI only — `?` is a legal
// character in a POSIX filename, so a local path keeps whatever it was given.
function withoutQuery(uri: string) {
  return uri.split(/[?#]/, 1)[0]!
}

/**
 * The bare filename a location refers to, for every location type — a Blob and
 * a FileHandle carry their name directly, a URI and a local path carry it as the
 * last path segment. A location a config stored without its `locationType`
 * reads by the field it carries.
 *
 * Its own module rather than living in `tracks.ts` because the assembly form
 * helpers need it too, and `tracks.ts` pulls in MST and the configuration
 * system. Re-exported from `tracks.ts`, which is the import path plugins use.
 */
export function getFileName(location: FileLocation) {
  return isBlobLocation(location) || isFileHandleLocation(location)
    ? location.name
    : isUriLocation(location)
      ? lastSegment(withoutQuery(location.uri))
      : isLocalPathLocation(location)
        ? lastSegment(location.localPath)
        : ''
}
