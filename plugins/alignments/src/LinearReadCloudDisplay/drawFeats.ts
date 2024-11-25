import { getContainingView, getSession } from '@jbrowse/core/util'
import { drawLongReadChains } from './drawLongReadChains'
import { drawPairChains } from './drawPairChains'
import { hasPairedReads } from '../shared/util'
import type { LinearReadCloudDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals

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

  const hasPaired = hasPairedReads(chainData)

  if (hasPaired) {
    drawPairChains({ self, view, asm, ctx, chainData })
  } else {
    drawLongReadChains({ self, view, asm, ctx, chainData })
  }
}
