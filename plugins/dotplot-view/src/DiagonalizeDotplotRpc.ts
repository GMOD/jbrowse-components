import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { Dotplot1DView } from './DotplotView/model'

import type { Feature, Region } from '@jbrowse/core/util'
import type { Dotplot1DViewModel } from './DotplotView/model'

// Copied types from linear-comparative-view to avoid cross-package imports
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

/**
 * Diagonalize a set of regions based on alignment data.
 * Copied from linear-comparative-view to avoid cross-package imports.
 */
async function diagonalizeRegions(
  alignments: AlignmentData[],
  currentRegions: Region[],
  progressCallback?: ProgressCallback,
): Promise<DiagonalizationResult> {
  const updateProgress = (progress: number, message: string) => {
    if (progressCallback) {
      progressCallback(progress, message)
    }
  }

  updateProgress(20, `Grouping ${alignments.length} alignments...`)

  // Group alignments by the second view's refName (mate.refName)
  const queryGroups = new Map<
    string,
    {
      refAlignments: Map<string, { bases: number; positions: number[] }>
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
    const alnLength = Math.abs(aln.queryEnd - aln.queryStart)

    if (!group.refAlignments.has(aln.queryRefName)) {
      group.refAlignments.set(aln.queryRefName, {
        bases: 0,
        positions: [],
      })
    }

    const refData = group.refAlignments.get(aln.queryRefName)!
    refData.bases += alnLength
    refData.positions.push((aln.queryStart + aln.queryEnd) / 2)

    const direction = aln.strand >= 0 ? 1 : -1
    group.strandWeightedSum += direction * alnLength
  }

  updateProgress(50, 'Determining optimal ordering and orientation...')

  // Determine ordering and orientation for query regions
  const queryOrdering: {
    refName: string
    bestRefName: string
    bestRefPos: number
    shouldReverse: boolean
  }[] = []

  for (const [targetRefName, group] of queryGroups) {
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

    const bestRefPos =
      bestPositions.reduce((a, b) => a + b, 0) / bestPositions.length
    const shouldReverse = group.strandWeightedSum < 0

    queryOrdering.push({
      refName: targetRefName,
      bestRefName,
      bestRefPos,
      shouldReverse,
    })
  }

  updateProgress(70, `Sorting ${queryOrdering.length} query regions...`)

  queryOrdering.sort((a, b) => {
    if (a.bestRefName !== b.bestRefName) {
      return a.bestRefName.localeCompare(b.bestRefName)
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

  updateProgress(100, 'Diagonalization complete!')

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

/**
 * RPC method to diagonalize a dotplot view on the webworker
 */
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

    // Create view instances on the worker to access features
    const dimensions = [800, 800] // Dummy dimensions, we only need features
    const views = [view.hview, view.vview].map((snap, idx) => {
      const v = Dotplot1DView.create(snap)
      v.setVolatileWidth(dimensions[idx]!)
      return v
    }) as [Dotplot1DViewModel, Dotplot1DViewModel]

    const targetView = views[0]!

    checkStopToken(stopToken)
    statusCallback?.('Getting renderer...')

    // Get the renderer to access features
    const rendererType = this.pluginManager.getRendererType('DotplotRenderer')
    if (!rendererType) {
      throw new Error('DotplotRenderer not found')
    }

    checkStopToken(stopToken)
    statusCallback?.('Fetching features...')

    // Get features from adapter - DotplotRenderer extends ComparativeRenderer
    // which has getFeatures method
    const feats = await (
      rendererType as unknown as {
        getFeatures: (args: {
          regions: Region[]
          adapterConfig: Record<string, unknown>
          sessionId: string
        }) => Promise<Map<string, Feature>>
      }
    ).getFeatures({
      regions: targetView.dynamicBlocks.contentBlocks,
      adapterConfig,
      sessionId,
    })

    checkStopToken(stopToken)
    statusCallback?.('Extracting alignment data...')

    // Extract alignment data from features
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
          queryRefName: feat.get('refName') as string,
          refRefName: mate.refName,
          queryStart: feat.get('start') as number,
          queryEnd: feat.get('end') as number,
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

    // Run diagonalization algorithm with progress callback
    const result = await diagonalizeRegions(
      alignments,
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
