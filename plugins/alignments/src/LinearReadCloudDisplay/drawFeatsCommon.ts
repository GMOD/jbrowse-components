import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'

import { drawLongReadChains } from './drawLongReadChains'
import { drawPairChains } from './drawPairChains'
import { PairType, getPairedType } from '../shared/color'
import { shouldRenderChevrons } from '../shared/util'

import type { LinearReadCloudDisplayModel } from './model'
import type { FlatbushEntry } from '../shared/flatbushType'
import type { FlatbushItem } from '../PileupRenderer/types'
import type { ChainData, ColorBy } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
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
        const pairType = getPairedType({
          type,
          f: {
            refName: v0.get('refName'),
            next_ref: v0.get('next_ref'),
            pair_orientation: v0.get('pair_orientation'),
            tlen: v0.get('template_length'),
            flags: v0.get('flags'),
          },
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
 * Build Flatbush index for mismatch mouseover detection
 */
export function buildMismatchFlatbushIndex(
  mismatchFlatbushData: ArrayBuffer,
  mismatchItems: FlatbushItem[],
  self: LinearReadCloudDisplayModel,
) {
  const mismatchFlatbush = Flatbush.from(mismatchFlatbushData)
  self.setMismatchLayout(mismatchFlatbush)
  self.setMismatchItems(mismatchItems)
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

    const viewOffsetPx = Math.max(0, view.offsetPx)
    const chainMinXPx = minX - viewOffsetPx
    const chainMaxXPx = maxX - viewOffsetPx
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
          id: firstFeat.id(),
          tlen: firstFeat.get('template_length') || 0,
          pair_orientation: firstFeat.get('pair_orientation') || '',
          clipPos: firstFeat.get('clipPos') || 0,
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
          id: f.id(),
          tlen: f.get('template_length') || 0,
          pair_orientation: f.get('pair_orientation') || '',
          clipPos: f.get('clipPos') || 0,
        })),
      })
    }
  }
}

export interface DrawFeatsParams {
  chainData: ChainData
  featureHeight: number
  colorBy: ColorBy
  drawSingletons: boolean
  drawProperPairs: boolean
  flipStrandLongReadChains: boolean
  noSpacing?: boolean
  trackMaxHeight?: number
  config: AnyConfigurationModel
  theme: ThemeOptions
  regions: BaseBlock[]
  bpPerPx: number
  canvasWidth: number
  stopToken?: string
}

export interface DrawFeatsResult {
  featuresForFlatbush: FlatbushEntry[]
  layoutHeight?: number
  mismatchFlatbush: ArrayBuffer
  mismatchItems: FlatbushItem[]
}

export function drawFeatsCore({
  ctx,
  params,
  view,
  calculateYOffsets,
}: {
  ctx: CanvasRenderingContext2D
  params: DrawFeatsParams
  view: any
  calculateYOffsets: (computedChains: ComputedChain[]) => {
    chainYOffsets: Map<string, number>
    layoutHeight?: number
  }
}): DrawFeatsResult {
  const {
    chainData,
    featureHeight,
    colorBy,
    drawSingletons,
    drawProperPairs,
    flipStrandLongReadChains,
    stopToken,
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
  const { chainYOffsets, layoutHeight } = calculateYOffsets(computedChains)

  // Initialize array for Flatbush mouseover data
  const featuresForFlatbush: FlatbushEntry[] = []

  const renderChevrons = shouldRenderChevrons(view.bpPerPx, featureHeight)

  // Clamp viewOffsetPx to 0 when negative
  const viewOffsetPx = Math.max(0, view.offsetPx)

  // Collect mismatch data for flatbush tooltips
  const mismatchCoords: number[] = []
  const mismatchItems: FlatbushItem[] = []

  // Render each region independently with clipping to prevent bleeding between regions
  for (const region of params.regions) {
    ctx.save()

    // Set up clipping rect for this region
    const regionStartPx = region.offsetPx - viewOffsetPx
    ctx.beginPath()
    ctx.rect(regionStartPx, 0, region.widthPx, 100000)
    ctx.clip()

    // Translate coordinate system for this region
    ctx.translate(regionStartPx, 0)

    // Delegate rendering to specialized functions for paired and long-read chains
    const pairMismatches = drawPairChains({
      ctx,
      type,
      chainData,
      chainYOffsets,
      renderChevrons,
      featureHeight,
      computedChains,
      config: params.config,
      theme: params.theme,
      region,
      regionStartPx,
      bpPerPx: params.bpPerPx,
      colorBy: params.colorBy,
      stopToken,
    })

    const longReadMismatches = drawLongReadChains({
      ctx,
      chainData,
      chainYOffsets,
      renderChevrons,
      featureHeight,
      computedChains,
      flipStrandLongReadChains,
      config: params.config,
      theme: params.theme,
      region,
      regionStartPx,
      bpPerPx: params.bpPerPx,
      colorBy: params.colorBy,
      stopToken,
    })

    // Aggregate mismatch data
    mismatchCoords.push(...pairMismatches.coords, ...longReadMismatches.coords)
    mismatchItems.push(...pairMismatches.items, ...longReadMismatches.items)

    ctx.restore()
  }

  // Add full-width rectangles for each chain to enable mouseover on connecting lines
  addChainMouseoverRects(
    computedChains,
    chainYOffsets,
    featureHeight,
    view,
    featuresForFlatbush,
  )

  // Build flatbush index for mismatch tooltips
  const mismatchFlatbush = new Flatbush(Math.max(mismatchItems.length, 1))
  if (mismatchCoords.length) {
    for (let i = 0; i < mismatchCoords.length; i += 4) {
      mismatchFlatbush.add(
        mismatchCoords[i]!,
        mismatchCoords[i + 1]!,
        mismatchCoords[i + 2]!,
        mismatchCoords[i + 3]!,
      )
    }
  } else {
    mismatchFlatbush.add(0, 0, 0, 0)
  }
  mismatchFlatbush.finish()

  return {
    featuresForFlatbush,
    layoutHeight,
    mismatchFlatbush: mismatchFlatbush.data,
    mismatchItems,
  }
}

/**
 * Common drawing function that delegates Y-offset calculation to a strategy function
 */
export function drawFeatsCommon({
  self,
  ctx,
  canvasWidth,
  calculateYOffsets,
}: {
  self: LinearReadCloudDisplayModel
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  calculateYOffsets: (computedChains: ComputedChain[]) => {
    chainYOffsets: Map<string, number>
    layoutHeight?: number
  }
}) {
  const { chainData } = self
  if (!chainData) {
    return
  }
  const session = getSession(self)
  const { assemblyManager } = session
  const view = getContainingView(self) as LGV
  const assemblyName = view.assemblyNames[0]!
  const asm = assemblyManager.get(assemblyName)
  if (!asm) {
    return
  }
  const featureHeight = self.featureHeight ?? getConf(self, 'featureHeight')

  const { featuresForFlatbush, layoutHeight } = drawFeatsCore({
    ctx,
    params: {
      canvasWidth,
      chainData,
      featureHeight,
      colorBy: self.colorBy,
      drawSingletons: self.drawSingletons,
      drawProperPairs: self.drawProperPairs,
      flipStrandLongReadChains: self.flipStrandLongReadChains,
      noSpacing: self.noSpacing,
      trackMaxHeight: self.trackMaxHeight,
      config: self.configuration,
      theme: session.theme!,
      regions: view.staticBlocks.contentBlocks,
      bpPerPx: view.bpPerPx,
    },
    view,
    calculateYOffsets,
  })

  // Build and set Flatbush index
  buildFlatbushIndex(featuresForFlatbush, self)

  // Set layout height if provided (for stack mode)
  if (layoutHeight !== undefined) {
    self.setLayoutHeight(layoutHeight)
  }
}
