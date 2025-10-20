import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { max, min } from '@jbrowse/core/util'

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
    chain: ReducedFeature[]
  }[] = []

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

  const layout = new GranularRectLayout<LayoutData>({
    pitchX: 1,
    pitchY: 1,
  })

  for (const { distance, chain } of computedChains) {
    if (chain.length === 2) {
      const v0 = chain[0]!
      const v1 = chain[1]!
      const [fill, stroke] =
        getPairedColor({ type, v0, v1, stats: chainData.stats }) || []

      for (const feat of chain) {
        const { refName, start, end, id } = feat
        const s = view.bpToPx({ refName, coord: start })
        const e = view.bpToPx({ refName, coord: end })
        if (s && e) {
          layout.addRect(id, s.offsetPx, e.offsetPx, featureHeight, {
            feat,
            fill: fill || 'blue',
            stroke: stroke || 'black',
            distance,
          })
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
        const { refName, start, end, id } = feat
        const s = view.bpToPx({ refName, coord: start })
        const e = view.bpToPx({ refName, coord: end })
        if (s && e) {
          const effectiveStrand = feat.strand * primaryStrand
          const c =
            effectiveStrand === -1 ? 'color_rev_strand' : 'color_fwd_strand'
          layout.addRect(id, s.offsetPx, e.offsetPx, featureHeight, {
            feat,
            fill: fillColor[c],
            stroke: strokeColor[c],
            distance,
          })
        }
      }
    } else {
      // singletons
      for (const feat of chain) {
        const { refName, start, end, id } = feat
        const s = view.bpToPx({ refName, coord: start })
        const e = view.bpToPx({ refName, coord: end })
        if (s && e) {
          layout.addRect(id, s.offsetPx, e.offsetPx, featureHeight, {
            feat,
            fill: 'blue',
            stroke: 'black',
            distance,
          })
        }
      }
    }
  }

  for (const [id, rect] of layout.getRectangles()) {
    const data = layout.getDataByID(id)
    if (data) {
      const { fill, stroke } = data
      const [left, top, right, bottom] = rect
      const xPos = left - view.offsetPx
      const width = right - left
      fillRectCtx(xPos, top, width, bottom - top, ctx, fill)
      strokeRectCtx(xPos, top, width, bottom - top, ctx, stroke)
    }
  }

  // Draw connecting lines after all features have been laid out
  for (const { chain } of computedChains) {
    if (chain.length > 1) {
      const firstFeat = chain[0]!
      const lastFeat = chain[chain.length - 1]!

      let firstRect: [number, number, number, number] | undefined
      let lastRect: [number, number, number, number] | undefined

      for (const [id, rect] of layout.getRectangles()) {
        if (id === firstFeat.id) {
          firstRect = rect
        }
        if (id === lastFeat.id) {
          lastRect = rect
        }
        if (firstRect && lastRect) {
          break
        }
      }

      if (firstRect && lastRect) {
        const [firstLeft, firstTop, , firstBottom] = firstRect
        const [lastLeft, lastTop, , lastBottom] = lastRect

        const startX = firstLeft - view.offsetPx
        const endX = lastLeft - view.offsetPx
        const startY = firstTop + (firstBottom - firstTop) / 2
        const endY = lastTop + (lastBottom - lastTop) / 2

        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.strokeStyle = 'black'
        ctx.stroke()
      }
    }
  }
}
