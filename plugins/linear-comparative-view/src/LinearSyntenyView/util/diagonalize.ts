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

// copied to plugins/dotplot-view/src/DiagonalizeDotplotRpc.ts
export async function diagonalizeRegions(
  alignments: AlignmentData[],
  referenceRegions: Region[],
  currentRegions: Region[],
  progressCallback?: ProgressCallback,
): Promise<DiagonalizationResult> {
  const updateProgress = async (progress: number, message: string) => {
    if (progressCallback) {
      await progressCallback(progress, message)
    }
  }

  await updateProgress(20, `Grouping ${alignments.length} alignments...`)

  const queryGroups = new Map<
    string,
    {
      refAlignments: Map<
        string,
        { bases: number; weightedPosSum: number; maxAlnLength: number }
      >
      strandWeightedSum: number
    }
  >()

  for (const aln of alignments) {
    const targetRefName = aln.refRefName

    if (!queryGroups.has(targetRefName)) {
      queryGroups.set(targetRefName, {
        refAlignments: new Map(),
        strandWeightedSum: 0,
      })
    }

    const group = queryGroups.get(targetRefName)!
    const alnLength = Math.abs(aln.refEnd - aln.refStart)

    if (!group.refAlignments.has(aln.queryRefName)) {
      group.refAlignments.set(aln.queryRefName, {
        bases: 0,
        weightedPosSum: 0,
        maxAlnLength: 0,
      })
    }

    const refData = group.refAlignments.get(aln.queryRefName)!
    refData.bases += alnLength
    refData.weightedPosSum += ((aln.queryStart + aln.queryEnd) / 2) * alnLength
    refData.maxAlnLength = Math.max(refData.maxAlnLength, alnLength)

    const direction = aln.strand >= 0 ? 1 : -1
    group.strandWeightedSum += direction * alnLength
  }

  await updateProgress(50, 'Determining optimal ordering and orientation...')

  const queryOrdering: {
    refName: string
    bestRefName: string
    bestRefPos: number
    shouldReverse: boolean
  }[] = []

  for (const [targetRefName, group] of queryGroups) {
    let bestRefName = ''
    let maxAlnLength = 0
    let bestBases = 0
    let bestWeightedPosSum = 0

    for (const [firstViewRefName, data] of group.refAlignments) {
      if (data.maxAlnLength > maxAlnLength) {
        maxAlnLength = data.maxAlnLength
        bestRefName = firstViewRefName
        bestBases = data.bases
        bestWeightedPosSum = data.weightedPosSum
      }
    }

    const bestRefPos = bestBases > 0 ? bestWeightedPosSum / bestBases : 0
    const shouldReverse = group.strandWeightedSum < 0

    queryOrdering.push({
      refName: targetRefName,
      bestRefName,
      bestRefPos,
      shouldReverse,
    })
  }

  await updateProgress(70, `Sorting ${queryOrdering.length} query regions...`)

  const refOrder = new Map(referenceRegions.map((r, i) => [r.refName, i]))

  queryOrdering.sort((a, b) => {
    const aIdx = refOrder.get(a.bestRefName) ?? Infinity
    const bIdx = refOrder.get(b.bestRefName) ?? Infinity
    if (aIdx !== bIdx) {
      return aIdx - bIdx
    }
    return a.bestRefPos - b.bestRefPos
  })

  await updateProgress(85, 'Building new region layout...')

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
