import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import { getPairedColor } from '../LinearReadCloudDisplay/drawPairChains'
import { fillRectCtx } from '../shared/canvasUtils'
import { fillColor, getSingletonColor } from '../shared/color'
import { CHEVRON_WIDTH, shouldRenderChevrons } from '../shared/util'
import { drawChevron } from '../shared/chevron'

import type { LinearReadStackDisplayModel } from './model'
import type { ReducedFeature } from '../shared/fetchChains'
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
      const color = getPairedColor({ type, v0, v1, stats: chainData.stats })
      // If getPairedColor returns undefined, it means it's a normal proper pair
      // and we should filter it out
      if (color?.[0] === 'grey') {
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
  const featuresForFlatbush: {
    x1: number
    y1: number
    x2: number
    y2: number
    data: ReducedFeature
    chainId: string
    chainMinX: number
    chainMaxX: number
    chain: ReducedFeature[]
  }[] = []

  // Third pass: draw connecting lines
  for (const { id, chain } of computedChains) {
    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    // Filter out supplementary alignments for determining read type
    const nonSupplementary = chain.filter(feat => !(feat.flags & 2048))
    const isPairedEnd = nonSupplementary.length === 2

    if (isPairedEnd) {
      const v0 = nonSupplementary[0]!
      const v1 = nonSupplementary[1]!

      // Draw connecting line for paired reads
      const r1s = view.bpToPx({
        refName: asm.getCanonicalRefName(v0.refName) || v0.refName,
        coord: v0.start,
      })?.offsetPx
      const r2s = view.bpToPx({
        refName: asm.getCanonicalRefName(v1.refName) || v1.refName,
        coord: v1.start,
      })?.offsetPx

      if (r1s !== undefined && r2s !== undefined) {
        const w = r2s - r1s

        fillRectCtx(
          r1s - view.offsetPx,
          chainY + featureHeight / 2 - 0.5,
          w,
          1,
          ctx,
          '#666',
        )
      }
    } else if (nonSupplementary.length > 2 || nonSupplementary.length === 1) {
      const firstFeat = chain[0]!
      const lastFeat = chain[chain.length - 1]!

      const firstPx = view.bpToPx({
        refName:
          asm.getCanonicalRefName(firstFeat.refName) || firstFeat.refName,
        coord: firstFeat.start,
      })?.offsetPx
      const lastPx = view.bpToPx({
        refName: asm.getCanonicalRefName(lastFeat.refName) || lastFeat.refName,
        coord: lastFeat.end,
      })?.offsetPx

      if (firstPx !== undefined && lastPx !== undefined) {
        const startX = firstPx - view.offsetPx
        const endX = lastPx - view.offsetPx
        const startY = chainY + featureHeight / 2 - 0.5
        const endY = chainY + featureHeight / 2 - 0.5

        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
      }
    }
  }

  // Fourth pass: draw features and populate Flatbush
  for (const { id, chain, minX, maxX } of computedChains) {
    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue // Skip if Y-offset was not determined for this chain
    }

    const renderChevrons = shouldRenderChevrons(view.bpPerPx, featureHeight)

    // Filter out supplementary alignments for paired-end color calculation
    const nonSupplementary = chain.filter(feat => !(feat.flags & 2048))
    const isPairedEnd = nonSupplementary.length === 2

    if (isPairedEnd) {
      const v0 = nonSupplementary[0]!
      const v1 = nonSupplementary[1]!
      const [pairedFill] =
        getPairedColor({ type, v0, v1, stats: chainData.stats }) || []

      let primaryStrand: undefined | number
      if (!(v0.flags & 2048)) {
        primaryStrand = v0.strand
      } else {
        const res = v0.SA?.split(';')[0]!.split(',')[2]
        primaryStrand = res === '-' ? -1 : 1
      }

      for (const feat of chain) {
        const { refName, start, end } = feat
        const s = view.bpToPx({ refName, coord: start })
        const e = view.bpToPx({ refName, coord: end })
        if (s && e) {
          const effectiveStrand = feat.strand * primaryStrand
          const c =
            effectiveStrand === -1 ? 'color_rev_strand' : 'color_fwd_strand'
          const xPos = s.offsetPx - view.offsetPx
          const width = Math.max(e.offsetPx - s.offsetPx, 3)

          if (renderChevrons) {
            drawChevron(
              ctx,
              xPos,
              chainY,
              width,
              featureHeight,
              effectiveStrand,
              pairedFill || fillColor[c],
              CHEVRON_WIDTH,
            )
          } else {
            fillRectCtx(
              xPos,
              chainY,
              width,
              featureHeight,
              ctx,
              pairedFill || fillColor[c],
            )
          }
          featuresForFlatbush.push({
            x1: xPos,
            y1: chainY,
            x2: xPos + width,
            y2: chainY + featureHeight,
            data: feat,
            chainId: id,
            chainMinX: minX - view.offsetPx,
            chainMaxX: maxX - view.offsetPx,
            chain,
          })
        }
      }
    } else {
      // Long reads (>2 non-supplementary) or singletons (1 non-supplementary)
      const isSingleton = chain.length === 1
      const c1 = nonSupplementary.length > 0 ? nonSupplementary[0]! : chain[0]!
      let primaryStrand: undefined | number
      if (!(c1.flags & 2048)) {
        primaryStrand = c1.flags & 16 ? -1 : 1
      } else {
        const res = c1.SA?.split(';')[0]!.split(',')[2]
        primaryStrand = res === '-' ? -1 : 1
      }

      for (const feat of chain) {
        const { refName, start, end } = feat
        const s = view.bpToPx({ refName, coord: start })
        const e = view.bpToPx({ refName, coord: end })
        if (s && e) {
          const effectiveStrand = feat.strand * primaryStrand
          const xPos = s.offsetPx - view.offsetPx
          const width = Math.max(e.offsetPx - s.offsetPx, 3)

          // Determine color based on whether it's a singleton
          let featureFill: string
          if (isSingleton) {
            const [fill] = getSingletonColor(feat, chainData.stats)
            featureFill = fill
          } else {
            const c =
              effectiveStrand === -1 ? 'color_rev_strand' : 'color_fwd_strand'
            featureFill = fillColor[c]
          }

          if (renderChevrons) {
            drawChevron(
              ctx,
              xPos,
              chainY,
              width,
              featureHeight,
              effectiveStrand,
              featureFill,
              CHEVRON_WIDTH,
            )
          } else {
            fillRectCtx(xPos, chainY, width, featureHeight, ctx, featureFill)
          }
          featuresForFlatbush.push({
            x1: xPos,
            y1: chainY,
            x2: xPos + width,
            y2: chainY + featureHeight,
            data: feat,
            chainId: id,
            chainMinX: minX - view.offsetPx,
            chainMaxX: maxX - view.offsetPx,
            chain,
          })
        }
      }
    }

    // Add a full-width rectangle for the entire chain to enable mouseover on connecting lines
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
  self.setLayoutHeight(layout.getTotalHeight())
}
