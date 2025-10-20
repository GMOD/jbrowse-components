import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'

import { fillRectCtx, strokeRectCtx } from './util'
import type { LinearReadStackDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import {
  getPairedInsertSizeAndOrientationColor,
  getPairedInsertSizeColor,
  getPairedOrientationColor,
} from '../shared/color'
import type {
  ChainStats,
  ReducedFeature,
} from '../shared/fetchChains'

type LGV = LinearGenomeViewModel

interface LayoutData {
  feat: ReducedFeature
  fill: string
  stroke: string
}

export function getPairedColor({
  type,
  v0,
  v1,
  stats,
}: {
  type: string
  v0: ReducedFeature
  v1: ReducedFeature
  stats?: ChainStats
}): readonly [string, string] | undefined {
  if (type === 'insertSizeAndOrientation') {
    return getPairedInsertSizeAndOrientationColor(v0, v1, stats)
  }
  if (type === 'orientation') {
    return getPairedOrientationColor(v0)
  }
  if (type === 'insertSize') {
    return getPairedInsertSizeColor(v0, v1, stats)
  }
  if (type === 'gradient') {
    const s = Math.min(v0.start, v1.start)
    const e = Math.max(v0.end, v1.end)
    return [
      `hsl(${Math.log10(Math.abs(e - s)) * 10},50%,50%)`,
      `hsl(${Math.log10(Math.abs(e - s)) * 10},50%,30%)`,
    ] as const
  }
  return undefined
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

  const layout = new GranularRectLayout<LayoutData>({
    pitchX: 1,
    pitchY: 1,
  })

  for (const chain of chainData.chains) {
    if (chain.length === 2) {
      const v0 = chain[0]!
      const v1 = chain[1]!
      const [fill, stroke] = getPairedColor({ type, v0, v1, stats: chainData.stats }) || []
      for (const feat of chain) {
        const { refName, start, end, id } = feat
        const s = view.bpToPx({ refName, coord: start })
        const e = view.bpToPx({ refName, coord: end })
        if (s && e) {
          const width = e.offsetPx - s.offsetPx
          layout.addRect(id, s.offsetPx, e.offsetPx, featureHeight, { feat, fill: fill || 'blue', stroke: stroke || 'black' })
        }
      }
    } else {
      for (const feat of chain) {
        const { refName, start, end, id } = feat
        const s = view.bpToPx({ refName, coord: start })
        const e = view.bpToPx({ refName, coord: end })
        if (s && e) {
          const width = e.offsetPx - s.offsetPx
          layout.addRect(id, s.offsetPx, e.offsetPx, featureHeight, {
            feat,
            fill: 'blue',
            stroke: 'black',
          })
        }
      }
    }
  }

  for (const [id, rect] of layout.getRectangles()) {
    const data = layout.getDataByID(id)
    if (data) {
      const { feat, fill, stroke } = data
      const [left, top, right, bottom] = rect
      const xPos = left - view.offsetPx
      const width = right - left
      fillRectCtx(xPos, top, width, bottom - top, ctx, fill)
      strokeRectCtx(xPos, top, width, bottom - top, ctx, stroke)
    }
  }
}