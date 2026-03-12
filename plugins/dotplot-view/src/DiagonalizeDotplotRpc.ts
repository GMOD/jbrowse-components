import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import type { Feature, Region } from '@jbrowse/core/util'

// copied from plugins/linear-comparative-view/src/LinearSyntenyView/util/diagonalize.ts
interface AlignmentData {
  queryRefName: string
  refRefName: string
  queryStart: number
  queryEnd: number
  refStart: number
  refEnd: number
  strand: number
}

interface DiagonalizationResult {
  newRegions: Region[]
  stats: {
    totalAlignments: number
    regionsProcessed: number
    regionsReordered: number
    regionsReversed: number
  }
}

type ProgressCallback = (progress: number, message: string) => void

// copied from plugins/linear-comparative-view/src/LinearSyntenyView/util/diagonalize.ts
function diagonalizeRegions(
  alignments: AlignmentData[],
  referenceRegions: Region[],
  currentRegions: Region[],
  progressCallback?: ProgressCallback,
): DiagonalizationResult {
  const updateProgress = (progress: number, message: string) => {
    if (progressCallback) {
      progressCallback(progress, message)
    }
  }

  updateProgress(20, `Grouping ${alignments.length} alignments...`)

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

  updateProgress(50, 'Determining optimal ordering and orientation...')

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

  updateProgress(70, `Sorting ${queryOrdering.length} query regions...`)

  const refOrder = new Map(referenceRegions.map((r, i) => [r.refName, i]))

  queryOrdering.sort((a, b) => {
    const aIdx = refOrder.get(a.bestRefName) ?? Infinity
    const bIdx = refOrder.get(b.bestRefName) ?? Infinity
    if (aIdx !== bIdx) {
      return aIdx - bIdx
    }
    return a.bestRefPos - b.bestRefPos
  })

  updateProgress(85, 'Building new region layout...')

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

  const regionsWithoutAlignments = currentRegions.filter(
    r => !newQueryRegions.some(nr => nr.refName === r.refName),
  )

  updateProgress(100, 'Diagonalization complete!')

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

interface DiagonalizeDotplotArgs {
  sessionId: string
  view: {
    hview: { displayedRegions: Region[] }
    vview: { displayedRegions: Region[] }
  }
  adapterConfig: Record<string, unknown>
  stopToken?: string
  statusCallback?: (message: string) => void
}

export default class DiagonalizeDotplotRpc extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'DiagonalizeDotplot'

  async execute(args: DiagonalizeDotplotArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { view, sessionId, adapterConfig, stopToken, statusCallback } =
      deserializedArgs

    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    statusCallback?.('Initializing diagonalization...')

    checkStopToken(stopToken)
    statusCallback?.('Getting renderer...')

    const rendererType = this.pluginManager.getRendererType('DotplotRenderer')
    if (!rendererType) {
      throw new Error('DotplotRenderer not found')
    }

    checkStopToken(stopToken)
    statusCallback?.('Fetching features...')

    const feats = await (
      rendererType as unknown as {
        getFeatures: (args: {
          regions: Region[]
          adapterConfig: Record<string, unknown>
          sessionId: string
        }) => Promise<Map<string, Feature>>
      }
    ).getFeatures({
      regions: view.hview.displayedRegions,
      adapterConfig,
      sessionId,
    })

    checkStopToken(stopToken)
    statusCallback?.('Extracting alignment data...')

    const alignments: AlignmentData[] = []

    for (const feat of feats.values()) {
      const mate = feat.get('mate') as
        | {
            refName: string
            start: number
            end: number
          }
        | undefined

      if (mate) {
        alignments.push({
          queryRefName: feat.get('refName'),
          refRefName: mate.refName,
          queryStart: feat.get('start'),
          queryEnd: feat.get('end'),
          refStart: mate.start,
          refEnd: mate.end,
          strand: (feat.get('strand') as number) || 1,
        })
      }
    }

    if (alignments.length === 0) {
      throw new Error('No alignments found to diagonalize')
    }

    statusCallback?.(
      `Running diagonalization on ${alignments.length} alignments...`,
    )

    const result = diagonalizeRegions(
      alignments,
      view.hview.displayedRegions,
      view.vview.displayedRegions,
      (progress, message) => {
        checkStopToken(stopToken)
        statusCallback?.(message)
      },
    )

    statusCallback?.('Diagonalization complete!')
    return result
  }
}
