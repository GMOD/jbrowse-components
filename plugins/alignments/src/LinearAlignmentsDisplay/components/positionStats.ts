import {
  countSnpsAtPosition,
  forEachAtPosition,
  interbaseDepthAt,
  lowerBound,
  positionOrder,
} from '@jbrowse/alignments-core'

import { GAP_DELETION } from '../../shaders/slang/gap.consts.generated.ts'
import { modTooltipEntriesAt } from '../../shared/modTooltipIndex.ts'
import { interbaseTypeName } from '../../shared/types.ts'
import { interbaseRangeEnds } from '../../shared/uploadTypes.ts'
import { getOrCreate } from '../../shared/util.ts'
import { accumulateLength, toLengthStats } from './lengthStats.ts'

import type {
  PileupDataResult,
  WorkerPileupData,
} from '../../RenderAlignmentDataRPC/types'
import type { LengthAccumulator } from './lengthStats.ts'
import type {
  CoverageRowsBin,
  CoverageTooltipBin,
  VariantAllele,
  VariantSortColumn,
} from '@jbrowse/alignments-core'

// The interbase slice of a coverage position — what the interbase histogram bars
// and indicator triangles report. `depth` is carried for the detail widget's
// context row; the SNP/deletion tallies the shared CoverageTooltipBin also holds
// are neither rendered nor consulted here, so this path never computes them.
export interface InterbaseBin {
  position: number
  depth: number
  interbase: CoverageTooltipBin['interbase']
  interbaseDepth: number
}

// The converse slice: depth, SNP bases, deletions, modifications. Interbase
// events are deliberately absent — they're reached by hovering the histogram
// bars directly (InterbaseBin above), so mixing them into the depth table would
// double-report them.
export type CoverageBin = CoverageRowsBin

// The most-seen key of a tally, or undefined for an empty one. Pulled out so
// "the commonest inserted sequence" reads as that rather than as a max-scan.
function mostCommon(counts: Map<string, number>) {
  let top: { seq: string; count: number } | undefined
  for (const [seq, count] of counts) {
    if (top === undefined || count > top.count) {
      top = { seq, count }
    }
  }
  return top
}

// Per-type (insertion / softclip / hardclip) length stats for the interbase
// events at exactly `position`, plus the commonest sequence of each type.
function collectInterbaseStats(position: number, data: WorkerPileupData) {
  const {
    interbasePositions,
    interbaseLengths,
    interbaseTypes,
    interbaseSequences,
  } = data
  const lengths = new Map<string, LengthAccumulator>()
  const seqCounts = new Map<string, Map<string, number>>()
  // One binary search per interbase block — a hover asks about one position out
  // of every insertion and clip in the block, and it asks on every mousemove.
  // The array is sorted WITHIN each of its (insertions, softclips, hardclips)
  // runs rather than across them, because those boundaries are what three GPU
  // passes slice on. `interbaseRangeEnds` is that layout's single declaration,
  // the same one the renderers take their `subarray` bounds from.
  const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(data)
  forEachAtPosition(interbasePositions, [insEnd, scEnd, hcEnd], position, i => {
    const typeName = interbaseTypeName(interbaseTypes[i]!)
    lengths.set(
      typeName,
      accumulateLength(lengths.get(typeName), interbaseLengths[i]!),
    )
    const seq = interbaseSequences[i]
    if (seq) {
      const typeSeqs = getOrCreate(
        seqCounts,
        typeName,
        () => new Map<string, number>(),
      )
      typeSeqs.set(seq, (typeSeqs.get(seq) ?? 0) + 1)
    }
  })
  const out: CoverageTooltipBin['interbase'] = {}
  for (const [typeName, acc] of lengths) {
    const typeSeqs = seqCounts.get(typeName)
    const top = typeSeqs && mostCommon(typeSeqs)
    out[typeName] = {
      ...toLengthStats(acc),
      topSeq: top?.seq,
      topSeqCount: top?.count,
    }
  }
  return out
}

/**
 * Deletions sorted by start, with a running maximum of the ends to their left.
 *
 * The tooltip's deletion tally is a STABBING query — "which deletions span this
 * bp" — not a lookup at a position, so a sorted start array alone doesn't bound
 * it: every deletion starting before the cursor is a candidate. `maxEndSoFar`
 * is what closes that. It is non-decreasing by construction, so walking left
 * from the last start at or before the cursor can stop the moment it drops to
 * or below the cursor: nothing further left reaches that far right either.
 *
 * Skips are filtered out HERE rather than at the query, both because the tally
 * is about deletions only and because an intron is exactly the long span that
 * would keep the bound loose for every deletion beside it.
 *
 * Built per call, with no cache. It used to be memoized in a `WeakMap` keyed on
 * `gapPositions`, which was the wrong shape twice over: the array it actually
 * indexes is `positions` below — allocated HERE, so the WeakMap entry was keyed
 * on one array and holding an index over another, and it could never be hit again
 * once that temporary was collected. What made it look like it worked is that
 * `gapPositions` outlives the call, so the entry stayed reachable while being
 * dead weight.
 *
 * The cost of dropping it is one pass over the gaps per hover, which is bounded
 * by DELETIONS in the block rather than by mismatches — orders of magnitude
 * smaller than the arrays the mismatch path cared about. If this ever shows up in
 * a trace, the fix is to have the worker ship the three arrays beside the sorted
 * gaps, not to reintroduce a side table keyed on an array it does not describe.
 */
interface DeletionSpanIndex {
  starts: Uint32Array
  ends: Uint32Array
  maxEndSoFar: Uint32Array
}

function deletionSpanIndex(gapPositions: Uint32Array, gapTypes: Uint8Array) {
  const n = Math.floor(gapPositions.length / 2)
  let deletions = 0
  for (let i = 0; i < n; i++) {
    if (gapTypes[i] === GAP_DELETION) {
      deletions++
    }
  }
  const positions = new Uint32Array(deletions)
  const rawEnds = new Uint32Array(deletions)
  let w = 0
  for (let i = 0; i < n; i++) {
    if (gapTypes[i] === GAP_DELETION) {
      positions[w] = gapPositions[i * 2]!
      rawEnds[w] = gapPositions[i * 2 + 1]!
      w++
    }
  }
  // `positionOrder`, not `positionIndexFor`: this owns `positions`, so there is
  // nothing for a memo to be keyed on that would outlive the call.
  const { order, sorted } = positionOrder(positions)
  const ends = new Uint32Array(deletions)
  const maxEndSoFar = new Uint32Array(deletions)
  let running = 0
  for (let k = 0; k < deletions; k++) {
    const end = rawEnds[order[k]!]!
    ends[k] = end
    if (end > running) {
      running = end
    }
    maxEndSoFar[k] = running
  }
  return { starts: sorted, ends, maxEndSoFar } satisfies DeletionSpanIndex
}

// Length stats for the deletions (gapTypes 0, as opposed to skips) spanning
// `position`. Same statistic as the interbase tally above, through the same
// accumulator, so the two can't compute it differently.
function collectDeletionStats(
  position: number,
  data: WorkerPileupData,
  minLength = 0,
) {
  const { gapPositions, gapTypes } = data
  const { starts, ends, maxEndSoFar } = deletionSpanIndex(
    gapPositions,
    gapTypes,
  )
  let acc: LengthAccumulator | undefined
  for (let k = lowerBound(starts, position + 1) - 1; k >= 0; k--) {
    if (maxEndSoFar[k]! <= position) {
      break
    }
    if (ends[k]! > position && ends[k]! - starts[k]! >= minLength) {
      acc = accumulateLength(acc, ends[k]! - starts[k]!)
    }
  }
  return acc && toLengthStats(acc)
}

// Interbase events at `position`, or undefined when there are none. An empty
// tally is the "nothing to report" answer for both the hover and the click: with
// no entry the tooltip table and the detail widget would be a bare title, so
// neither should appear.
export function getInterbaseBin(
  position: number,
  blockRpcData: PileupDataResult,
): InterbaseBin | undefined {
  const interbase = collectInterbaseStats(position, blockRpcData)
  if (Object.keys(interbase).length === 0) {
    return undefined
  }
  const binIdx = Math.floor(position - blockRpcData.coverageStartPos)
  return {
    position,
    depth: blockRpcData.coverageDepths[binIdx] ?? 0,
    interbase,
    interbaseDepth: interbaseDepthAt(
      blockRpcData.coverageDepths,
      blockRpcData.coverageStartPos,
      position,
    ),
  }
}

export function getCoverageBin(
  position: number,
  blockRpcData: PileupDataResult,
): CoverageBin | undefined {
  const binIdx = Math.floor(position - blockRpcData.coverageStartPos)
  const depth = blockRpcData.coverageDepths[binIdx] ?? 0
  const hasStrandDepths = blockRpcData.coverageFwdDepths.length > 0
  const fwdDepth = hasStrandDepths
    ? (blockRpcData.coverageFwdDepths[binIdx] ?? 0)
    : undefined
  const revDepth = hasStrandDepths
    ? (blockRpcData.coverageRevDepths[binIdx] ?? 0)
    : undefined

  const snps = countSnpsAtPosition(position, blockRpcData)
  const deletions = collectDeletionStats(position, blockRpcData)
  const modifications = modTooltipEntriesAt(blockRpcData, position)

  const hasData =
    depth > 0 ||
    Object.keys(snps).length > 0 ||
    deletions !== undefined ||
    modifications !== undefined
  if (!hasData) {
    return undefined
  }

  return {
    position,
    depth,
    fwdDepth,
    revDepth,
    snps,
    deletions,
    modifications,
  }
}

// The reads with an insertion of `minInsertion` bases or more within `within`
// bases of `pos`, each read once
function insertionReadsNear(
  pos: number,
  data: WorkerPileupData,
  minInsertion: number,
  within: number,
) {
  const { interbasePositions, interbaseLengths, interbaseReadIndices } = data
  const reads = new Set<number>()
  const { insEnd } = interbaseRangeEnds(data)
  for (let i = 0; i < insEnd; i++) {
    if (
      interbaseLengths[i]! >= minInsertion &&
      Math.abs(interbasePositions[i]! - pos) <= within
    ) {
      reads.add(interbaseReadIndices[i]!)
    }
  }
  return reads.size
}

/**
 * The loaded reads differing from the reference at a variant's sort column,
 * over the reads spanning it: the mismatches and deletions the coverage band
 * stacks at a base, or the insertions it flags ahead of one. Given the
 * variant's `allele`, only the reads carrying it: a third base in one read, or
 * a one-base insertion beside a 300-base call, is not the call. Undefined where
 * `data` does not reach the column.
 */
export function nonReferenceAt(
  { type, pos }: VariantSortColumn,
  data: WorkerPileupData,
  allele?: VariantAllele,
) {
  const { coverageDepths, coverageStartPos } = data
  const idx = pos - coverageStartPos
  if (idx < 0 || idx >= coverageDepths.length) {
    return undefined
  }
  if (type === 'insertion') {
    return {
      count:
        allele && 'minInsertion' in allele
          ? insertionReadsNear(pos, data, allele.minInsertion, allele.within)
          : (collectInterbaseStats(pos, data).insertion?.count ?? 0),
      depth: interbaseDepthAt(coverageDepths, coverageStartPos, pos),
    }
  }
  // a read deleted at the base is in neither the depth nor the mismatches
  const deleted = collectDeletionStats(pos, data)?.count ?? 0
  const snps = countSnpsAtPosition(pos, data)
  let count = deleted
  if (allele && 'base' in allele) {
    count =
      allele.base === '*'
        ? allele.minDeletion
          ? (collectDeletionStats(pos, data, allele.minDeletion)?.count ?? 0)
          : deleted
        : (snps[allele.base]?.count ?? 0)
  } else {
    for (const snp of Object.values(snps)) {
      count += snp.count
    }
  }
  return {
    count,
    depth: (coverageDepths[idx] ?? 0) + deleted,
  }
}
