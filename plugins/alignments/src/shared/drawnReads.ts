import type {
  SampleEvents,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * The per-instance arrays the pileup draws: every detail array with a read
 * index, and the fade frequencies parallel to three of them.
 */
export type InstanceArrays = Pick<
  WorkerPileupData,
  | 'gapPositions'
  | 'gapTypes'
  | 'gapReadIndices'
  | 'gapFrequencies'
  | 'mismatchPositions'
  | 'mismatchBases'
  | 'mismatchStrands'
  | 'mismatchReadIndices'
  | 'mismatchFrequencies'
  | 'mismatchQuals'
  | 'softclipBasePositions'
  | 'softclipBaseBases'
  | 'softclipBaseReadIndices'
  | 'interbasePositions'
  | 'interbaseLengths'
  | 'interbaseTypes'
  | 'interbaseReadIndices'
  | 'interbaseSequences'
  | 'numInsertions'
  | 'numSoftclips'
  | 'numHardclips'
  | 'interbaseFrequencies'
  | 'modificationPositions'
  | 'modificationColors'
  | 'modificationProbabilities'
  | 'modificationReadIndices'
  | 'modificationTypeIndices'
  | 'modificationNoMod'
  | 'modificationTypes'
  | 'perBaseQualPositions'
  | 'perBaseQualScores'
  | 'perBaseQualReadIndices'
  | 'perBaseLetterPositions'
  | 'perBaseLetterBases'
  | 'perBaseLetterReadIndices'
  | 'segmentPositions'
  | 'segmentReadIndices'
  | 'segmentEdgeFlags'
  | 'numSegments'
>

/**
 * The position events the coverage band counts: the sample's while a filter
 * leaves reads out of the pileup, the drawn reads' otherwise.
 */
export function countedEventsOf(
  data: SampleEvents & { sampleEvents?: SampleEvents },
): SampleEvents {
  return data.sampleEvents ?? data
}

export function sampleEventsOf(all: InstanceArrays): SampleEvents {
  return {
    gapPositions: all.gapPositions,
    gapTypes: all.gapTypes,
    mismatchPositions: all.mismatchPositions,
    mismatchBases: all.mismatchBases,
    mismatchStrands: all.mismatchStrands,
    interbasePositions: all.interbasePositions,
    interbaseLengths: all.interbaseLengths,
    interbaseTypes: all.interbaseTypes,
    interbaseReadIndices: all.interbaseReadIndices,
    interbaseSequences: all.interbaseSequences,
    numInsertions: all.numInsertions,
    numSoftclips: all.numSoftclips,
    numHardclips: all.numHardclips,
  }
}

/**
 * Each read's index among the drawn ones (`drawn` 1), -1 for a read left
 * out, and the old index of each drawn read in order. Undefined when every
 * read is drawn.
 */
export function readCompaction(drawn: Uint8Array) {
  const count = drawn.length
  const remap = new Int32Array(count)
  let n = 0
  for (let i = 0; i < count; i++) {
    remap[i] = drawn[i] === 1 ? n++ : -1
  }
  const kept = new Uint32Array(n)
  for (let i = 0; i < count; i++) {
    const to = remap[i]!
    if (to !== -1) {
      kept[to] = i
    }
  }
  return n === count ? undefined : { remap, kept }
}

export type ReadCompaction = NonNullable<ReturnType<typeof readCompaction>>

interface NumberColumn {
  length: number
  [i: number]: number
}

// The instances a drawn read owns, in their order, so a position-sorted
// array stays sorted
function drawnInstances(readIndices: Uint32Array, remap: Int32Array) {
  let n = 0
  for (const r of readIndices) {
    if (remap[r] !== -1) {
      n++
    }
  }
  const at = new Uint32Array(n)
  let w = 0
  for (let i = 0; i < readIndices.length; i++) {
    if (remap[readIndices[i]!] !== -1) {
      at[w++] = i
    }
  }
  return at
}

function gather<T extends NumberColumn>(
  from: ArrayLike<number>,
  at: Uint32Array,
  into: T,
  stride = 1,
) {
  for (let k = 0; k < at.length; k++) {
    for (let s = 0; s < stride; s++) {
      into[k * stride + s] = from[at[k]! * stride + s]!
    }
  }
  return into
}

function remapped(
  readIndices: Uint32Array,
  at: Uint32Array,
  remap: Int32Array,
) {
  const out = new Uint32Array(at.length)
  for (let k = 0; k < at.length; k++) {
    out[k] = remap[readIndices[at[k]!]!]!
  }
  return out
}

function countBelow(at: Uint32Array, end: number) {
  let n = 0
  while (n < at.length && at[n]! < end) {
    n++
  }
  return n
}

function drawnModifications(a: InstanceArrays, remap: Int32Array) {
  const at = drawnInstances(a.modificationReadIndices, remap)
  const { modificationProbabilities, modificationTypeIndices } = a
  const { modificationNoMod } = a
  return {
    modificationPositions: gather(
      a.modificationPositions,
      at,
      new Uint32Array(at.length),
    ),
    modificationColors: gather(
      a.modificationColors,
      at,
      new Uint32Array(at.length),
    ),
    modificationProbabilities:
      modificationProbabilities &&
      gather(modificationProbabilities, at, new Uint8Array(at.length)),
    modificationReadIndices: remapped(a.modificationReadIndices, at, remap),
    modificationTypeIndices:
      modificationTypeIndices &&
      gather(modificationTypeIndices, at, new Uint8Array(at.length)),
    modificationNoMod:
      modificationNoMod &&
      gather(modificationNoMod, at, new Uint8Array(at.length)),
    modificationTypes: a.modificationTypes,
  }
}

function drawnInterbase(a: InstanceArrays, remap: Int32Array) {
  const at = drawnInstances(a.interbaseReadIndices, remap)
  const insertions = countBelow(at, a.numInsertions)
  const softclips = countBelow(at, a.numInsertions + a.numSoftclips)
  return {
    interbasePositions: gather(
      a.interbasePositions,
      at,
      new Uint32Array(at.length),
    ),
    interbaseLengths: gather(
      a.interbaseLengths,
      at,
      new Uint32Array(at.length),
    ),
    interbaseTypes: gather(a.interbaseTypes, at, new Uint8Array(at.length)),
    interbaseReadIndices: remapped(a.interbaseReadIndices, at, remap),
    interbaseSequences: Array.from(at, i => a.interbaseSequences[i]!),
    numInsertions: insertions,
    numSoftclips: softclips - insertions,
    numHardclips: at.length - softclips,
    interbaseFrequencies: gather(
      a.interbaseFrequencies,
      at,
      new Uint8Array(at.length),
    ),
  }
}

/**
 * The instances of the drawn reads, each carrying its new read index. A
 * frequency is the one the instance had among every read, so the fade reads
 * an allele's share of the coverage.
 */
export function drawnInstanceArrays(
  a: InstanceArrays,
  { remap }: ReadCompaction,
): InstanceArrays {
  const gaps = drawnInstances(a.gapReadIndices, remap)
  const mismatches = drawnInstances(a.mismatchReadIndices, remap)
  const softclipBases = drawnInstances(a.softclipBaseReadIndices, remap)
  const quals = drawnInstances(a.perBaseQualReadIndices, remap)
  const letters = drawnInstances(a.perBaseLetterReadIndices, remap)
  const segments = drawnInstances(a.segmentReadIndices, remap)
  return {
    gapPositions: gather(
      a.gapPositions,
      gaps,
      new Uint32Array(gaps.length * 2),
      2,
    ),
    gapTypes: gather(a.gapTypes, gaps, new Uint8Array(gaps.length)),
    gapReadIndices: remapped(a.gapReadIndices, gaps, remap),
    gapFrequencies: gather(a.gapFrequencies, gaps, new Uint8Array(gaps.length)),
    mismatchPositions: gather(
      a.mismatchPositions,
      mismatches,
      new Uint32Array(mismatches.length),
    ),
    mismatchBases: gather(
      a.mismatchBases,
      mismatches,
      new Uint8Array(mismatches.length),
    ),
    mismatchStrands: gather(
      a.mismatchStrands,
      mismatches,
      new Int8Array(mismatches.length),
    ),
    mismatchReadIndices: remapped(a.mismatchReadIndices, mismatches, remap),
    mismatchFrequencies: gather(
      a.mismatchFrequencies,
      mismatches,
      new Uint8Array(mismatches.length),
    ),
    mismatchQuals: gather(
      a.mismatchQuals,
      mismatches,
      new Uint8Array(mismatches.length),
    ),
    softclipBasePositions: gather(
      a.softclipBasePositions,
      softclipBases,
      new Uint32Array(softclipBases.length),
    ),
    softclipBaseBases: gather(
      a.softclipBaseBases,
      softclipBases,
      new Uint8Array(softclipBases.length),
    ),
    softclipBaseReadIndices: remapped(
      a.softclipBaseReadIndices,
      softclipBases,
      remap,
    ),
    ...drawnInterbase(a, remap),
    ...drawnModifications(a, remap),
    perBaseQualPositions: gather(
      a.perBaseQualPositions,
      quals,
      new Uint32Array(quals.length),
    ),
    perBaseQualScores: gather(
      a.perBaseQualScores,
      quals,
      new Uint8Array(quals.length),
    ),
    perBaseQualReadIndices: remapped(a.perBaseQualReadIndices, quals, remap),
    perBaseLetterPositions: gather(
      a.perBaseLetterPositions,
      letters,
      new Uint32Array(letters.length),
    ),
    perBaseLetterBases: gather(
      a.perBaseLetterBases,
      letters,
      new Uint8Array(letters.length),
    ),
    perBaseLetterReadIndices: remapped(
      a.perBaseLetterReadIndices,
      letters,
      remap,
    ),
    segmentPositions: gather(
      a.segmentPositions,
      segments,
      new Uint32Array(segments.length * 2),
      2,
    ),
    segmentReadIndices: remapped(a.segmentReadIndices, segments, remap),
    segmentEdgeFlags: gather(
      a.segmentEdgeFlags,
      segments,
      new Uint8Array(segments.length),
    ),
    numSegments: segments.length,
  }
}

// A per-read list's drawn entries; an empty list, one nothing filled, stays
// empty
function drawnEntries<T>(list: readonly T[], { kept }: ReadCompaction) {
  return list.length === 0 ? [] : Array.from(kept, i => list[i]!)
}

/** The extraction's per-read lists, and the records they came from. */
export interface ReadLists<F> {
  features: F[]
  rawFeatures: Feature[]
  tagColorValues: string[]
  sortTagValues: string[] | undefined
  nextPositions: number[]
  suppAlignments: string[] | undefined
  categoryBits: Uint8Array
  clipAtStart: number[]
}

/** The drawn reads' entries of each list, in read order. */
export function drawnReadLists<F>(
  lists: ReadLists<F>,
  compaction: ReadCompaction,
): ReadLists<F> {
  const { tagColorValues, sortTagValues, suppAlignments } = lists
  const drawnTags = drawnEntries(tagColorValues, compaction)
  return {
    features: drawnEntries(lists.features, compaction),
    rawFeatures: drawnEntries(lists.rawFeatures, compaction),
    tagColorValues: drawnTags,
    sortTagValues:
      sortTagValues === tagColorValues
        ? drawnTags
        : sortTagValues && drawnEntries(sortTagValues, compaction),
    nextPositions: drawnEntries(lists.nextPositions, compaction),
    suppAlignments: suppAlignments && drawnEntries(suppAlignments, compaction),
    categoryBits: gather(
      lists.categoryBits,
      compaction.kept,
      new Uint8Array(compaction.kept.length),
    ),
    clipAtStart: drawnEntries(lists.clipAtStart, compaction),
  }
}
