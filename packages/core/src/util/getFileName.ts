import type { FileLocation } from './types/index.ts'

// Handles both forward slashes and Windows backslashes in file:// URLs
function filenameFromPath(path: string) {
  return path.replaceAll('\\', '/').split('/').at(-1) ?? ''
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
      return filenameFromPath(location.uri)
    case 'LocalPathLocation':
      return filenameFromPath(location.localPath)
    default:
      return ''
  }
}
