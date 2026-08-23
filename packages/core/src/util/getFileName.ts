import type { FileLocation } from './types/data.ts'

// Handles both forward slashes and Windows backslashes in file:// URLs
function filenameFromPath(path: string) {
  return path.replaceAll('\\', '/').split('/').at(-1) ?? ''
}

// A query string is a request parameter, not part of the name: a presigned S3 or
// GCS link ends in a few hundred characters of `?X-Amz-Signature=...`, and every
// caller here either shows the name to someone or matches an extension against
// the end of it. Stripped for a URI only — `?` is a legal character in a POSIX
// filename, so a local path keeps whatever it was given.
function withoutQuery(filename: string) {
  return filename.split(/[?#]/)[0]!
}

/**
 * The bare filename a location refers to, for every location type — a Blob and
 * a FileHandle carry their name directly, a URI and a local path carry it as the
 * last path segment.
 *
 * Its own module rather than living in `tracks.ts` because the assembly form
 * helpers need it too, and `tracks.ts` pulls in MST and the configuration
 * system. Re-exported from `tracks.ts`, which is the import path plugins use.
 */
export function getFileName(location: FileLocation) {
  switch (location.locationType) {
    case 'BlobLocation':
    case 'FileHandleLocation':
      return location.name
    case 'UriLocation':
      return withoutQuery(filenameFromPath(location.uri))
    case 'LocalPathLocation':
      return filenameFromPath(location.localPath)
    default:
      return ''
  }
}
