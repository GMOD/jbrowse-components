import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { max, min } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'

import { fillRectCtx, strokeRectCtx } from './util'
import { fillColor, strokeColor } from '../shared/color'
import type { LinearReadStackDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { getPairedColor } from '../LinearReadCloudDisplay/drawPairChains'
import type { ReducedFeature } from '../shared/fetchChains'

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
  const featureHeight = getConf(self, 'featureHeight')
  const type = self.colorBy?.type || 'insertSizeAndOrientation'
  const { chains, stats } = chainData

  const computedChains: {
    distance: number
    minX: number
    maxX: number
    chain: ReducedFeature[]
    id: string
  }[] = []

  // get bounds on the 'distances' (pixel span that a particular split long
  // read 'chain' would have in view)
  for (const chain of chains) {
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

  const layout = new GranularRectLayout<LayoutData>({
    pitchX: 1,
    pitchY: 1,
  })

  // First pass: add all dummy chain rectangles to the layout
  for (const { id, minX, maxX, chain } of computedChains) {

    layout.addRect(id, minX, maxX, featureHeight, {
      feat: chain[0]!, // Use first feature as a placeholder for layout data
      fill: 'transparent',
      stroke: 'transparent',
      distance: maxX - minX,
    })
  }

  // Second pass: retrieve laid-out rectangles and populate chainYOffsets
  const chainYOffsets = new Map<string, number>()
  for (const [id, rect] of layout.getRectangles()) {
    const [left, top, right, bottom] = rect
    chainYOffsets.set(id, top) // Store the Y-offset (top) for the chain
      }


  // Initialize array for Flatbush mouseover data
  const featuresForFlatbush: { x1: number; y1: number; x2: number; y2: number; data: ReducedFeature }[] = []

  // Third pass: draw connecting lines
  for (const { id, chain } of computedChains) {
    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    if (chain.length === 2) {
      const v0 = chain[0]!
      const v1 = chain[1]!

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

        fillRectCtx(r1s - view.offsetPx, chainY + featureHeight / 2 - 0.5, w, 1, ctx, 'black')
      }
    } else if (chain.length > 2) {
      // Draw connecting line for long reads
      const firstFeat = chain[0]!
      const lastFeat = chain[chain.length - 1]!

      const firstPx = view.bpToPx({
        refName: asm.getCanonicalRefName(firstFeat.refName) || firstFeat.refName,
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
        ctx.strokeStyle = 'black'
        ctx.stroke()
      }
    }
  }

  // Fourth pass: draw features and populate Flatbush
  for (const { id, chain } of computedChains) {
    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue // Skip if Y-offset was not determined for this chain
    }

    if (chain.length === 2) {
      const v0 = chain[0]!
      const v1 = chain[1]!
      const [pairedFill, pairedStroke] =
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
          const width = e.offsetPx - s.offsetPx

          fillRectCtx(
            xPos,
            chainY,
            width,
            featureHeight,
            ctx,
            pairedFill || fillColor[c],
          )
          strokeRectCtx(
            xPos,
            chainY,
            width,
            featureHeight,
            ctx,
            pairedStroke || strokeColor[c],
          )
          featuresForFlatbush.push({ x1: xPos, y1: chainY, x2: xPos + width, y2: chainY + featureHeight, data: feat })
        } else {
          console.log(`Skipping feat ${feat.id}, s or e is undefined. s=${s}, e=${e}`)
        }
      }
    } else if (chain.length > 2) {
      const c1 = chain[0]!
      let primaryStrand: undefined | number
      if (!(c1.flags & 2048)) {
        primaryStrand = c1.strand
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
          const c =
            effectiveStrand === -1 ? 'color_rev_strand' : 'color_fwd_strand'
          const xPos = s.offsetPx - view.offsetPx
          const width = e.offsetPx - s.offsetPx
          console.log(`Drawing feat ${feat.id} at xPos=${xPos}, chainY=${chainY}, width=${width}, featureHeight=${featureHeight}, fill=${fillColor[c]}, stroke=${strokeColor[c]}`)
          fillRectCtx(xPos, chainY, width, featureHeight, ctx, fillColor[c])
          strokeRectCtx(xPos, chainY, width, featureHeight, ctx, strokeColor[c])
          featuresForFlatbush.push({ x1: xPos, y1: chainY, x2: xPos + width, y2: chainY + featureHeight, data: feat })
        } else {
          console.log(`Skipping feat ${feat.id}, s or e is undefined. s=${s}, e=${e}`)
        }
      }
    } else {
      // singletons
      for (const feat of chain) {
        const { refName, start, end } = feat
        const s = view.bpToPx({ refName, coord: start })
        const e = view.bpToPx({ refName, coord: end })
        if (s && e) {
          const xPos = s.offsetPx - view.offsetPx
          const width = e.offsetPx - s.offsetPx
          console.log(`Drawing singleton feat ${feat.id} at xPos=${xPos}, chainY=${chainY}, width=${width}, featureHeight=${featureHeight}, fill=#888, stroke=#666`)
          fillRectCtx(xPos, chainY, width, featureHeight, ctx, '#888')
          strokeRectCtx(xPos, chainY, width, featureHeight, ctx, '#666')
          featuresForFlatbush.push({ x1: xPos, y1: chainY, x2: xPos + width, y2: chainY + featureHeight, data: feat })
        } else {
          console.log(`Skipping singleton feat ${feat.id}, s or e is undefined. s=${s}, e=${e}`)
        }
      }
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
