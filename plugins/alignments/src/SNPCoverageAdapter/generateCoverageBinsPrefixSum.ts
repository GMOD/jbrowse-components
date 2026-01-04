import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { processDepthPrefixSum } from './processDepthPrefixSum'
import { processModifications } from './processModifications'
import { processReferenceCpGs } from './processReferenceCpGs'
import {
  createEmptyBin,
  createPreBinEntry,
  isInterbase,
  mismatchLen,
} from './util'
import { CHAR_FROM_CODE } from '../PileupRenderer/renderers/cigarUtil'
import {
  DELSKIP_MASK,
  MISMATCH_MAP,
  MISMATCH_REV_MAP,
  SKIP_TYPE,
} from '../shared/forEachMismatchTypes'

import type { Opts } from './util'
import type {
  BaseCoverageBin,
  FeatureWithMismatchIterator,
  Mismatch,
  PreBaseCoverageBin,
  PreBinEntry,
  SkipMap,
} from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

// Structure-of-arrays result format for efficient rendering
export interface CoverageBinsSoA {
  starts: number[]
  ends: number[]
  scores: number[]
  snpinfo: BaseCoverageBin[]
  skipmap: SkipMap
}

// Convert bins array to structure-of-arrays format
function binsArrayToSoA(
  bins: (PreBaseCoverageBin | undefined)[],
  binCount: number,
  regionStart: number,
  skipmap: SkipMap,
): CoverageBinsSoA {
  const starts: number[] = new Array(binCount)
  const ends: number[] = new Array(binCount)
  const scores: number[] = new Array(binCount)
  const snpinfo: BaseCoverageBin[] = new Array(binCount)

  // Already in sorted order since we iterate sequentially
  let idx = 0
  for (let pos = 0, l = bins.length; pos < l; pos++) {
    const bin = bins[pos]
    if (bin) {
      const start = regionStart + pos
      starts[idx] = start
      ends[idx] = start + 1
      scores[idx] = bin.depth
      snpinfo[idx] = bin
      idx++
    }
  }

  return { starts, ends, scores, snpinfo, skipmap }
}

// Reusable change arrays for deletion prefix sums
const MAX_REGION_SIZE = 1_000_000
const deletionChanges: number[] = new Array(MAX_REGION_SIZE + 1).fill(0)

interface SparseSnpEntry {
  base: string
  strand: -1 | 0 | 1
  altbase?: string
}

interface SparseNoncovEntry {
  strand: -1 | 0 | 1
  type: 'insertion' | 'softclip' | 'hardclip'
  length: number
  sequence?: string
}

function finalizeBinEntry(entry: PreBinEntry) {
  const { probabilityTotal, probabilityCount, lengthTotal, lengthCount } = entry
  if (probabilityCount) {
    entry.avgProbability = probabilityTotal / probabilityCount
  }
  if (lengthCount) {
    entry.avgLength = lengthTotal / lengthCount
    entry.minLength = entry.lengthMin
    entry.maxLength = entry.lengthMax
  }
  if (entry.sequenceCounts?.size) {
    let maxCount = 0
    let topSeq: string | undefined
    for (const [seq, count] of entry.sequenceCounts) {
      if (count > maxCount) {
        maxCount = count
        topSeq = seq
      }
    }
    entry.topSequence = topSeq
    entry.sequenceCounts = undefined
  }
}

/**
 * Generate coverage bins using prefix sums algorithm.
 *
 * This is ~100-1000x faster than the original per-base iteration approach,
 * especially for high-coverage or long-read data.
 *
 * Returns structure-of-arrays format for efficient rendering.
 */
export async function generateCoverageBinsPrefixSum({
  fetchSequence,
  features,
  region,
  opts,
}: {
  features: FeatureWithMismatchIterator[]
  region: Region
  opts: Opts
  fetchSequence?: (arg: Region) => Promise<string | undefined>
}): Promise<CoverageBinsSoA> {
  const { stopToken, colorBy, statsEstimationMode } = opts
  const regionStart = region.start
  const regionEnd = region.end
  const regionSize = regionEnd - regionStart

  // Step 1: Compute depth using prefix sums - O(features + regionSize)
  checkStopToken(stopToken)
  const depthSoA = processDepthPrefixSum(features, region)

  // In statsEstimationMode, skip all mismatch/modification processing. This is a
  // performance optimization for when only the depth of coverage is needed, for
  // example, for an overview of the data or when calculating statistics. Just
  // return depth-only bins for fast coverage estimation
  if (statsEstimationMode) {
    const bins: (PreBaseCoverageBin | undefined)[] = []
    let binCount = 0
    for (let i = 0; i < regionSize; i++) {
      const depth = depthSoA.depth[i]!
      if (depth === 0) {
        continue
      }
      binCount++
      bins[i] = {
        depth,
        readsCounted: depth,
        ref: {
          entryDepth: depth,
          '-1': depthSoA.strandMinus[i]!,
          '0': 0,
          '1': depthSoA.strandPlus[i]!,
          probabilityTotal: 0,
          probabilityCount: 0,
          lengthTotal: 0,
          lengthCount: 0,
          lengthMin: Infinity,
          lengthMax: -Infinity,
        },
        snps: {},
        mods: {},
        nonmods: {},
        delskips: {},
        noncov: {},
      }
    }
    return binsArrayToSoA(bins, binCount, regionStart, {})
  }

  // Step 2: Process mismatches with prefix sums for deletions
  checkStopToken(stopToken)
  // Clear deletion changes buffer
  for (let i = 0; i <= regionSize; i++) {
    deletionChanges[i] = 0
  }

  const snpEvents: { pos: number; entry: SparseSnpEntry }[] = []
  const noncovEvents: { pos: number; entry: SparseNoncovEntry }[] = []
  const skipmap: SkipMap = {}

  for (let i = 0, l = features.length; i < l; i++) {
    processFeature(region, features[i]!, skipmap, noncovEvents, snpEvents)
  }

  // Compute deletion depth prefix sums
  const deletionDepth: number[] = new Array(regionSize)
  let dd = 0
  for (let i = 0; i < regionSize; i++) {
    dd += deletionChanges[i]!
    deletionDepth[i] = dd
  }

  // Step 3: Handle modifications if needed (still per-feature, but modifications are rare)
  let regionSequence: string | undefined
  const modBins: PreBaseCoverageBin[] = []
  const start2 = Math.max(0, regionStart - 1)
  const diff = regionStart - start2

  if (colorBy?.type === 'modifications' && fetchSequence) {
    checkStopToken(stopToken)
    regionSequence =
      (await fetchSequence({
        ...region,
        start: start2,
        end: regionEnd + 1,
      })) || ''
    const slicedSequence = regionSequence.slice(diff)

    for (const feature of features) {
      processModifications({
        feature,
        colorBy,
        bins: modBins,
        region,
        regionSequence: slicedSequence,
      })
    }
  } else if (colorBy?.type === 'methylation' && fetchSequence) {
    checkStopToken(stopToken)
    regionSequence ??=
      (await fetchSequence({
        ...region,
        start: start2,
        end: regionEnd + 1,
      })) || ''

    for (const feature of features) {
      processReferenceCpGs({
        feature,
        bins: modBins,
        region,
        regionSequence,
      })
    }
  }

  // Step 4: Build final bins array - only create objects for positions with data
  checkStopToken(stopToken)
  const bins: (PreBaseCoverageBin | undefined)[] = []
  let binCount = 0

  // First pass: create bins only where we have depth > 0 or other data
  for (let i = 0; i < regionSize; i++) {
    const depth = depthSoA.depth[i]!
    const delDepth = deletionDepth[i]!

    // Skip empty positions (sparse optimization)
    if (depth === 0 && delDepth === 0) {
      continue
    }

    binCount++
    bins[i] = {
      depth: depth - delDepth,
      readsCounted: depth,
      ref: {
        entryDepth: depth,
        '-1': depthSoA.strandMinus[i]!,
        '0': 0,
        '1': depthSoA.strandPlus[i]!,
        probabilityTotal: 0,
        probabilityCount: 0,
        lengthTotal: 0,
        lengthCount: 0,
        lengthMin: Infinity,
        lengthMax: -Infinity,
      },
      snps: {},
      mods: {},
      nonmods: {},
      delskips: delDepth > 0 ? { deletion: createDeletionEntry(delDepth) } : {},
      noncov: {},
    }
  }

  // Apply SNP events
  for (let i = 0, l = snpEvents.length; i < l; i++) {
    const evt = snpEvents[i]!
    const pos = evt.pos
    const entry = evt.entry

    let bin = bins[pos]
    if (!bin) {
      bin = {
        depth: 0,
        readsCounted: 0,
        snps: {},
        ref: {
          entryDepth: 0,
          '-1': 0,
          '0': 0,
          '1': 0,
          probabilityTotal: 0,
          probabilityCount: 0,
          lengthTotal: 0,
          lengthCount: 0,
          lengthMin: Infinity,
          lengthMax: -Infinity,
        },
        mods: {},
        nonmods: {},
        delskips: {},
        noncov: {},
      }
      bins[pos] = bin
      binCount++
    }
    const base = entry.base
    const strand = entry.strand
    let snpEntry = bin.snps[base]
    if (!snpEntry) {
      snpEntry = {
        entryDepth: 0,
        '-1': 0,
        '0': 0,
        '1': 0,
        probabilityTotal: 0,
        probabilityCount: 0,
        lengthTotal: 0,
        lengthCount: 0,
        lengthMin: Infinity,
        lengthMax: -Infinity,
      }
      bin.snps[base] = snpEntry
    }
    snpEntry.entryDepth++
    snpEntry[strand]++
    bin.ref.entryDepth--
    bin.ref[strand]--
    if (entry.altbase) {
      bin.refbase = entry.altbase
    }
  }

  // Apply noncov events (insertions, clips)
  for (let i = 0, l = noncovEvents.length; i < l; i++) {
    const evt = noncovEvents[i]!
    const pos = evt.pos
    const entry = evt.entry

    let bin = bins[pos]
    if (!bin) {
      bin = {
        depth: 0,
        readsCounted: 0,
        snps: {},
        ref: {
          entryDepth: 0,
          '-1': 0,
          '0': 0,
          '1': 0,
          probabilityTotal: 0,
          probabilityCount: 0,
          lengthTotal: 0,
          lengthCount: 0,
          lengthMin: Infinity,
          lengthMax: -Infinity,
        },
        mods: {},
        nonmods: {},
        delskips: {},
        noncov: {},
      }
      bins[pos] = bin
      binCount++
    }
    const strand = entry.strand
    const type = entry.type
    const length = entry.length
    let noncovEntry = bin.noncov[type]
    if (!noncovEntry) {
      noncovEntry = {
        entryDepth: 0,
        '-1': 0,
        '0': 0,
        '1': 0,
        probabilityTotal: 0,
        probabilityCount: 0,
        lengthTotal: 0,
        lengthCount: 0,
        lengthMin: Infinity,
        lengthMax: -Infinity,
      }
      bin.noncov[type] = noncovEntry
    }
    noncovEntry.entryDepth++
    noncovEntry[strand]++
    noncovEntry.lengthTotal += length
    noncovEntry.lengthCount++
    noncovEntry.lengthMin = Math.min(noncovEntry.lengthMin, length)
    noncovEntry.lengthMax = Math.max(noncovEntry.lengthMax, length)
    const seq = entry.sequence
    if (seq !== undefined) {
      noncovEntry.sequenceCounts ??= new Map()
      noncovEntry.sequenceCounts.set(
        seq,
        (noncovEntry.sequenceCounts.get(seq) ?? 0) + 1,
      )
    }
  }

  // Merge modification bins - only into bins that already have depth data
  // (matching original behavior where processModifications/processReferenceCpGs
  // only added to existing bins)
  for (let i = 0, l = modBins.length; i < l; i++) {
    const modBin = modBins[i]
    if (modBin) {
      const bin = bins[i]
      if (bin) {
        Object.assign(bin.mods, modBin.mods)
        Object.assign(bin.nonmods, modBin.nonmods)
        if (modBin.refbase !== undefined) {
          bin.refbase = modBin.refbase
        }
      }
    }
  }

  // Finalize entries
  for (let i = 0, l = bins.length; i < l; i++) {
    const bin = bins[i]
    if (bin) {
      for (const key in bin.mods) {
        finalizeBinEntry(bin.mods[key]!)
      }
      for (const key in bin.nonmods) {
        finalizeBinEntry(bin.nonmods[key]!)
      }
      for (const key in bin.noncov) {
        finalizeBinEntry(bin.noncov[key]!)
      }
    }
  }

  return binsArrayToSoA(bins, binCount, regionStart, skipmap)
}

function createDeletionEntry(depth: number): PreBinEntry {
  return {
    entryDepth: depth,
    '-1': 0,
    '0': 0,
    '1': 0,
    probabilityTotal: 0,
    probabilityCount: 0,
    lengthTotal: 0,
    lengthCount: 0,
    lengthMin: Infinity,
    lengthMax: -Infinity,
  }
}

// Shared context to avoid closure allocation per feature
const featureCtx = {
  fstart: 0,
  fstrand: 0 as -1 | 0 | 1,
  regionStart: 0,
  regionEnd: 0,
  regionSize: 0,
  feature: undefined as FeatureWithMismatchIterator | Feature | undefined,
  skipmap: undefined as SkipMap | undefined,
  noncovEvents: undefined as
    | { pos: number; entry: SparseNoncovEntry }[]
    | undefined,
  snpEvents: undefined as { pos: number; entry: SparseSnpEntry }[] | undefined,
}

function mismatchHandler(
  type: number,
  start: number,
  refLen: number,
  base: string,
  _qual: number | undefined,
  altbase: number | undefined,
  interbaseLen: number | undefined,
) {
  const {
    fstart,
    fstrand,
    regionStart,
    regionEnd,
    regionSize,
    feature,
    skipmap,
    noncovEvents,
    snpEvents,
  } = featureCtx
  const mstart = fstart + start
  const mlen = mismatchLen(type, refLen)
  const mend = mstart + mlen

  if ((1 << type) & DELSKIP_MASK) {
    const visStart = Math.max(mstart, regionStart) - regionStart
    const visEnd = Math.min(mend, regionEnd) - regionStart

    if (visStart < visEnd) {
      deletionChanges[visStart]!++
      deletionChanges[visEnd]!--
    }

    if (type === SKIP_TYPE) {
      const tags = feature!.get('tags') as Record<string, string> | undefined
      const xs = tags?.XS || tags?.TS
      const ts = tags?.ts
      const effectiveStrand =
        xs === '+'
          ? 1
          : xs === '-'
            ? -1
            : (ts === '+' ? 1 : ts === '-' ? -1 : 0) * fstrand
      const hash = `${mstart}_${mend}_${effectiveStrand}`
      if (skipmap![hash] === undefined) {
        skipmap![hash] = {
          feature: feature!,
          start: mstart,
          end: mend,
          strand: fstrand,
          effectiveStrand,
          score: 0,
        }
      }
      skipmap![hash].score++
    }
  } else if (isInterbase(type)) {
    const epos = mstart - regionStart
    if (epos >= 0 && epos < regionSize) {
      noncovEvents!.push({
        pos: epos,
        entry: {
          strand: fstrand,
          type: MISMATCH_MAP[type]! as 'insertion' | 'hardclip' | 'softclip',
          length: interbaseLen!,
          sequence: base,
        },
      })
    }
  } else {
    const epos = mstart - regionStart
    if (epos >= 0 && epos < regionSize) {
      snpEvents!.push({
        pos: epos,
        entry: {
          base,
          strand: fstrand,
          altbase: CHAR_FROM_CODE[altbase!],
        },
      })
    }
  }
}

function processFeature(
  region: Region,
  feature: FeatureWithMismatchIterator | Feature,
  skipmap: SkipMap,
  noncovEvents: { pos: number; entry: SparseNoncovEntry }[],
  snpEvents: { pos: number; entry: SparseSnpEntry }[],
) {
  featureCtx.fstart = feature.get('start')
  featureCtx.fstrand = feature.get('strand') as -1 | 0 | 1
  featureCtx.regionStart = region.start
  featureCtx.regionEnd = region.end
  featureCtx.regionSize = region.end - region.start
  featureCtx.feature = feature
  featureCtx.skipmap = skipmap
  featureCtx.noncovEvents = noncovEvents
  featureCtx.snpEvents = snpEvents

  if ('forEachMismatch' in feature) {
    feature.forEachMismatch(mismatchHandler)
  } else {
    const mismatches = feature.get('mismatches') as Mismatch[] | undefined
    if (mismatches) {
      for (const m of mismatches) {
        let base: string
        let cliplen: number | undefined
        if (m.type === 'mismatch') {
          base = m.base
        } else if (m.type === 'insertion') {
          base = m.insertedBases ?? ''
          cliplen = m.insertlen
        } else if (m.type === 'softclip' || m.type === 'hardclip') {
          base = ''
          cliplen = m.cliplen
        } else {
          base = ''
        }
        mismatchHandler(
          MISMATCH_REV_MAP[m.type],
          m.start,
          m.length,
          base,
          m.type === 'mismatch' ? m.qual : undefined,
          m.type === 'mismatch' ? m.altbase?.charCodeAt(0) : undefined,
          cliplen,
        )
      }
    }
  }
}
