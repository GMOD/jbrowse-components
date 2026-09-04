import { tabixIndexSnapshot } from '@jbrowse/core/configuration'

type Snapshot = Record<string, unknown>

/**
 * The one-line shorthand every MAF adapter's schema accepts: `uri` becomes the
 * adapter's gz slot, an `nhUri` sidecar becomes `nhLocation`, and `index`
 * derives the index slot the format uses. A snapshot already in full form
 * passes through untouched.
 */
export function expandMafShorthand(
  snap: Snapshot,
  gzSlot: string,
  index: (snap: Snapshot) => Snapshot,
) {
  return snap.uri
    ? {
        ...snap,
        ...(snap.nhUri
          ? { nhLocation: { uri: snap.nhUri, baseUri: snap.baseUri } }
          : {}),
        [gzSlot]: { uri: snap.uri, baseUri: snap.baseUri },
        ...index(snap),
      }
    : snap
}

export function taiIndexSlot(snap: Snapshot) {
  return { taiLocation: { uri: `${snap.uri}.tai`, baseUri: snap.baseUri } }
}

export function tabixIndexSlot(snap: Snapshot) {
  return { index: tabixIndexSnapshot(snap) }
}
