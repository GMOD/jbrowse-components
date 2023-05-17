import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { max, min } from '@jbrowse/core/util'

import { ChainData } from '../shared/fetchChains'
import { LinearReadCloudDisplayModel } from './model'
import { fillColor, strokeColor } from '../shared/color'
import { getConf } from '@jbrowse/core/configuration'
import { fillRectCtx, strokeRectCtx } from './util'

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
  const minXs: number[] = []
  const { chains } = chainData
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
    const distance = Math.abs(maxX - minX)
    distances.push(distance)
    minXs.push(minX)
  }

  const featureHeight = getConf(self, 'featureHeight')

  const maxD = Math.log(max(distances))
  const minD = Math.max(Math.log(min(distances)) - 1, 0)
  const scaler = (self.height - 20) / (maxD - minD)
  const halfHeight = featureHeight / 2 - 0.5
  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i]
    const w = distances[i]
    const top = (Math.log(w) - minD) * scaler
    const min = minXs[i]
    fillRectCtx(min - view.offsetPx, top + halfHeight, w, 1, ctx, 'black')
    for (const v0 of chain) {
      const ra = asm.getCanonicalRefName(v0.refName) || v0.refName
      const rs = view.bpToPx({ refName: ra, coord: v0.start })?.offsetPx
      const re = view.bpToPx({ refName: ra, coord: v0.end })?.offsetPx
      if (rs !== undefined && re !== undefined) {
        const w = Math.max(re - rs, 2)
        const l = rs - view.offsetPx
        const c = v0.strand === -1 ? 'color_rev_strand' : 'color_fwd_strand'
        strokeRectCtx(l, top, w, featureHeight, ctx, strokeColor[c])
        fillRectCtx(l, top, w, featureHeight, ctx, fillColor[c])
      }
    }
  }
}
