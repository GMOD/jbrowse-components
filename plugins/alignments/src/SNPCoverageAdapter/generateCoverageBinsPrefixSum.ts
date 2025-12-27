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
  starts: Int32Array
  ends: Int32Array
  scores: Float32Array
  snpinfo: BaseCoverageBin[]
  skipmap: SkipMap
}

// Convert bins Map to structure-of-arrays format
function binsMapToSoA(
  bins: Map<number, PreBaseCoverageBin>,
  regionStart: number,
  skipmap: SkipMap,
): CoverageBinsSoA {
  const count = bins.size
  const starts = new Int32Array(count)
  const ends = new Int32Array(count)
  const scores = new Float32Array(count)
  const snpinfo: BaseCoverageBin[] = new Array(count)

  // Sort positions for sequential output
  const positions = [...bins.keys()].sort((a, b) => a - b)

  for (const [idx, position] of positions.entries()) {
    const pos = position
    const bin = bins.get(pos)!
    const start = regionStart + pos
    starts[idx] = start
    ends[idx] = start + 1
    scores[idx] = bin.depth
    snpinfo[idx] = bin
  }

  return { starts, ends, scores, snpinfo, skipmap }
}

// Reusable change arrays for deletion prefix sums
const MAX_REGION_SIZE = 1_000_000
const deletionChanges = new Int32Array(MAX_REGION_SIZE + 1)

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
    const bins = new Map<number, PreBaseCoverageBin>()
    for (let i = 0; i < regionSize; i++) {
      const depth = depthSoA.depth[i]!
      if (depth === 0) {
        continue
      }
      bins.set(i, {
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
      })
    }
    return binsMapToSoA(bins, regionStart, {})
  }

  // Step 2: Process mismatches with prefix sums for deletions
  checkStopToken(stopToken)
  // Clear deletion changes buffer
  deletionChanges.fill(0, 0, regionSize + 1)

  const snpEvents: { pos: number; entry: SparseSnpEntry }[] = []
  const noncovEvents: { pos: number; entry: SparseNoncovEntry }[] = []
  const skipmap: SkipMap = {}

  for (let i = 0, l = features.length; i < l; i++) {
    processFeature(region, features[i]!, skipmap, noncovEvents, snpEvents)
  }

  // Compute deletion depth prefix sums
  const deletionDepth = new Int32Array(regionSize)
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

  // Step 4: Build final bins Map - only create objects for positions with data
  checkStopToken(stopToken)
  const bins = new Map<number, PreBaseCoverageBin>()

  // First pass: create bins only where we have depth > 0 or other data
  for (let i = 0; i < regionSize; i++) {
    const depth = depthSoA.depth[i]!
    const delDepth = deletionDepth[i]!

    // Skip empty positions (sparse optimization)
    if (depth === 0 && delDepth === 0) {
      continue
    }

    bins.set(i, {
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
    })
  }

  // Apply SNP events
  for (let i = 0, l = snpEvents.length; i < l; i++) {
    const { pos, entry } = snpEvents[i]!

    let bin = bins.get(pos)
    if (!bin) {
      bin = createEmptyBin()
      bins.set(pos, bin)
    }
    const snpEntry = (bin.snps[entry.base] ??= createPreBinEntry())
    snpEntry.entryDepth++
    snpEntry[entry.strand]++
    bin.ref.entryDepth--
    bin.ref[entry.strand]--
    if (entry.altbase) {
      bin.refbase = entry.altbase
    }
  }

  // Apply noncov events (insertions, clips)
  for (let i = 0, l = noncovEvents.length; i < l; i++) {
    const { pos, entry } = noncovEvents[i]!
    let bin = bins.get(pos)
    if (!bin) {
      bin = createEmptyBin()
      bins.set(pos, bin)
    }
    const noncovEntry = (bin.noncov[entry.type] ??= createPreBinEntry())
    noncovEntry.entryDepth++
    noncovEntry[entry.strand]++
    noncovEntry.lengthTotal += entry.length
    noncovEntry.lengthCount++
    noncovEntry.lengthMin = Math.min(noncovEntry.lengthMin, entry.length)
    noncovEntry.lengthMax = Math.max(noncovEntry.lengthMax, entry.length)
    if (entry.sequence !== undefined) {
      noncovEntry.sequenceCounts ??= new Map()
      noncovEntry.sequenceCounts.set(
        entry.sequence,
        (noncovEntry.sequenceCounts.get(entry.sequence) ?? 0) + 1,
      )
    }
  }

  // Merge modification bins - only into bins that already have depth data
  // (matching original behavior where processModifications/processReferenceCpGs
  // only added to existing bins)
  for (let i = 0, l = modBins.length; i < l; i++) {
    const modBin = modBins[i]
    if (modBin) {
      const bin = bins.get(i)
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
  for (const bin of bins.values()) {
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

  return binsMapToSoA(bins, regionStart, skipmap)
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

function processFeature(
  region: Region,
  feature: FeatureWithMismatchIterator | Feature,
  skipmap: SkipMap,
  noncovEvents: { pos: number; entry: SparseNoncovEntry }[],
  snpEvents: { pos: number; entry: SparseSnpEntry }[],
) {
  const fstart = feature.get('start')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const regionStart = region.start
  const regionEnd = region.end
  const regionSize = regionEnd - regionStart

  const mismatchHandler = (
    type: number,
    start: number,
    refLen: number,
    base: string,
    _qual: number | undefined,
    altbase: number | undefined,
    interbaseLen: number | undefined,
  ) => {
    const mstart = fstart + start
    const mlen = mismatchLen(type, refLen)
    const mend = mstart + mlen

    if ((1 << type) & DELSKIP_MASK) {
      const visStart = Math.max(mstart, regionStart) - regionStart
      const visEnd = Math.min(mend, regionEnd) - regionStart

      if (visStart < visEnd) {
        // Use prefix sums for deletions - O(1) per deletion
        deletionChanges[visStart]!++
        deletionChanges[visEnd]!--
      }

      // Track skips for junction rendering
      if (type === SKIP_TYPE) {
        const tags = feature.get('tags') as Record<string, string> | undefined
        const xs = tags?.XS || tags?.TS
        const ts = tags?.ts
        const effectiveStrand =
          xs === '+'
            ? 1
            : xs === '-'
              ? -1
              : (ts === '+' ? 1 : ts === '-' ? -1 : 0) * fstrand
        const hash = `${mstart}_${mend}_${effectiveStrand}`
        if (skipmap[hash] === undefined) {
          skipmap[hash] = {
            feature,
            start: mstart,
            end: mend,
            strand: fstrand,
            effectiveStrand,
            score: 0,
          }
        }
        skipmap[hash].score++
      }
    } else if (isInterbase(type)) {
      // insertion, softclip, hardclip
      const epos = mstart - regionStart
      if (epos >= 0 && epos < regionSize) {
        noncovEvents.push({
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
      // SNP/mismatch - point event
      const epos = mstart - regionStart
      if (epos >= 0 && epos < regionSize) {
        snpEvents.push({
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
