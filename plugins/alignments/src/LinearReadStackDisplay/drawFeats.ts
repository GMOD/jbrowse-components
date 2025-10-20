import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'

import { fillRectCtx, strokeRectCtx } from './util'
import type { LinearReadStackDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { getPairedInsertSizeAndOrientationColor } from '../shared/color'
import type { ReducedFeature } from '../shared/fetchChains'

type LGV = LinearGenomeViewModel

interface LayoutData {
  feat: ReducedFeature
  fill: string
  stroke: string
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

  const layout = new GranularRectLayout<LayoutData>({
    pitchX: 1,
    pitchY: 1,
  })

  for (const chain of chainData.chains) {
    if (chain.length === 2) {
      const f1 = chain[0]!
      const f2 = chain[1]!
      const [fill, stroke] = getPairedInsertSizeAndOrientationColor(
        f1,
        f2,
        chainData.stats,
      )
      for (const feat of chain) {
        const { refName, start, end, id } = feat
        layout.addRect(id, start, end, featureHeight, { feat, fill, stroke })
      }
    } else {
      for (const feat of chain) {
        const { refName, start, end, id } = feat
        layout.addRect(id, start, end, featureHeight, {
          feat,
          fill: 'blue',
          stroke: 'black',
        })
      }
    }
  }

  for (const [id, rect] of layout.getRectangles()) {
    const data = layout.getDataByID(id)
    if (data) {
      const { feat, fill, stroke } = data
      const [left, top, right, bottom] = rect
      const xPos = (left - view.offsetPx) / view.bpPerPx
      const width = (right - left) / view.bpPerPx
      fillRectCtx(xPos, top, width, bottom - top, ctx, fill)
      strokeRectCtx(xPos, top, width, bottom - top, ctx, stroke)
    }
  }
}
