import { checkStopToken } from '@jbrowse/core/util/stopToken'

import {
  processDepthPrefixSum,
  type CoverageDepthSoA,
} from './processDepthPrefixSum'
import { processModifications } from './processModifications'
import { processReferenceCpGs } from './processReferenceCpGs'
import { createPreBinEntry, mismatchLen, isInterbase } from './util'

import type { Opts } from './util'
import type {
  Mismatch,
  PreBaseCoverageBin,
  PreBinEntry,
  SkipMap,
} from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

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

/**
 * Process mismatches using prefix sums for deletions/skips.
 * Works with legacy mismatch format (array of objects).
 * SNPs are point events so we collect them directly.
 */
function processMismatchesPrefixSum(
  features: Feature[],
  region: Region,
  _depthSoA: CoverageDepthSoA,
): {
  snpEvents: { pos: number; entry: SparseSnpEntry }[]
  deletionDepth: Int32Array
  skipmap: SkipMap
  noncovEvents: { pos: number; entry: SparseNoncovEntry }[]
} {
  const regionStart = region.start
  const regionEnd = region.end
  const regionSize = regionEnd - regionStart

  // Clear deletion changes buffer
  deletionChanges.fill(0, 0, regionSize + 1)

  const snpEvents: { pos: number; entry: SparseSnpEntry }[] = []
  const noncovEvents: { pos: number; entry: SparseNoncovEntry }[] = []
  const skipmap: SkipMap = {}

  for (const feature of features) {
    const fstart = feature.get('start') as number
    const fstrand = feature.get('strand') as -1 | 0 | 1
    const mismatches = feature.get('mismatches') as Mismatch[] | undefined

    if (!mismatches || mismatches.length === 0) {
      continue
    }

    for (const mismatch of mismatches) {
      const { type, start: mismatchStart, base, altbase, cliplen } = mismatch
      const mstart = fstart + mismatchStart
      const mlen = mismatchLen(mismatch)
      const mend = mstart + mlen

      if (type === 'deletion' || type === 'skip') {
        const visStart = Math.max(mstart, regionStart) - regionStart
        const visEnd = Math.min(mend, regionEnd) - regionStart

        if (visStart < visEnd) {
          // Use prefix sums for deletions - O(1) per deletion
          deletionChanges[visStart]++
          deletionChanges[visEnd]--
        }

        // Track skips for junction rendering
        if (type === 'skip') {
          const tags = feature.get('tags') as
            | Record<string, string>
            | undefined
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
              type: type as 'insertion' | 'softclip' | 'hardclip',
              length: cliplen ?? mismatch.insertedBases?.length ?? 0,
              sequence: mismatch.insertedBases,
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
              altbase,
            },
          })
        }
      }
    }
  }

  // Compute deletion depth prefix sums
  const deletionDepth = new Int32Array(regionSize)
  let dd = 0
  for (let i = 0; i < regionSize; i++) {
    dd += deletionChanges[i]!
    deletionDepth[i] = dd
  }

  return { snpEvents, deletionDepth, skipmap, noncovEvents }
}

function finalizeBinEntry(entry: PreBinEntry) {
  const { probabilityTotal, probabilityCount, lengthTotal, lengthCount } = entry
  const ret = entry as PreBinEntry & {
    avgProbability?: number
    avgLength?: number
    minLength?: number
    maxLength?: number
    topSequence?: string
  }
  if (probabilityCount) {
    ret.avgProbability = probabilityTotal / probabilityCount
  }
  if (lengthCount) {
    ret.avgLength = lengthTotal / lengthCount
    ret.minLength = entry.lengthMin
    ret.maxLength = entry.lengthMax
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
    ret.topSequence = topSeq
    entry.sequenceCounts = undefined
  }
}

/**
 * Generate coverage bins using prefix sums algorithm.
 *
 * This is ~100-1000x faster than the original per-base iteration approach,
 * especially for high-coverage or long-read data.
 */
export async function generateCoverageBinsPrefixSum({
  fetchSequence,
  features,
  region,
  opts,
}: {
  features: Feature[]
  region: Region
  opts: Opts
  fetchSequence?: (arg: Region) => Promise<string | undefined>
}): Promise<{ bins: PreBaseCoverageBin[]; skipmap: SkipMap }> {
  const { stopToken, colorBy, statsEstimationMode } = opts
  const regionStart = region.start
  const regionEnd = region.end
  const regionSize = regionEnd - regionStart

  // Step 1: Compute depth using prefix sums - O(features + regionSize)
  checkStopToken(stopToken)
  const depthSoA = processDepthPrefixSum(features, region)

  // In statsEstimationMode, skip all mismatch/modification processing
  // Just return depth-only bins for fast coverage estimation
  if (statsEstimationMode) {
    const bins: PreBaseCoverageBin[] = new Array(regionSize)
    for (let i = 0; i < regionSize; i++) {
      const depth = depthSoA.depth[i]!
      if (depth === 0) {
        continue
      }
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
    return { bins, skipmap: {} }
  }

  // Step 2: Process mismatches with prefix sums for deletions
  checkStopToken(stopToken)
  const { snpEvents, deletionDepth, skipmap, noncovEvents } =
    processMismatchesPrefixSum(features, region, depthSoA)

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
  }

  // Step 4: Build final bins array - only create objects for positions with data
  checkStopToken(stopToken)
  const bins: PreBaseCoverageBin[] = new Array(regionSize)

  // First pass: create bins only where we have depth > 0 or other data
  for (let i = 0; i < regionSize; i++) {
    const depth = depthSoA.depth[i]!
    const delDepth = deletionDepth[i]!

    // Skip empty positions (sparse optimization)
    if (depth === 0 && delDepth === 0) {
      continue
    }

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
  for (const { pos, entry } of snpEvents) {
    let bin = bins[pos]
    if (!bin) {
      bin = bins[pos] = createEmptyBin()
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
  for (const { pos, entry } of noncovEvents) {
    let bin = bins[pos]
    if (!bin) {
      bin = bins[pos] = createEmptyBin()
    }
    const noncovEntry = (bin.noncov[entry.type] ??= createPreBinEntry())
    noncovEntry.entryDepth++
    noncovEntry[entry.strand]++
    if (entry.length !== undefined) {
      noncovEntry.lengthTotal += entry.length
      noncovEntry.lengthCount++
      noncovEntry.lengthMin = Math.min(noncovEntry.lengthMin, entry.length)
      noncovEntry.lengthMax = Math.max(noncovEntry.lengthMax, entry.length)
    }
    if (entry.sequence !== undefined) {
      noncovEntry.sequenceCounts ??= new Map()
      noncovEntry.sequenceCounts.set(
        entry.sequence,
        (noncovEntry.sequenceCounts.get(entry.sequence) ?? 0) + 1,
      )
    }
  }

  // Merge modification bins
  for (let i = 0; i < modBins.length; i++) {
    const modBin = modBins[i]
    if (modBin) {
      let bin = bins[i]
      if (!bin) {
        bin = bins[i] = createEmptyBin()
      }
      Object.assign(bin.mods, modBin.mods)
      Object.assign(bin.nonmods, modBin.nonmods)
    }
  }

  // Finalize entries
  for (const bin of bins) {
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

  return { bins, skipmap }
}

function createEmptyBin(): PreBaseCoverageBin {
  return {
    depth: 0,
    readsCounted: 0,
    ref: createPreBinEntry(),
    snps: {},
    mods: {},
    nonmods: {},
    delskips: {},
    noncov: {},
  }
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
