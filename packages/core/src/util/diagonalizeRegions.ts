import type { Region } from './types/index.ts'

export interface AlignmentData {
  refRefName: string
  queryRefName: string
  refStart: number
  refEnd: number
  queryStart: number
  queryEnd: number
  strand: number
}

export interface DiagonalizationResult {
  newRegions: Region[]
  stats: {
    totalAlignments: number
    regionsProcessed: number
    regionsReordered: number
    regionsReversed: number
  }
}

// onTick: sync callback fired at internal phase boundaries. Throw to abort
// (e.g. wrap checkStopToken from a worker).
export type DiagonalizeTick = () => void

// Groups alignments by vertical-axis (query) chromosome, accumulates total
// aligned bases, length-weighted position, and strand per (query, reference)
// pair. Selects the reference chromosome with the most aligned bases as the
// best match, then sorts query chromosomes to align with that reference order.
//
// - refRefName:   horizontal-axis (reference) chromosome
// - queryRefName: vertical-axis (query) chromosome
export async function diagonalizeRegions(
  alignments: AlignmentData[],
  referenceRegions: Region[],
  currentRegions: Region[],
  onTick?: DiagonalizeTick,
): Promise<DiagonalizationResult> {
  // outer key: vertical chrom; inner key: horizontal chrom
  const queryGroups = new Map<
    string,
    Map<
      string,
      { bases: number; weightedPosSum: number; strandWeightedSum: number }
    >
  >()

  for (const aln of alignments) {
    // Use x-axis (reference) length throughout: consistent weighting for
    // x-axis position and base-count, matching the original jmonlong R
    // implementation
    const alnLength = aln.refEnd - aln.refStart

    if (!queryGroups.has(aln.queryRefName)) {
      queryGroups.set(aln.queryRefName, new Map())
    }
    const group = queryGroups.get(aln.queryRefName)!

    if (!group.has(aln.refRefName)) {
      group.set(aln.refRefName, {
        bases: 0,
        weightedPosSum: 0,
        strandWeightedSum: 0,
      })
    }
    const data = group.get(aln.refRefName)!

    data.bases += alnLength
    data.weightedPosSum += ((aln.refStart + aln.refEnd) / 2) * alnLength
    data.strandWeightedSum += (aln.strand >= 0 ? 1 : -1) * alnLength
  }

  onTick?.()

  const queryOrdering: {
    refName: string
    bestRefName: string
    bestRefPos: number
    shouldReverse: boolean
  }[] = []

  for (const [verticalChrom, group] of queryGroups) {
    let bestRefName = ''
    let bestBases = 0
    let bestWeightedPosSum = 0
    let bestStrandWeightedSum = 0

    for (const [horizontalChrom, data] of group) {
      if (data.bases > bestBases) {
        bestBases = data.bases
        bestRefName = horizontalChrom
        bestWeightedPosSum = data.weightedPosSum
        bestStrandWeightedSum = data.strandWeightedSum
      }
    }

    queryOrdering.push({
      refName: verticalChrom,
      bestRefName,
      bestRefPos: bestWeightedPosSum / bestBases,
      shouldReverse: bestStrandWeightedSum < 0,
    })
  }

  onTick?.()

  const refOrder = new Map(referenceRegions.map((r, i) => [r.refName, i]))

  queryOrdering.sort((a, b) => {
    const aIdx = refOrder.get(a.bestRefName) ?? Infinity
    const bIdx = refOrder.get(b.bestRefName) ?? Infinity
    if (aIdx !== bIdx) {
      return aIdx - bIdx
    }
    return a.bestRefPos - b.bestRefPos
  })

  const regionsByName = new Map(currentRegions.map(r => [r.refName, r]))
  const orderedNames = new Set(queryOrdering.map(q => q.refName))
  const newQueryRegions: Region[] = []
  let regionsReversed = 0

  for (const { refName, shouldReverse } of queryOrdering) {
    const region = regionsByName.get(refName)
    if (region) {
      newQueryRegions.push({ ...region, reversed: shouldReverse })
      if (shouldReverse !== (region.reversed ?? false)) {
        regionsReversed++
      }
    }
  }

  // Regions with no alignments are appended after the ordered ones
  const regionsWithoutAlignments = currentRegions.filter(
    r => !orderedNames.has(r.refName),
  )

  // Count how many regions ended up at a different position than they started
  // (within the subset that participated in the ordering — unaligned regions
  // keep their tail position and aren't counted as moves).
  const previousOrder = currentRegions
    .map(r => r.refName)
    .filter(name => orderedNames.has(name))
  let regionsReordered = 0
  for (let i = 0; i < newQueryRegions.length; i++) {
    if (newQueryRegions[i]!.refName !== previousOrder[i]) {
      regionsReordered++
    }
  }

  return {
    newRegions: [...newQueryRegions, ...regionsWithoutAlignments],
    stats: {
      totalAlignments: alignments.length,
      regionsProcessed: queryOrdering.length,
      regionsReordered,
      regionsReversed,
    },
  }
}
