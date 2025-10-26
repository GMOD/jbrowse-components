import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import { drawLongReadChains } from './drawLongReadChains'
import { drawPairChains } from './drawPairChains'
import { PairType, getPairedType } from '../shared/color'
import { shouldRenderChevrons } from '../shared/util'

import type { LinearReadStackDisplayModel } from './model'
import type { ReducedFeature } from '../shared/fetchChains'
import type { FlatbushEntry } from '../shared/flatbushType'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface LayoutData {
  feat: ReducedFeature
  fill: string
  stroke: string
  distance: number
}

export function drawFeats(
  self: LinearReadStackDisplayModel,
  ctx: CanvasRenderingContext2D,
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
  const noSpacing = self.noSpacing ?? false
  const maxHeight = self.trackMaxHeight ?? 1200
  const type = self.colorBy?.type || 'insertSizeAndOrientation'
  const drawSingletons = self.drawSingletons
  const drawProperPairs = self.drawProperPairs
  const { chains } = chainData

  // Filter chains based on settings
  const filteredChains = chains.filter(chain => {
    // Filter out singletons if drawSingletons is false
    if (!drawSingletons && chain.length === 1) {
      return false
    }

    // Filter out proper pairs if drawProperPairs is false
    // Only show pairs that have an interesting color (orientation/insert size issues)
    if (!drawProperPairs && chain.length === 2) {
      const v0 = chain[0]!
      const v1 = chain[1]!
      const pairType = getPairedType({
        type,
        f1: v0,
        f2: v1,
        stats: chainData.stats,
      })
      // Filter out proper pairs
      if (pairType === PairType.PROPER_PAIR) {
        return false
      }
    }

    return true
  })

  const computedChains: {
    distance: number
    minX: number
    maxX: number
    chain: ReducedFeature[]
    id: string
  }[] = []

  // get bounds on the 'distances' (pixel span that a particular split long
  // read 'chain' would have in view)
  for (const chain of filteredChains) {
    let minX = Number.MAX_VALUE
    let maxX = Number.MIN_VALUE
    let chainId = ''
    for (const elt of chain) {
      const refName = asm.getCanonicalRefName(elt.refName) || elt.refName
      const rs = view.bpToPx({ refName, coord: elt.start })?.offsetPx
      const re = view.bpToPx({ refName, coord: elt.end })?.offsetPx
      if (rs !== undefined && re !== undefined) {
        minX = Math.min(minX, rs)
        maxX = Math.max(maxX, re)
      }
      if (!chainId) {
        chainId = elt.id
      }
    }
    computedChains.push({
      distance: Math.abs(maxX - minX),
      minX,
      maxX,
      chain,
      id: chainId,
    })
  }

  // Sort chains: singletons first, then by width within each group
  // (so larger/more complex chains are drawn on top)
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

  const layout = new GranularRectLayout<LayoutData>({
    pitchX: 1,
    pitchY: 1,
    maxHeight,
  })

  // Add small padding between rows (unless noSpacing is enabled)
  const layoutPadding = noSpacing ? 0 : 1

  // First pass: add all dummy chain rectangles to the layout
  for (const { id, minX, maxX, chain } of computedChains) {
    layout.addRect(id, minX, maxX, featureHeight + layoutPadding, {
      feat: chain[0]!, // Use first feature as a placeholder for layout data
      fill: 'transparent',
      stroke: 'transparent',
      distance: maxX - minX,
    })
  }

  // Second pass: retrieve laid-out rectangles and populate chainYOffsets
  const chainYOffsets = new Map<string, number>()
  for (const [id, rect] of layout.getRectangles()) {
    const top = rect[1]
    chainYOffsets.set(id, top) // Store the Y-offset (top) for the chain
  }

  // Initialize array for Flatbush mouseover data
  const featuresForFlatbush: FlatbushEntry[] = []

  const renderChevrons = shouldRenderChevrons(view.bpPerPx, featureHeight)

  // Third pass: draw features
  drawPairChains({
    ctx,
    self,
    chainData,
    view,
    asm,
    chainYOffsets,
    renderChevrons,
    featureHeight,
    featuresForFlatbush,
  })

  drawLongReadChains({
    ctx,
    self,
    chainData,
    view,
    asm,
    chainYOffsets,
    renderChevrons,
    featureHeight,
    featuresForFlatbush,
  })

  // Add full-width rectangles for chain mouseover on connecting lines
  for (const { id, chain, minX, maxX } of computedChains) {
    const chainY = chainYOffsets.get(id)
    if (chain.length > 0 && chainY !== undefined) {
      featuresForFlatbush.push({
        x1: minX - view.offsetPx,
        y1: chainY,
        x2: maxX - view.offsetPx,
        y2: chainY + featureHeight,
        data: chain[0]!, // Use first feature as representative
        chainId: id,
        chainMinX: minX - view.offsetPx,
        chainMaxX: maxX - view.offsetPx,
        chain,
      })
    }
  }

  // Build and set Flatbush index
  const finalFlatbush = new Flatbush(Math.max(featuresForFlatbush.length, 1))
  if (featuresForFlatbush.length) {
    for (const { x1, y1, x2, y2 } of featuresForFlatbush) {
      finalFlatbush.add(x1, y1, x2, y2)
    }
  } else {
    // flatbush does not like 0 items
    finalFlatbush.add(0, 0)
  }
  finalFlatbush.finish()
  self.setFeatureLayout(finalFlatbush)
  self.setFeaturesForFlatbush(featuresForFlatbush)
  self.setLayoutHeight(layout.getTotalHeight())
}
