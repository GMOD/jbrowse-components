import { getContainingView, getSession } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'

import { drawLongReadChains } from './drawLongReadChains'
import { drawPairChains } from './drawPairChains'
import { hasPairedReads } from '../shared/util'

import type { LinearReadCloudDisplayModel } from './model'
import type { ReducedFeature } from '../shared/fetchChains'
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

  // Initialize array for Flatbush mouseover data
  const featuresForFlatbush: {
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
  }[] = []

  const hasPaired = hasPairedReads(chainData)

  if (hasPaired) {
    drawPairChains({ self, view, asm, ctx, chainData, featuresForFlatbush })
  } else {
    drawLongReadChains({ self, view, asm, ctx, chainData, featuresForFlatbush })
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
