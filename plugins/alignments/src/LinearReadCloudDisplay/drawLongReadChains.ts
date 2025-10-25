import { getConf } from '@jbrowse/core/configuration'
import { max, min } from '@jbrowse/core/util'

import { fillRectCtx, strokeRectCtx } from '../shared/canvasUtils'
import { fillColor, strokeColor } from '../shared/color'

import type { LinearReadCloudDisplayModel } from './model'
import type { ChainData, ReducedFeature } from '../shared/fetchChains'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface ComputedChain {
  distance: number
  minX: number
  chain: ReducedFeature[]
}

function drawChevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  strand: number,
  color: string,
  chevronWidth: number,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  if (strand === -1) {
    ctx.moveTo(x - chevronWidth, y + height / 2)
    ctx.lineTo(x, y + height)
    ctx.lineTo(x + width, y + height)
    ctx.lineTo(x + width, y)
    ctx.lineTo(x, y)
  } else {
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + height)
    ctx.lineTo(x + width, y + height)
    ctx.lineTo(x + width + chevronWidth, y + height / 2)
    ctx.lineTo(x + width, y)
  }
  ctx.closePath()
  ctx.fill()
}

export function drawLongReadChains({
  ctx,
  self,
  chainData,
  view,
  asm,
  featuresForFlatbush,
}: {
  ctx: CanvasRenderingContext2D
  self: LinearReadCloudDisplayModel
  chainData: ChainData
  view: LinearGenomeViewModel
  asm: Assembly
  featuresForFlatbush: {
    x1: number
    y1: number
    x2: number
    y2: number
    data: ReducedFeature
    chain: ReducedFeature[]
    chainMinX: number
    chainMaxX: number
    chainTop: number
    chainHeight: number
  }[]
}) {
  const computedChains: ComputedChain[] = []
  const { chains } = chainData
  const { height } = self
  const featureHeight = getConf(self, 'featureHeight')

  // get bounds on the 'distances' (pixel span that a particular split long
  // read 'chain' would have in view)
  for (const chain of chains) {
    let minX = Number.MAX_VALUE
    let maxX = Number.MIN_VALUE
    for (const elt of chain) {
      const refName = asm.getCanonicalRefName(elt.refName) || elt.refName
      const rs = view.bpToPx({ refName, coord: elt.start })?.offsetPx
      const re = view.bpToPx({ refName, coord: elt.end })?.offsetPx
      if (rs !== undefined && re !== undefined) {
        minX = Math.min(minX, rs)
        maxX = Math.max(maxX, re)
      }
    }
    computedChains.push({
      distance: Math.abs(maxX - minX),
      minX,
      chain,
    })
  }

  const distances = computedChains.map(d => d.distance)
  const maxD = Math.log(max(distances))
  const minD = Math.max(Math.log(min(distances)) - 1, 0)
  const scaler = (height - 20) / (maxD - minD)
  const halfHeight = featureHeight / 2 - 0.5

  // draw split long read 'chains' as connected entities
  for (const { minX, distance, chain } of computedChains) {
    const w = distance
    const top = (Math.log(w) - minD) * scaler
    fillRectCtx(minX - view.offsetPx, top + halfHeight, w, 1, ctx, 'black')
    const c1 = chain[0]!
    let primaryStrand: undefined | number
    if (!(c1.flags & 2048)) {
      primaryStrand = c1.strand
    } else {
      const res = c1.SA?.split(';')[0]!.split(',')[2]
      primaryStrand = res === '-' ? -1 : 1
    }

    // Calculate chain bounds
    let chainMinXVal = Number.MAX_VALUE
    let chainMaxXVal = Number.MIN_VALUE

    const renderChevrons = view.bpPerPx < 10 && featureHeight > 5
    const chevronWidth = 5

    for (const v0 of chain) {
      const ra = asm.getCanonicalRefName(v0.refName) || v0.refName
      const rs = view.bpToPx({ refName: ra, coord: v0.start })?.offsetPx
      const re = view.bpToPx({ refName: ra, coord: v0.end })?.offsetPx
      if (rs !== undefined && re !== undefined) {
        const w = Math.max(re - rs, 2)
        const l = rs - view.offsetPx
        const effectiveStrand = v0.strand * primaryStrand
        const c =
          effectiveStrand === -1 ? 'color_rev_strand' : 'color_fwd_strand'
        
        if (renderChevrons) {
          drawChevron(
            ctx,
            l,
            top,
            w,
            featureHeight,
            effectiveStrand,
            fillColor[c],
            chevronWidth,
          )
        } else {
          strokeRectCtx(l, top, w, featureHeight, ctx, strokeColor[c])
          fillRectCtx(l, top, w, featureHeight, ctx, fillColor[c])
        }

        chainMinXVal = Math.min(chainMinXVal, l)
        chainMaxXVal = Math.max(chainMaxXVal, l + w)

        // Add feature to flatbush for mouseover
        featuresForFlatbush.push({
          x1: l,
          y1: top,
          x2: l + w,
          y2: top + featureHeight,
          data: v0,
          chain,
          chainMinX: chainMinXVal,
          chainMaxX: chainMaxXVal,
          chainTop: top,
          chainHeight: featureHeight,
        })
      }
    }

    // Update chain bounds for all features after processing
    const chainMinX = chainMinXVal
    const chainMaxX = chainMaxXVal
    for (
      let i = featuresForFlatbush.length - chain.length;
      i < featuresForFlatbush.length;
      i++
    ) {
      const feat = featuresForFlatbush[i]
      if (feat) {
        feat.chainMinX = chainMinX
        feat.chainMaxX = chainMaxX
      }
    }
  }
}
