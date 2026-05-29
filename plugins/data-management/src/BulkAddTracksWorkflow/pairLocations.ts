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

function stripLastExt(name: string) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? name : name.slice(0, dot)
}

function indexSuffixOf(name: string) {
  const lower = name.toLowerCase()
  return INDEX_SUFFIXES.find(suffix => lower.endsWith(suffix))
}

/**
 * Splits a flat list of locations into data files paired with their index
 * sidecars. Mirrors the JBrowse 1 FileDialog pairing rules: an index `I`
 * belongs to data file `D` when `I` is `D` + suffix (e.g. `foo.bam.bai`) or
 * `stripExt(D)` + suffix (e.g. `foo.bai`). Data files with no explicit index
 * are emitted with `index: undefined` so `guessAdapter` can infer it from the
 * URL. Unmatched index files are dropped.
 */
export function pairLocations(locations: FileLocation[]): LocationPair[] {
  const named = locations.map(loc => ({ loc, name: getFileName(loc) }))
  const indexEntries = named.filter(e => indexSuffixOf(e.name) !== undefined)
  const dataEntries = named.filter(e => indexSuffixOf(e.name) === undefined)
  const usedIndexes = new Set<FileLocation>()

  return dataEntries.map(({ loc, name }) => {
    const dataLower = name.toLowerCase()
    const match = indexEntries.find(({ loc: indexLoc, name: indexName }) => {
      const suffix = indexSuffixOf(indexName)
      const indexLower = indexName.toLowerCase()
      return (
        suffix !== undefined &&
        !usedIndexes.has(indexLoc) &&
        (indexLower === `${dataLower}${suffix}` ||
          indexLower === `${stripLastExt(dataLower)}${suffix}`)
      )
    })
    if (match) {
      usedIndexes.add(match.loc)
    }
    return { file: loc, index: match?.loc }
  })
}
