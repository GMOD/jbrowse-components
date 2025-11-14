import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'

import { PairType, getPairedType } from '../shared/color'
import { drawLongReadChains } from './drawLongReadChains'
import { drawPairChains } from './drawPairChains'
import { shouldRenderChevrons } from '../shared/util'

import type { LinearReadCloudDisplayModel } from './model'
import type { ChainData } from '../shared/fetchChains'
import type { FlatbushEntry } from '../shared/flatbushType'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { ThemeOptions } from '@mui/material'

type LGV = LinearGenomeViewModel

export interface ComputedChain {
  distance: number
  minX: number
  maxX: number
  chain: Feature[]
  id: string
}

/**
 * Filter chains based on singleton and proper pair settings
 */
export function filterChains(
  chains: Feature[][],
  drawSingletons: boolean,
  drawProperPairs: boolean,
  type: string,
  chainData: ChainData,
) {
  const filtered: Feature[][] = []

  for (const chain_ of chains) {
    const chain = chain_

    // Filter out singletons if drawSingletons is false
    if (!drawSingletons && chain.length === 1) {
      continue
    }

    // Filter out proper pairs if drawProperPairs is false
    // Check if this is a paired-end read using SAM flag 1 (read paired)
    let isPairedEnd = false
    for (const element of chain) {
      if (element.get('flags') & 1) {
        isPairedEnd = true
        break
      }
    }

    if (!drawProperPairs && isPairedEnd) {
      // Collect non-supplementary alignments
      const nonSupplementary: Feature[] = []
      for (const element of chain) {
        if (!(element.get('flags') & 2048)) {
          nonSupplementary.push(element)
        }
      }

      if (nonSupplementary.length === 2) {
        const v0 = nonSupplementary[0]!
        const v1 = nonSupplementary[1]!
        const pairType = getPairedType({
          type,
          f1: v0,
          f2: v1,
          stats: chainData.stats,
        })
        // Filter out proper pairs
        if (pairType === PairType.PROPER_PAIR) {
          continue
        }
      }
    }

    filtered.push(chain)
  }

  return filtered
}

/**
 * Compute pixel bounds for each chain
 */
export function computeChainBounds(chains: Feature[][], view: LGV) {
  const computedChains: ComputedChain[] = []

  // get bounds on the 'distances' (TLEN for pairs, pixel span for others)
  for (const chain_ of chains) {
    const chain = chain_
    let minX = Number.MAX_VALUE
    let maxX = Number.MIN_VALUE
    let chainId = ''
    let tlenDistance = 0
    const chainLength = chain.length

    for (let j = 0; j < chainLength; j++) {
      const elt = chain[j]!
      const rs = view.bpToPx({
        refName: elt.get('refName'),
        coord: elt.get('start'),
      })?.offsetPx
      const re = view.bpToPx({
        refName: elt.get('refName'),
        coord: elt.get('end'),
      })?.offsetPx
      if (rs !== undefined && re !== undefined) {
        minX = Math.min(minX, rs)
        maxX = Math.max(maxX, re)
      }
      if (!chainId) {
        chainId = elt.id()
      }
      // Use TLEN from the first feature that has it (only for non-singletons)
      const tlen = elt.get('template_length')
      if (chainLength > 1 && tlenDistance === 0 && tlen) {
        tlenDistance = Math.abs(tlen)
      }
    }

    // For pairs/chains, prefer TLEN over pixel distance; singletons use 0 (for y=0)
    let distance: number
    if (tlenDistance > 0) {
      distance = tlenDistance
    } else if (chainLength === 1) {
      // Singletons get distance of 0 to be placed at y=0
      distance = 0
    } else if (minX !== Number.MAX_VALUE && maxX !== Number.MIN_VALUE) {
      // Fall back to pixel distance for long reads (e.g., SA-tagged chains)
      distance = Math.abs(maxX - minX)
    } else {
      // Skip chains with no valid positions and no TLEN
      continue
    }

    computedChains.push({
      distance,
      minX,
      maxX,
      chain,
      id: chainId,
    })
  }

  return computedChains
}

/**
 * Sort chains: singletons first, then by width within each group
 */
export function sortComputedChains(computedChains: ComputedChain[]) {
  computedChains.sort((a, b) => {
    const aIsSingleton = a.chain.length === 1 ? 1 : 0
    const bIsSingleton = b.chain.length === 1 ? 1 : 0

    // Sort singletons first (higher value = earlier in sort)
    if (bIsSingleton !== aIsSingleton) {
      return bIsSingleton - aIsSingleton
    }

    // Within each group, sort by width (smaller first)
    return a.distance - b.distance
  })
}

/**
 * Build Flatbush index for mouseover detection
 */
export function buildFlatbushIndex(
  featuresForFlatbush: FlatbushEntry[],
  self: LinearReadCloudDisplayModel,
) {
  const finalFlatbush = new Flatbush(Math.max(featuresForFlatbush.length, 1))
  const length = featuresForFlatbush.length
  if (length) {
    for (let i = 0; i < length; i++) {
      const { x1, y1, x2, y2 } = featuresForFlatbush[i]!
      finalFlatbush.add(x1, y1, x2, y2)
    }
  } else {
    // flatbush does not like 0 items
    finalFlatbush.add(0, 0)
  }
  finalFlatbush.finish()
  self.setFeatureLayout(finalFlatbush)
  self.setFeaturesForFlatbush(featuresForFlatbush)
}

/**
 * Add full-width rectangles for each chain to enable mouseover on connecting lines
 */
export function addChainMouseoverRects(
  computedChains: ComputedChain[],
  chainYOffsets: Map<string, number>,
  featureHeight: number,
  view: LGV,
  featuresForFlatbush: FlatbushEntry[],
) {
  for (const computedChain of computedChains) {
    const { id, chain, minX, maxX } = computedChain
    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    const chainMinXPx = minX - view.offsetPx
    const chainMaxXPx = maxX - view.offsetPx
    if (chain.length > 0) {
      const firstFeat = chain[0]!
      featuresForFlatbush.push({
        x1: chainMinXPx,
        y1: chainY,
        x2: chainMaxXPx,
        y2: chainY + featureHeight,
        data: {
          name: firstFeat.get('name'),
          refName: firstFeat.get('refName'),
          start: firstFeat.get('start'),
          end: firstFeat.get('end'),
          strand: firstFeat.get('strand'),
          flags: firstFeat.get('flags'),
        },
        chainId: id,
        chainMinX: chainMinXPx,
        chainMaxX: chainMaxXPx,
        chain: chain.map(f => ({
          name: f.get('name'),
          refName: f.get('refName'),
          start: f.get('start'),
          end: f.get('end'),
          strand: f.get('strand'),
          flags: f.get('flags'),
        })),
      })
    }
  }
}

export interface DrawFeatsParams {
  chainData: ChainData
  featureHeight: number
  colorBy: { type: string; tag?: string; extra?: Record<string, unknown> }
  drawSingletons: boolean
  drawProperPairs: boolean
  flipStrandLongReadChains: boolean
  noSpacing?: boolean
  trackMaxHeight?: number
  config: AnyConfigurationModel
  theme: ThemeOptions
  regions: { refName: string; start: number; end: number }[]
  bpPerPx: number
}

export interface DrawFeatsResult {
  featuresForFlatbush: FlatbushEntry[]
  layoutHeight?: number
}

/**
 * Core drawing function without model dependencies
 * Can be used in RPC context
 *
 * Note: view and asm are typed as any because this function is called from both:
 * 1. Main thread with real LinearGenomeViewModel and Assembly instances
 * 2. RPC context with minimal mock objects (ViewSnapshot and AssemblyLike)
 */
export function drawFeatsCore(
  ctx: CanvasRenderingContext2D,
  params: DrawFeatsParams,
  view: any,
  calculateYOffsets: (
    computedChains: ComputedChain[],
    params: DrawFeatsParams,
    featureHeight: number,
  ) => { chainYOffsets: Map<string, number>; layoutHeight?: number },
): DrawFeatsResult {
  const {
    chainData,
    featureHeight,
    colorBy,
    drawSingletons,
    drawProperPairs,
    flipStrandLongReadChains,
  } = params

  const type = colorBy.type || 'insertSizeAndOrientation'
  const { chains } = chainData

  // Filter chains based on settings
  const filteredChains = filterChains(
    chains,
    drawSingletons,
    drawProperPairs,
    type,
    chainData,
  )

  // Compute pixel bounds for each chain
  const computedChains = computeChainBounds(filteredChains, view)

  // Sort chains: singletons first, then by width within each group
  sortComputedChains(computedChains)

  // Calculate Y-offsets using the provided strategy
  const { chainYOffsets, layoutHeight } = calculateYOffsets(
    computedChains,
    params,
    featureHeight,
  )

  // Initialize array for Flatbush mouseover data
  const featuresForFlatbush: FlatbushEntry[] = []

  const renderChevrons = shouldRenderChevrons(view.bpPerPx, featureHeight)

  // Delegate rendering to specialized functions for paired and long-read chains
  drawPairChains({
    ctx,
    type,
    chainData,
    view,
    chainYOffsets,
    renderChevrons,
    featureHeight,
    featuresForFlatbush,
    computedChains,
    config: params.config,
    theme: params.theme,
    regions: params.regions,
    bpPerPx: params.bpPerPx,
    colorBy: params.colorBy,
  })

  drawLongReadChains({
    ctx,
    chainData,
    view,
    chainYOffsets,
    renderChevrons,
    featureHeight,
    featuresForFlatbush,
    computedChains,
    flipStrandLongReadChains,
    config: params.config,
    theme: params.theme,
    regions: params.regions,
    bpPerPx: params.bpPerPx,
    colorBy: params.colorBy,
  })

  // Add full-width rectangles for each chain to enable mouseover on connecting lines
  addChainMouseoverRects(
    computedChains,
    chainYOffsets,
    featureHeight,
    view,
    featuresForFlatbush,
  )

  return { featuresForFlatbush, layoutHeight }
}

/**
 * Common drawing function that delegates Y-offset calculation to a strategy function
 */
export function drawFeatsCommon(
  self: LinearReadCloudDisplayModel,
  ctx: CanvasRenderingContext2D,
  calculateYOffsets: (
    computedChains: ComputedChain[],
    self: LinearReadCloudDisplayModel,
    featureHeight: number,
  ) => { chainYOffsets: Map<string, number>; layoutHeight?: number },
) {
  const { chainData } = self
  if (!chainData) {
    return
  }
  const { assemblyManager } = getSession(self)
  const view = getContainingView(self) as LGV
  const assemblyName = view.assemblyNames[0]!
  const asm = assemblyManager.get(assemblyName)
  if (!asm) {
    return
  }
  const featureHeight = self.featureHeight ?? getConf(self, 'featureHeight')

  const params: DrawFeatsParams = {
    chainData,
    featureHeight,
    colorBy: self.colorBy,
    drawSingletons: self.drawSingletons,
    drawProperPairs: self.drawProperPairs,
    flipStrandLongReadChains: self.flipStrandLongReadChains,
    noSpacing: self.noSpacing,
    trackMaxHeight: self.trackMaxHeight,
  }

  // Adapter function to convert self-based to params-based signature
  const adaptedCalculateYOffsets = (
    computedChains: ComputedChain[],
    params: DrawFeatsParams,
    featureHeight: number,
  ) => {
    return calculateYOffsets(computedChains, self, featureHeight)
  }

  const { featuresForFlatbush, layoutHeight } = drawFeatsCore(
    ctx,
    params,
    view,
    adaptedCalculateYOffsets,
  )

  // Build and set Flatbush index
  buildFlatbushIndex(featuresForFlatbush, self)

  // Set layout height if provided (for stack mode)
  if (layoutHeight !== undefined) {
    self.setLayoutHeight(layoutHeight)
  }
}
