import { getFileName } from '@jbrowse/core/util/tracks'

import type { FileLocation } from '@jbrowse/core/util/types'

// Recognized index/sidecar file suffixes. A pasted file ending in one of these
// is treated as the index of a data file rather than a track of its own.
const INDEX_SUFFIXES = ['.bai', '.csi', '.crai', '.tbi', '.fai', '.gzi', '.idx']

export interface LocationPair {
  file: FileLocation
  index?: FileLocation
}

export interface PairedLocations {
  pairs: LocationPair[]
  /**
   * Index files no data file in the batch could have indexed — a `.tbi` pasted
   * without its `.vcf.gz`, or one whose kind fits nothing present. Not the same
   * as "unused": an index that merely lost the race for a data file's single
   * index slot (the `.gzi` beside the `.fai` of one `.fa.gz`, a `.csi` beside a
   * `.bai`) is left out, because its data file is right there and every adapter
   * needing a second sidecar derives it from the data file's own URL anyway.
   */
  orphanIndexes: FileLocation[]
}

/**
 * Identity of a location within one batch: two locations with the same id are
 * the same file. The full path for a URI or a local path, so same-named files
 * in different directories stay distinct; the bare filename for a blob or file
 * handle, which carries no path — and whose opaque id is minted fresh on every
 * drop, so identifying by that would let the same file dropped twice through as
 * two tracks. Doubles as the pairing key, which is why a dropped `foo.bam` and
 * `foo.bam.bai` can find each other at all.
 */
export function locationId(loc: FileLocation) {
  if ('uri' in loc) {
    return loc.uri
  } else if ('localPath' in loc) {
    return loc.localPath
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
// `.bgz` is listed everywhere `.gz` is: every format guesser accepts
// `\.b?gz$`, so `s.vcf.bgz` is as ordinary a tabix target as `s.vcf.gz`.
const indexedExtensions: Record<string, string[]> = {
  '.bai': ['bam'],
  '.crai': ['cram'],
  // csi indexes bam as well as anything bgzipped
  '.csi': ['bam', 'gz', 'bgz'],
  '.tbi': ['gz', 'bgz'],
  '.fai': ['fa', 'fasta', 'fna', 'fas', 'mfa'],
  '.gzi': ['gz', 'bgz'],
}

// the data file's own last extension, lowercased and without the dot
function fileExtension(name: string) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function canIndex(suffix: string, dataExtension: string) {
  return indexedExtensions[suffix]?.includes(dataExtension) ?? true
}

/**
 * Splits a flat list of locations into data files paired with their index
 * sidecars. Mirrors the JBrowse 1 FileDialog pairing rules: an index `I`
 * belongs to data file `D` when `I` is `D` + suffix (e.g. `foo.bam.bai`) or
 * `stripExt(D)` + suffix of a kind that can index `D` (e.g. `foo.bai`, but not
 * `foo.tbi`, for `foo.bam` — see `indexedExtensions`). Data files with no explicit index
 * are emitted with `index: undefined` so `guessAdapter` can infer it from the
 * URL. Index files no data file could have claimed come back separately as
 * `orphanIndexes`. Locations repeated under the same id (e.g. a URL pasted
 * twice) collapse to a single entry.
 */
export function pairLocations(locations: FileLocation[]): PairedLocations {
  // Dedupe by location id (e.g. a URL pasted twice). Callers that pre-dedupe
  // (the workflow component) keep this as a harmless no-op; direct callers and
  // tests rely on it.
  const entries = [
    ...new Map(
      locations.map(loc => {
        const id = locationId(loc)
        const name = getFileName(loc)
        return [
          id,
          {
            loc,
            lower: id.toLowerCase(),
            suffix: indexSuffixOf(name),
            extension: fileExtension(name),
          },
        ] as const
      }),
    ).values(),
  ]
  const dataEntries = entries.filter(e => e.suffix === undefined)

  // Build a map from stripLastExt(indexLower) → index entries for O(N) lookup.
  // Index "foo.bam.bai" → key "foo.bam" (matches data "foo.bam" directly).
  // Index "foo.bai"     → key "foo"     (matches data "foo.bam" via stripLastExt).
  // A key holds a list, not just the first entry: short-form indexes for
  // different formats collide there ("s.bai" and "s.crai" both key to "s"), so
  // the data file picks the one it can actually use rather than whichever was
  // pasted first.
  const indexMap = new Map<string, { loc: FileLocation; suffix: string }[]>()
  for (const { loc, lower, suffix } of entries) {
    if (suffix !== undefined) {
      const key = stripLastExt(lower)
      const found = indexMap.get(key)
      if (found) {
        found.push({ loc, suffix })
      } else {
        indexMap.set(key, [{ loc, suffix }])
      }
    }
  }

  // The same two rules `take` applies below, asked of the whole list instead of
  // one data file: an index nothing here could have taken is one the user
  // pasted without its data file, which is the only case worth reporting. Runs
  // before the pairing pass because it is a question about the input, not about
  // who won which slot — and because `take` empties the map as it goes.
  const longFormKeys = new Set(dataEntries.map(e => e.lower))
  const shortFormKeys = new Map<string, string[]>()
  for (const { lower, extension } of dataEntries) {
    const stem = stripLastExt(lower)
    const found = shortFormKeys.get(stem)
    if (found) {
      found.push(extension)
    } else {
      shortFormKeys.set(stem, [extension])
    }
  }
  const orphanIndexes = [...indexMap].flatMap(([key, indexes]) =>
    longFormKeys.has(key)
      ? []
      : indexes
          .filter(
            ({ suffix }) =>
              !shortFormKeys.get(key)?.some(ext => canIndex(suffix, ext)),
          )
          .map(({ loc }) => loc),
  )

  // Claim the first index at `key` this data file accepts, removing it so a
  // later data file can't be handed the same one.
  function take(key: string, accepts: (suffix: string) => boolean) {
    const found = indexMap.get(key)
    const idx = found?.findIndex(e => accepts(e.suffix)) ?? -1
    return idx === -1 ? undefined : found?.splice(idx, 1)[0]
  }

  const pairs = dataEntries.map(({ loc, lower: dataLower, extension }) => {
    const match =
      // long form: the index names its data file, so take it at its word
      take(dataLower, () => true) ??
      // short form: only an index of a kind that fits this file's extension
      take(stripLastExt(dataLower), suffix => canIndex(suffix, extension))
    return { file: loc, index: match?.loc }
  })

  return { pairs, orphanIndexes }
}
