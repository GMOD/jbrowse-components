import {
  isBlobLocation,
  isFileHandleLocation,
  isLocalPathLocation,
} from '@jbrowse/core/util'

// A blob, a localPath and a file handle all live in the sender's browser or
// filesystem, so the recipient of a share link gets the track config with
// nothing behind it.
function hasLocalFile(node: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some(item => hasLocalFile(item))
  }
  if (typeof node === 'object' && node !== null) {
    return (
      isLocalPathLocation(node) ||
      isBlobLocation(node) ||
      isFileHandleLocation(node) ||
      Object.values(node).some(value => hasLocalFile(value))
    )
  }
  return false
}

function entries(snap: Record<string, unknown>, key: string) {
  const value = snap[key]
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

export function findLocalFileNames(snap: Record<string, unknown>) {
  return ['sessionTracks', 'sessionAssemblies', 'temporaryAssemblies']
    .flatMap(key => entries(snap, key))
    .filter(entry => hasLocalFile(entry))
    .map(entry =>
      typeof entry.name === 'string'
        ? entry.name
        : typeof entry.trackId === 'string'
          ? entry.trackId
          : 'unnamed',
    )
}
