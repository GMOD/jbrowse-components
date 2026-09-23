import {
  isBlobLocation,
  isFileHandleLocation,
  isLocalPathLocation,
  mergeTrackConfig,
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

function sessionTracksWithEdits(snap: Record<string, unknown>) {
  const deltas = (snap.trackConfigDeltas ?? {}) as Record<
    string,
    Record<string, unknown> | undefined
  >
  return entries(snap, 'sessionTracks').map(entry => {
    const delta = deltas[entry.trackId as string]
    return delta ? mergeTrackConfig(entry, delta) : entry
  })
}

export function findLocalFileNames(snap: Record<string, unknown>) {
  return [
    ...sessionTracksWithEdits(snap),
    ...entries(snap, 'sessionAssemblies'),
    ...entries(snap, 'temporaryAssemblies'),
  ]
    .filter(entry => hasLocalFile(entry))
    .map(entry =>
      typeof entry.name === 'string'
        ? entry.name
        : typeof entry.trackId === 'string'
          ? entry.trackId
          : 'unnamed',
    )
}
