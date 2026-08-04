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

// Deliberately last-dot-only, unlike core's compression-aware
// stripFileExtension: pairing needs `foo.bam.bai` -> `foo.bam` to match its
// data file, and peeling the `.gz` off `foo.vcf.gz.tbi` would break that.
function stripLastExt(name: string) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? name : name.slice(0, dot)
}

// Key used to match data files to their index sidecars. Uses the full path
// (uri/localPath) so same-named files in different directories don't collide;
// blob/file-handle locations have no path, so fall back to their filename.
function pairingId(loc: FileLocation) {
  if ('uri' in loc) {
    return loc.uri
  } else if ('localPath' in loc) {
    return loc.localPath
  } else {
    return getFileName(loc)
  }
}

function indexSuffixOf(name: string) {
  const lower = name.toLowerCase()
  return INDEX_SUFFIXES.find(suffix => lower.endsWith(suffix))
}

// The data-file extensions each index suffix can legitimately index. Consulted
// only for the short form (`s.bai` next to `s.bam`), whose name records nothing
// about what it indexes: pasting a bam and a vcf that share a stem otherwise
// hands the bam whichever index came first, so `s.bam` picks up `s.tbi`. The
// long form (`s.bam.bai`) names its data file outright and is taken at its
// word, as is any suffix absent from this table (`.idx`, which sits beside
// several formats).
const indexedExtensions: Record<string, string[]> = {
  '.bai': ['bam'],
  '.crai': ['cram'],
  // csi indexes bam as well as anything bgzipped
  '.csi': ['bam', 'gz'],
  '.tbi': ['gz'],
  '.fai': ['fa', 'fasta', 'fna', 'fas'],
  '.gzi': ['gz'],
}

// the data file's own last extension, lowercased and without the dot
function fileExtension(name: string) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function canIndex(suffix: string, dataExtension: string) {
  return indexedExtensions[suffix]?.includes(dataExtension) ?? true
}

/** True if the location's filename ends in a recognized index suffix. */
export function isIndexFile(loc: FileLocation) {
  return indexSuffixOf(getFileName(loc)) !== undefined
}

/**
 * Splits a flat list of locations into data files paired with their index
 * sidecars. Mirrors the JBrowse 1 FileDialog pairing rules: an index `I`
 * belongs to data file `D` when `I` is `D` + suffix (e.g. `foo.bam.bai`) or
 * `stripExt(D)` + suffix of a kind that can index `D` (e.g. `foo.bai`, but not
 * `foo.tbi`, for `foo.bam` — see `indexedExtensions`). Data files with no explicit index
 * are emitted with `index: undefined` so `guessAdapter` can infer it from the
 * URL. Unmatched index files are dropped. Data files repeated under the same
 * location (e.g. a URL pasted twice) collapse to a single entry.
 */
export function pairLocations(locations: FileLocation[]): LocationPair[] {
  const named = locations.map(loc => {
    const name = getFileName(loc)
    return {
      loc,
      lower: pairingId(loc).toLowerCase(),
      suffix: indexSuffixOf(name),
      extension: fileExtension(name),
    }
  })
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
  // Build a map from stripLastExt(indexLower) → index entries for O(N) lookup.
  // Index "foo.bam.bai" → key "foo.bam" (matches data "foo.bam" directly).
  // Index "foo.bai"     → key "foo"     (matches data "foo.bam" via stripLastExt).
  // A key holds a list, not just the first entry: short-form indexes for
  // different formats collide there ("s.bai" and "s.crai" both key to "s"), so
  // the data file picks the one it can actually use rather than whichever was
  // pasted first.
  const indexMap = new Map<string, { loc: FileLocation; suffix: string }[]>()
  for (const { loc, lower, suffix } of named) {
    if (suffix !== undefined) {
      const key = stripLastExt(lower)
      const entries = indexMap.get(key)
      if (entries) {
        entries.push({ loc, suffix })
      } else {
        indexMap.set(key, [{ loc, suffix }])
      }
    }
  }

  // Claim the first index at `key` this data file accepts, removing it so a
  // later data file can't be handed the same one.
  function take(key: string, accepts: (suffix: string) => boolean) {
    const entries = indexMap.get(key)
    const idx = entries?.findIndex(e => accepts(e.suffix)) ?? -1
    return idx === -1 ? undefined : entries?.splice(idx, 1)[0]
  }

  return dataEntries.map(({ loc, lower: dataLower, extension }) => {
    const match =
      // long form: the index names its data file, so take it at its word
      take(dataLower, () => true) ??
      // short form: only an index of a kind that fits this file's extension
      take(stripLastExt(dataLower), suffix => canIndex(suffix, extension))
    return { file: loc, index: match?.loc }
  })
}
