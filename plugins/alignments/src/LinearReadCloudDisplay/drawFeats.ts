import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession, max, min } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'

import { PairType, getPairedType } from '../shared/color'
import { drawLongReadChains } from '../shared/drawLongReadChains'
import { drawPairChains } from '../shared/drawPairChains'
import { shouldRenderChevrons } from '../shared/util'

import type { LinearReadCloudDisplayModel } from './model'
import type { ReducedFeature } from '../shared/fetchChains'
import type { FlatbushEntry } from '../shared/flatbushType'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function drawFeats(
  self: LinearReadCloudDisplayModel,
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

  // Calculate Y-offsets based on distance (logarithmic scaling)
  const distances = computedChains.map(c => c.distance).filter(d => d > 0)
  const maxD = distances.length > 0 ? Math.log(max(distances)) : 0
  const minD =
    distances.length > 0 ? Math.max(Math.log(min(distances)) - 1, 0) : 0
  const scaler = (self.height - 20) / (maxD - minD || 1)

  // Calculate Y-offsets for each chain
  const chainYOffsets = new Map<string, number>()
  for (const { id, distance } of computedChains) {
    const top = distance > 0 ? (Math.log(distance) - minD) * scaler : 0
    chainYOffsets.set(id, top)
  }

  // Initialize array for Flatbush mouseover data
  const featuresForFlatbush: FlatbushEntry[] = []

  const renderChevrons = shouldRenderChevrons(view.bpPerPx, featureHeight)

  // Delegate rendering to specialized functions for paired and long-read chains
  drawPairChains({
    ctx,
    type,
    chainData,
    view,
    asm,
    chainYOffsets,
    renderChevrons,
    featureHeight,
    featuresForFlatbush,
    computedChains,
  })

  drawLongReadChains({
    ctx,
    chainData,
    view,
    asm,
    chainYOffsets,
    renderChevrons,
    featureHeight,
    featuresForFlatbush,
    computedChains,
  })

  // Add full-width rectangles for each chain to enable mouseover on connecting lines
  for (const { id, chain, minX, maxX } of computedChains) {
    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    const chainMinXPx = minX - view.offsetPx
    const chainMaxXPx = maxX - view.offsetPx
    if (chain.length > 0) {
      featuresForFlatbush.push({
        x1: chainMinXPx,
        y1: chainY,
        x2: chainMaxXPx,
        y2: chainY + featureHeight,
        data: chain[0]!, // Use first feature as representative
        chainId: id,
        chainMinX: chainMinXPx,
        chainMaxX: chainMaxXPx,
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
}
