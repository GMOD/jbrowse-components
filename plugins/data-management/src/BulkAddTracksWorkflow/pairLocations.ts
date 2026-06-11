import { getFileName } from '@jbrowse/core/util/tracks'

import type { FileLocation } from '@jbrowse/core/util/types'

// Recognized index/sidecar file suffixes. A pasted file ending in one of these
// is treated as the index of a data file rather than a track of its own.
export const INDEX_SUFFIXES = [
  '.bai',
  '.csi',
  '.crai',
  '.tbi',
  '.fai',
  '.gzi',
  '.idx',
]

export interface LocationPair {
  file: FileLocation
  index?: FileLocation
}

export function locationId(loc: FileLocation) {
  if ('uri' in loc) {
    return loc.uri
  } else if ('localPath' in loc) {
    return loc.localPath
  } else if ('blobId' in loc) {
    return loc.blobId
  } else {
    return getFileName(loc)
  }
}

function stripLastExt(name: string) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? name : name.slice(0, dot)
}

function indexSuffixOf(name: string) {
  const lower = name.toLowerCase()
  return INDEX_SUFFIXES.find(suffix => lower.endsWith(suffix))
}

/** True if the location's filename ends in a recognized index suffix. */
export function isIndexFile(loc: FileLocation) {
  return indexSuffixOf(getFileName(loc)) !== undefined
}

/**
 * Splits a flat list of locations into data files paired with their index
 * sidecars. Mirrors the JBrowse 1 FileDialog pairing rules: an index `I`
 * belongs to data file `D` when `I` is `D` + suffix (e.g. `foo.bam.bai`) or
 * `stripExt(D)` + suffix (e.g. `foo.bai`). Data files with no explicit index
 * are emitted with `index: undefined` so `guessAdapter` can infer it from the
 * URL. Unmatched index files are dropped. Data files repeated under the same
 * location (e.g. a URL pasted twice) collapse to a single entry.
 */
export function pairLocations(locations: FileLocation[]): LocationPair[] {
  const named = locations.map(loc => {
    const name = getFileName(loc)
    return { loc, lower: name.toLowerCase(), suffix: indexSuffixOf(name) }
  })
  const indexEntries = named.filter(e => e.suffix !== undefined)
  // Dedupe data files repeated under the same location (e.g. a URL pasted
  // twice). Callers that pre-dedupe (the workflow component) keep this as a
  // harmless no-op; direct callers and tests rely on it.
  const dataEntries = [
    ...new Map(
      named
        .filter(e => e.suffix === undefined)
        .map(e => [locationId(e.loc), e] as const),
    ).values(),
  ]
  const usedIndexes = new Set<FileLocation>()

  return dataEntries.map(({ loc, lower: dataLower }) => {
    const match = indexEntries.find(
      ({ loc: indexLoc, lower: indexLower, suffix }) =>
        suffix !== undefined &&
        !usedIndexes.has(indexLoc) &&
        (indexLower === `${dataLower}${suffix}` ||
          indexLower === `${stripLastExt(dataLower)}${suffix}`),
    )
    if (match) {
      usedIndexes.add(match.loc)
    }
    return { file: loc, index: match?.loc }
  })
}
