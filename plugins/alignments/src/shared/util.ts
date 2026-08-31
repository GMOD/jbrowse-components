import { SAM_FLAG_SECOND_IN_PAIR } from '@jbrowse/cigar-utils'
import { getContrastText } from '@jbrowse/core/ui/palette'

import type { FilterBy } from './types.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Feature } from '@jbrowse/core/util'

export const defaultFilterFlags = {
  flagInclude: 0,
  flagExclude: 1540,
}

// A feature's SAM bitwise flags, defaulting to 0 for features that carry none
// (e.g. PAF/synteny). The cast is centralized here so the ~half-dozen flag reads
// across the worker and feature extractors don't each re-spell it.
//
// `flags` answers the SAM-only questions — paired, supplementary, secondary,
// first/second-in-pair, mate-unmapped. It must NOT answer "which way does this
// point": see getStrand.
export function getFlags(feature: Feature) {
  return (feature.get('flags') as number | undefined) ?? 0
}

/**
 * A feature's strand, normalized to -1 / 0 / 1. THE source of strand for
 * everything downstream of an adapter — never re-derive it from
 * `SAM_FLAG_REVERSE`.
 *
 * Strand is a universal `Feature` concept and every source populates it;
 * SAM flags are a format-specific bitfield that only SAM-flavoured sources
 * have. BAM/CRAM/SAM define `strand` FROM the reverse flag inside their own
 * feature classes (e.g. `SamRecordFeature.strand`), which is the one place that
 * conversion belongs. A PAF/synteny block — which LGVSyntenyDisplay pushes
 * through this same pipeline — carries a real strand and no flags at all, so
 * `getFlags` returns 0 and any flag-derived strand reports it forward.
 *
 * Every strand bug this plugin has had was a `SAM_FLAG_REVERSE` read outside an
 * adapter, agreeing with `strand` on the BAMs under test and disagreeing on
 * synteny. Reading it here means a new call site cannot make that choice.
 */
export function getStrand(feature: Feature): -1 | 0 | 1 {
  const strand = feature.get('strand')
  return strand === -1 ? -1 : strand === 1 ? 1 : 0
}

/**
 * The FRAGMENT's strand, inferred from the first mate: read2 maps opposite the
 * fragment, so its strand is inverted; read1 and single-end reads report the
 * fragment strand directly.
 *
 * One implementation, deliberately shared by the two consumers that are
 * REQUIRED to agree — the `firstOfPairStrand` color scheme (colorUtils's
 * `readColorCategory`) and its grouping twin (`firstOfPairStrandKey`). They used
 * to spell the rule twice under a comment promising they matched, and drifted:
 * one read `strand`, the other `SAM_FLAG_REVERSE`, so a flagless feature
 * grouped forward while it painted reverse.
 */
export function firstOfPairStrand(strand: number, flags: number) {
  return flags & SAM_FLAG_SECOND_IN_PAIR ? -strand : strand
}

// The SAM spec's "mapping quality is not available" sentinel — a real value with
// a meaning, not a score. Named because two places have to agree on it: this
// file produces it, and `readColorCategory` gives it its own color bucket rather
// than feeding 255 to the MAPQ hue ramp.
export const MAPQ_UNAVAILABLE = 255

// A feature's mapping quality, or MAPQ_UNAVAILABLE when it has none.
// BAM/CRAM spell it `score`; PAF/MashMap synteny features, which
// LGVSyntenyDisplay pushes through this same pipeline, spell it `mappingQual`
// and leave `score` unset. `score` is read first because it is a switch case on
// BamSlightlyLazyFeature while any other field name falls through to its
// lazily-materialized `fields` object, and this runs once per read.
export function getMappingQuality(feature: Feature) {
  const score = feature.get('score')
  const mappingQual =
    score === undefined
      ? (feature.get('mappingQual') as number | undefined)
      : score
  return mappingQual ?? MAPQ_UNAVAILABLE
}

// Get `key`'s entry, lazily creating + inserting it on first miss. The shared
// shape of every "accumulate into a Map of arrays / nested Maps" pass. (The TC39
// `Map.prototype.getOrInsertComputed` upsert proposal would fold this into one
// lookup, but it isn't in shipping runtimes yet and the second lookup is noise
// next to the per-read work — swap it in here once it lands, if ever.)
//
// `make`'s return is `NoInfer` so the VALUE TYPE comes from the map alone. It
// used to be inferred from both, and a bare `() => new Map()` / `() => []`
// contributes `Map<any, any>` / `any[]` — which wins, so every `.set`/`.push` on
// the result was unchecked whatever the map's own annotation said, at all ten
// call sites. `buildRawDataByGroup` was writing the wrong tier of pileup data
// through exactly that hole, invisibly.
export function getOrCreate<K, V>(
  map: Map<K, V>,
  key: K,
  make: () => NoInfer<V>,
): V {
  let value = map.get(key)
  if (value === undefined) {
    value = make()
    map.set(key, value)
  }
  return value
}

export function filterReadFlag(
  flags: number,
  flagInclude: number,
  flagExclude: number,
) {
  return (flags & flagInclude) !== flagInclude || (flags & flagExclude) !== 0
}

// True when the spliced-read filter drops this read. `hasSkip` is a thunk
// because answering it means walking the CIGAR, which no read pays for while
// the filter is off.
export function filterSpliced(
  spliced: FilterBy['spliced'],
  hasSkip: () => boolean,
) {
  return spliced === 'only'
    ? !hasSkip()
    : spliced === 'exclude'
      ? hasSkip()
      : false
}

// An absent value means the same as '*' — "reads that carry this tag" — which
// is what a hand-written `tagFilters: [{tag: 'HP'}]` can only have meant.
// Comparing against the absent value stringified kept exactly the reads
// LACKING the tag.
export function filterTagValue(readVal: unknown, filterVal = '*') {
  return filterVal === '*' ? readVal === undefined : `${readVal}` !== filterVal
}

export interface SamHeaderLine {
  tag: string
  data: { tag: string; value: string }[]
}

export interface ParsedSamHeader {
  idToName: string[]
  nameToId: Record<string, number>
  readGroups: string[]
}

export function parseSamHeader(samHeader: SamHeaderLine[]): ParsedSamHeader {
  const idToName: string[] = []
  const nameToId: Record<string, number> = {}
  const readGroups: string[] = []
  let refId = 0
  let rgId = 0

  for (const line of samHeader) {
    if (line.tag === 'SQ') {
      const sn = line.data.find(d => d.tag === 'SN')
      if (sn) {
        nameToId[sn.value] = refId
        idToName[refId] = sn.value
      }
      refId++
    } else if (line.tag === 'RG') {
      const id = line.data.find(d => d.tag === 'ID')
      if (id) {
        readGroups[rgId] = id.value
      }
      rgId++
    }
  }

  return { idToName, nameToId, readGroups }
}

function getColorBaseMap(palette: JBrowsePalette) {
  const { skip, deletion, insertion, hardclip, softclip, bases } = palette
  return {
    A: bases.A.main,
    C: bases.C.main,
    G: bases.G.main,
    T: bases.T.main,
    deletion,
    insertion,
    hardclip,
    softclip,
    skip,
  }
}

export function getContrastBaseMap(palette: JBrowsePalette) {
  return Object.fromEntries(
    Object.entries(getColorBaseMap(palette)).map(([key, value]) => [
      key,
      getContrastText(value),
    ]),
  )
}

// Returns contrast colors for mismatch/softclip/per-base letters. The rects
// under these letters are always drawn in the base palette (baseColors.ts),
// independent of colorBy.type — only showModifications mutes them to a uniform
// grey. So contrast text is meaningful in every color mode except when
// modifications collapse the rects to grey, where black reads best and the
// empty map makes drawAlignmentLabels fall back to it.
export function getMismatchContrastMap(
  showModifications: boolean,
  palette: JBrowsePalette,
): Record<string, string> {
  return showModifications ? {} : getContrastBaseMap(palette)
}

function isTypedArray(
  val: unknown,
): val is
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array {
  return ArrayBuffer.isView(val) && !(val instanceof DataView)
}

/**
 * Convert TypedArrays in tags object to plain number arrays.
 * This is needed because MobX State Tree cannot freeze TypedArray views.
 */
export function convertTagsToPlainArrays(
  tags: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(tags)) {
    result[key] = isTypedArray(value) ? [...value] : value
  }
  return result
}
