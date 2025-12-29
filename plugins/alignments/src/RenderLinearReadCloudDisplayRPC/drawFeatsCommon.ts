import Flatbush from '@jbrowse/core/util/flatbush'

import {
  CLIP_RECT_HEIGHT,
  chainIsPairedEnd,
  collectNonSupplementary,
} from './drawChainsUtil'
import { drawLongReadChains } from './drawLongReadChains'
import { drawPairChains } from './drawPairChains'
import { PairType, getPairedType } from '../shared/color'
import { SAM_FLAG_PAIRED, SAM_FLAG_SUPPLEMENTARY } from '../shared/samFlags'
import { shouldRenderChevrons } from '../shared/util'

import type { LinearReadCloudDisplayModel } from '../LinearReadCloudDisplay/model'
import type { FlatbushItem } from '../PileupRenderer/types'
import type { FlatbushEntry } from '../shared/flatbushType'
import type {
  ChainData,
  ColorBy,
  ModificationTypeWithColor,
} from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { ThemeOptions } from '@mui/material'

type LGV = LinearGenomeViewModel

// If TLEN is more than this factor larger than the visible bp span,
// it's likely from a distant mate (e.g., SV) and shouldn't affect scaling
const TLEN_CONSISTENCY_FACTOR = 100

export interface ComputedChain {
  distance: number
  minX: number
  maxX: number
  chain: Feature[]
  id: string
  // Pre-computed to avoid repeated iteration in drawing code
  isPairedEnd: boolean
  nonSupplementary: Feature[]
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

  for (const chain of chains) {
    // Filter out singletons if drawSingletons is false
    if (!drawSingletons && chain.length === 1) {
      continue
    }

    // Filter out proper pairs if drawProperPairs is false
    const isPairedEnd = chainIsPairedEnd(chain)

    if (!drawProperPairs && isPairedEnd) {
      const nonSupplementary = collectNonSupplementary(chain)
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
  const { bpPerPx } = view

  for (const chain of chains) {
    let minX = Number.MAX_VALUE
    let maxX = Number.MIN_VALUE
    let chainId = ''
    let tlenDistance = 0
    let isPairedEnd = false
    const nonSupplementary: Feature[] = []
    const chainLength = chain.length

    for (let j = 0; j < chainLength; j++) {
      const elt = chain[j]!
      const start = elt.get('start')
      const end = elt.get('end')
      const flags = elt.get('flags')

      // Pre-compute isPairedEnd and nonSupplementary in single pass
      if (flags & SAM_FLAG_PAIRED) {
        isPairedEnd = true
      }
      if (!(flags & SAM_FLAG_SUPPLEMENTARY)) {
        nonSupplementary.push(elt)
      }

      // Only call bpToPx once per feature, calculate end from start + length
      const rs = view.bpToPx({
        refName: elt.get('refName'),
        coord: start,
      })?.offsetPx
      if (rs !== undefined) {
        const re = rs + (end - start) / bpPerPx
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

    // Skip chains with no valid pixel positions
    if (minX === Number.MAX_VALUE || maxX === Number.MIN_VALUE) {
      continue
    }

    // Only use TLEN for distance; chains without valid TLEN get distance=0
    // (placed at y=0 in cloud mode). Also filter out chains where TLEN is
    // wildly inconsistent with the visible bp span (e.g., distant mate from SV)
    let distance = 0
    if (tlenDistance > 0) {
      const bpSpan = (maxX - minX) * bpPerPx
      if (tlenDistance <= bpSpan * TLEN_CONSISTENCY_FACTOR) {
        distance = tlenDistance
      }
    }

    computedChains.push({
      distance,
      minX,
      maxX,
      chain,
      id: chainId,
      isPairedEnd,
      nonSupplementary,
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
    const { id, chain, minX, maxX, nonSupplementary } = computedChain
    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    const viewOffsetPx = Math.max(0, view.offsetPx)
    const chainMinXPx = minX - viewOffsetPx
    const chainMaxXPx = maxX - viewOffsetPx
    if (chain.length > 0) {
      // Use pre-computed nonSupplementary from computeChainBounds
      const primaryFeat = nonSupplementary[0] || chain[0]!
      const hasSupplementary = nonSupplementary.length < chain.length
      featuresForFlatbush.push({
        x1: chainMinXPx,
        y1: chainY,
        x2: chainMaxXPx,
        y2: chainY + featureHeight,
        data: {
          name: primaryFeat.get('name'),
          refName: primaryFeat.get('refName'),
          start: primaryFeat.get('start'),
          end: primaryFeat.get('end'),
          strand: primaryFeat.get('strand'),
          flags: primaryFeat.get('flags'),
          id: primaryFeat.id(),
          tlen: primaryFeat.get('template_length') || 0,
          pair_orientation: primaryFeat.get('pair_orientation') || '',
          clipLengthAtStartOfRead:
            primaryFeat.get('clipLengthAtStartOfRead') || 0,
          next_ref: primaryFeat.get('next_ref'),
        },
        chainId: id,
        chainMinX: chainMinXPx,
        chainMaxX: chainMaxXPx,
        hasSupplementary,
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
          clipLengthAtStartOfRead: f.get('clipLengthAtStartOfRead') || 0,
          next_ref: f.get('next_ref'),
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
  visibleModifications?: Record<string, ModificationTypeWithColor>
  hideSmallIndels?: boolean
  hideMismatches?: boolean
  hideLargeIndels?: boolean
}

export interface DrawFeatsResult {
  featuresForFlatbush: FlatbushEntry[]
  layoutHeight?: number
  cloudScaleInfo?: { minDistance: number; maxDistance: number }
  mismatchFlatbush: ArrayBufferLike
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
    cloudScaleInfo?: { minDistance: number; maxDistance: number }
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
  const { chainYOffsets, layoutHeight, cloudScaleInfo } =
    calculateYOffsets(computedChains)

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
    ctx.rect(regionStartPx, 0, region.widthPx, CLIP_RECT_HEIGHT)
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
      visibleModifications: params.visibleModifications,
      stopToken,
      hideSmallIndels: params.hideSmallIndels,
      hideMismatches: params.hideMismatches,
      hideLargeIndels: params.hideLargeIndels,
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
      visibleModifications: params.visibleModifications,
      stopToken,
      hideSmallIndels: params.hideSmallIndels,
      hideMismatches: params.hideMismatches,
      hideLargeIndels: params.hideLargeIndels,
    })

    // Aggregate mismatch data (avoid push(...list) which can cause stack overflow)
    for (const coord of pairMismatches.coords) {
      mismatchCoords.push(coord)
    }
    for (const coord of longReadMismatches.coords) {
      mismatchCoords.push(coord)
    }
    for (const item of pairMismatches.items) {
      mismatchItems.push(item)
    }
    for (const item of longReadMismatches.items) {
      mismatchItems.push(item)
    }

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
        mismatchCoords[i + 2],
        mismatchCoords[i + 3],
      )
    }
  } else {
    mismatchFlatbush.add(0, 0, 0, 0)
  }
  mismatchFlatbush.finish()

  return {
    featuresForFlatbush,
    layoutHeight,
    cloudScaleInfo,
    mismatchFlatbush: mismatchFlatbush.data,
    mismatchItems,
  }
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
