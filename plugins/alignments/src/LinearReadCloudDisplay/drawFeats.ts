import { getContainingView, getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { LinearReadCloudDisplayModel } from './model'
import { hasPairedReads } from '../shared/util'
import { drawPairChains } from './drawPairChains'
import { drawLongReadChains } from './drawLongReadChains'

type LGV = LinearGenomeViewModel

export default function drawFeats(
  self: LinearReadCloudDisplayModel,
  ctx: CanvasRenderingContext2D,
) {
  const { chainData } = self
  if (!chainData) {
    return
  }
  const { assemblyManager } = getSession(self)
  const view = getContainingView(self) as LGV
  const assemblyName = view.assemblyNames[0]
  const asm = assemblyManager.get(assemblyName)
  if (!asm) {
    return
  }

  const hasPaired = hasPairedReads(chainData)

  if (hasPaired) {
    drawPairChains({ self, view, asm, ctx, chainData })
  } else {
    drawLongReadChains({ self, view, asm, ctx, chainData })
  }
}
