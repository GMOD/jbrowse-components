import type { Region } from './types/index.ts'

export interface AlignmentData {
  queryRefName: string
  refRefName: string
  queryStart: number
  queryEnd: number
  refStart: number
  refEnd: number
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

export type ProgressCallback = (
  progress: number,
  message: string,
) => void | Promise<void>

// Groups alignments by vertical-axis (query) chromosome, accumulates total
// aligned bases, length-weighted position, and strand per (query, reference)
// pair. Selects the reference chromosome with the most aligned bases as the
// best match, then sorts query chromosomes to align with that reference order.
//
// - queryRefName: horizontal-axis (reference) chromosome
// - refRefName:   vertical-axis (query) chromosome
export async function diagonalizeRegions(
  alignments: AlignmentData[],
  referenceRegions: Region[],
  currentRegions: Region[],
  progressCallback?: ProgressCallback,
): Promise<DiagonalizationResult> {
  await progressCallback?.(20, `Grouping ${alignments.length} alignments...`)

  // outer key: vertical chrom; inner key: horizontal chrom
  const queryGroups = new Map<
    string,
    Map<string, { bases: number; weightedPosSum: number; strandWeightedSum: number }>
  >()

  for (const aln of alignments) {
    const alnLength = Math.abs(aln.refEnd - aln.refStart)

    if (!queryGroups.has(aln.refRefName)) {
      queryGroups.set(aln.refRefName, new Map())
    }
    const group = queryGroups.get(aln.refRefName)!

    if (!group.has(aln.queryRefName)) {
      group.set(aln.queryRefName, {
        bases: 0,
        weightedPosSum: 0,
        strandWeightedSum: 0,
      })
    }
    const data = group.get(aln.queryRefName)!

    data.bases += alnLength
    data.weightedPosSum += ((aln.queryStart + aln.queryEnd) / 2) * alnLength
    data.strandWeightedSum += (aln.strand >= 0 ? 1 : -1) * alnLength
  }

  await progressCallback?.(50, 'Determining optimal ordering and orientation...')

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
      bestRefPos: bestBases > 0 ? bestWeightedPosSum / bestBases : 0,
      shouldReverse: bestStrandWeightedSum < 0,
    })
  }

  await progressCallback?.(70, `Sorting ${queryOrdering.length} query regions...`)

  const refOrder = new Map(referenceRegions.map((r, i) => [r.refName, i]))

  queryOrdering.sort((a, b) => {
    const aIdx = refOrder.get(a.bestRefName) ?? Infinity
    const bIdx = refOrder.get(b.bestRefName) ?? Infinity
    if (aIdx !== bIdx) {
      return aIdx - bIdx
    }
    return a.bestRefPos - b.bestRefPos
  })

  await progressCallback?.(85, 'Building new region layout...')

  const regionsByName = new Map(currentRegions.map(r => [r.refName, r]))
  const orderedNames = new Set(queryOrdering.map(q => q.refName))
  const newQueryRegions: Region[] = []
  let regionsReversed = 0

  for (const { refName, shouldReverse } of queryOrdering) {
    const region = regionsByName.get(refName)
    if (region) {
      newQueryRegions.push({ ...region, reversed: shouldReverse })
      if (shouldReverse !== region.reversed) {
        regionsReversed++
      }
    }
  }

  // Regions with no alignments are appended after the ordered ones
  const regionsWithoutAlignments = currentRegions.filter(
    r => !orderedNames.has(r.refName),
  )

  await progressCallback?.(100, 'Diagonalization complete!')

  return {
    newRegions: [...newQueryRegions, ...regionsWithoutAlignments],
    stats: {
      totalAlignments: alignments.length,
      regionsProcessed: queryOrdering.length,
      regionsReordered: newQueryRegions.length,
      regionsReversed,
    },
  }
}
