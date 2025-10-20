import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getConf, readConf } from '@jbrowse/core/configuration'

import { fillRectCtx, strokeRectCtx } from './util'
import type { LinearReadStackDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { getPairedInsertSizeAndOrientationColor } from '../shared/color'

type LGV = LinearGenomeViewModel

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
  const colorBy = getConf(self, 'colorBy')

  const layout = new GranularRectLayout({
    pitchX: 1,
    pitchY: 1,
  })

  for (const chain of chainData.chains) {
    if (chain.length === 2) {
      const f1 = chain[0]
      const f2 = chain[1]
      const feature1 = {
        get: (str: string) => {
          if (str === 'refName') return f1.refName
          if (str === 'refName') return f1.refName
          if (str === 'start') return f1.start
          if (str === 'end') return f1.end
          if (str === 'strand') return f1.strand
          if (str === 'pair_orientation') return f1.pair_orientation
          if (str === 'tlen') return f1.tlen
          if (str === 'next_ref') return f1.next_ref
          if (str === 'next_pos') return f1.next_pos
          return undefined
        },
      }
      const feature2 = {
        get: (str: string) => {
          if (str === 'refName') return f2.refName
          if (str === 'refName') return f2.refName
          if (str === 'start') return f2.start
          if (str === 'end') return f2.end
          if (str === 'strand') return f2.strand
          if (str === 'pair_orientation') return f2.pair_orientation
          if (str === 'tlen') return f2.tlen
          if (str === 'next_ref') return f2.next_ref
          if (str === 'next_pos') return f2.next_pos
          return undefined
        },
      }
      const [fill, stroke] = getPairedInsertSizeAndOrientationColor(feature1, feature2, chainData.stats)
      for (const feat of chain) {
        const { refName, start, end } = feat
        layout.add(refName, start, end, featureHeight, { feat, fill, stroke })
      }
    } else {
      for (const feat of chain) {
        const { refName, start, end } = feat
        layout.add(refName, start, end, featureHeight, { feat, fill: 'blue', stroke: 'black' })
      }
    }
  }

  for (const [key, layoutEntry] of layout.getLayout()) {
    for (const r of layoutEntry) {
      const { x, y, w, h, data } = r
      const { feat, fill, stroke } = data
      const { refName, start, end } = feat
      const xPos = (start - view.offsetPx) / view.bpPerPx
      const width = (end - start) / view.bpPerPx
      fillRectCtx(xPos, y, width, h, ctx, fill)
      strokeRectCtx(xPos, y, width, h, ctx, stroke)
    }
  }
}
