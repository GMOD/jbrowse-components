/**
 * Diagonalization utilities for synteny views.
 * Reorders and reorients displayed regions to minimize crossing lines.
 */

export interface AlignmentData {
  queryRefName: string
  refRefName: string
  queryStart: number
  queryEnd: number
  refStart: number
  refEnd: number
  strand: number
}

export interface Region {
  refName: string
  start: number
  end: number
  reversed?: boolean
  assemblyName: string
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

/**
 * Diagonalize a set of regions based on alignment data.
 *
 * This reorders the second view's regions to minimize crossing alignment lines
 * by sorting them based on their primary alignment positions in the first view.
 *
 * @param alignments - Array of alignment data between two views
 * @param currentRegions - Current displayed regions to reorder
 * @param progressCallback - Optional callback for progress updates
 * @returns Promise resolving to new regions and statistics
 */
export async function diagonalizeRegions(
  alignments: AlignmentData[],
  currentRegions: Region[],
  progressCallback?: ProgressCallback,
): Promise<DiagonalizationResult> {
  const updateProgress = async (progress: number, message: string) => {
    if (progressCallback) {
      await progressCallback(progress, message)
    }
  }

  await updateProgress(20, `Grouping ${alignments.length} alignments...`)

  // Group alignments by the second view's refName (mate.refName)
  // We want to reorder the query view (second view), so we group by its refNames
  const queryGroups = new Map<
    string,
    {
      refAlignments: Map<string, { bases: number; positions: number[] }>
      strandWeightedSum: number
    }
  >()

  for (const aln of alignments) {
    // Group by the mate's refName (second view), not the feature's refName (first view)
    const targetRefName = aln.refRefName

    if (!queryGroups.has(targetRefName)) {
      queryGroups.set(targetRefName, {
        refAlignments: new Map(),
        strandWeightedSum: 0,
      })
    }

    const group = queryGroups.get(targetRefName)!
    const alnLength = Math.abs(aln.queryEnd - aln.queryStart)

    // Track aligned bases per reference region (first view)
    if (!group.refAlignments.has(aln.queryRefName)) {
      group.refAlignments.set(aln.queryRefName, {
        bases: 0,
        positions: [],
      })
    }

    const refData = group.refAlignments.get(aln.queryRefName)!
    refData.bases += alnLength
    // Use the first view's positions as reference
    refData.positions.push((aln.queryStart + aln.queryEnd) / 2)

    // Calculate weighted strand sum
    const direction = aln.strand >= 0 ? 1 : -1
    group.strandWeightedSum += direction * alnLength
  }

  await updateProgress(50, 'Determining optimal ordering and orientation...')

  // Determine ordering and orientation for query regions (second view)
  const queryOrdering: {
    refName: string
    bestRefName: string
    bestRefPos: number
    shouldReverse: boolean
  }[] = []

  for (const [targetRefName, group] of queryGroups) {
    // targetRefName is from the second view (e.g., "chr1", "chr18")
    // Find which first view region it aligns to most
    let bestRefName = ''
    let maxBases = 0
    let bestPositions: number[] = []

    for (const [firstViewRefName, data] of group.refAlignments) {
      if (data.bases > maxBases) {
        maxBases = data.bases
        bestRefName = firstViewRefName
        bestPositions = data.positions
      }
    }

    // Calculate weighted mean position in the first view
    const bestRefPos =
      bestPositions.reduce((a, b) => a + b, 0) / bestPositions.length

    // Determine if we should reverse based on major strand
    const shouldReverse = group.strandWeightedSum < 0

    queryOrdering.push({
      refName: targetRefName, // This is the second view's refName
      bestRefName, // This is the first view's refName it aligns to
      bestRefPos, // Position in the first view
      shouldReverse,
    })
  }

  await updateProgress(70, `Sorting ${queryOrdering.length} query regions...`)

  // Sort query regions by reference region and position
  queryOrdering.sort((a, b) => {
    // First by reference region name
    if (a.bestRefName !== b.bestRefName) {
      return a.bestRefName.localeCompare(b.bestRefName)
    }
    // Then by position within reference
    return a.bestRefPos - b.bestRefPos
  })

  await updateProgress(85, 'Building new region layout...')

  // Build new displayedRegions for query view
  const newQueryRegions: Region[] = []
  let regionsReversed = 0

  for (const { refName, shouldReverse } of queryOrdering) {
    const region = currentRegions.find(r => r.refName === refName)
    if (region) {
      newQueryRegions.push({
        ...region,
        reversed: shouldReverse,
      })
      if (shouldReverse !== region.reversed) {
        regionsReversed++
      }
    } else {
      console.warn(`Could not find region for refName: ${refName}`)
    }
  }

  await updateProgress(100, 'Diagonalization complete!')

  return {
    newRegions: newQueryRegions,
    stats: {
      totalAlignments: alignments.length,
      regionsProcessed: queryOrdering.length,
      regionsReordered: newQueryRegions.length,
      regionsReversed,
    },
  }
}
