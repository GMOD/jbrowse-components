import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { max, min } from '@jbrowse/core/util'

import { ChainData, ChainStats, ReducedFeature } from '../shared/fetchChains'
import { LinearReadCloudDisplayModel } from './model'
import { fillColor, strokeColor } from '../shared/color'

export function drawLongReadChains({
  ctx,
  self,
  chainData,
  view,
  asm,
}: {
  ctx: CanvasRenderingContext2D
  self: LinearReadCloudDisplayModel
  chainData: ChainData
  view: LinearGenomeViewModel
  asm: Assembly
}) {
  const distances: number[] = []
  const { chains } = chainData
  for (const chain of chains) {
    let minCoord = 0
    let maxCoord = 0
    const currRef = chain[0]?.refName
    for (const c of chain) {
      if (c.refName === currRef) {
        minCoord = Math.min(minCoord, c.start)
        maxCoord = Math.max(maxCoord, c.end)
      }
    }
    const distance = Math.abs(maxCoord - minCoord)
    distances.push(distance)
  }

  const maxD = Math.log(max(distances))
  const minD = Math.max(Math.log(min(distances)) - 1, 0)
  const scaler = (self.height - 20) / (maxD - minD)

  function fill({
    r1s,
    r1e,
    r2s,
    r2e,
    distance,
    v0,
    v1,
  }: {
    r1s: number
    r1e: number
    r2s: number
    r2e: number
    distance: number
    v0: ReducedFeature
    v1: ReducedFeature
  }) {
    const w1 = Math.max(r1e - r1s, 2)
    const w2 = Math.max(r2e - r2s, 2)
    const top = (Math.log(distance) - minD) * scaler
    const halfHeight = featureHeight / 2 - 0.5
    const w = r2s - r1e
    fillRectCtx(r1e - view.offsetPx, top + halfHeight, w, 1, ctx, 'black')

    const fill = v0.strand === -1 ? 'color_rev_strand' : 'color_pos_strand'
    strokeRectCtx(
      r1s - view.offsetPx,
      top,
      w1,
      featureHeight,
      ctx,
      strokeColor[c],
    )
    fillRectCtx(r1s - view.offsetPx, top, w1, featureHeight, ctx, fillColor[c])
  }
  for (const chain of chains) {
    fill(chain)
  }
}

function getLongReadColor({
  type,
  v0,
  v1,
  stats,
}: {
  type: string
  v0: ReducedFeature
  v1: ReducedFeature
  stats?: ChainStats
}): readonly [string, string] {
  return ['grey', 'grey']
}
