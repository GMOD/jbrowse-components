import { getConf } from '@jbrowse/core/configuration'
import { max, min } from '@jbrowse/core/util'

import { fillRectCtx, strokeRectCtx } from './util'
import {
  getPairedInsertSizeAndOrientationColor,
  getPairedInsertSizeColor,
  getPairedOrientationColor,
} from '../shared/color'
import type { LinearReadCloudDisplayModel } from './model'
import type {
  ChainData,
  ChainStats,
  ReducedFeature,
} from '../shared/fetchChains'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface ChainCoord {
  distance: number
  r1s: number
  r1e: number
  r2s: number
  r2e: number
  v0: ReducedFeature
  v1: ReducedFeature
}

export function drawPairChains({
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
  const coords: ChainCoord[] = []
  const featureHeight = getConf(self, 'featureHeight')
  const type = self.colorBy?.type || 'insertSizeAndOrientation'
  const { chains, stats } = chainData

  for (const chain of chains) {
    // if we're looking at a paired read (flag 1) then assume it is just
    // two reads (some small cases may defy this assumption such as
    // secondary alignments but this may be uncommon)
    if (chain.length > 1) {
      const v0 = chain[0]!
      const v1 = chain[1]!
      const ra1 = asm.getCanonicalRefName(v0.refName) || v0.refName
      const ra2 = asm.getCanonicalRefName(v1.refName) || v1.refName
      const r1s = view.bpToPx({ refName: ra1, coord: v0.start })?.offsetPx
      const r1e = view.bpToPx({ refName: ra1, coord: v0.end })?.offsetPx
      const r2s = view.bpToPx({ refName: ra2, coord: v1.start })?.offsetPx
      const r2e = view.bpToPx({ refName: ra2, coord: v1.end })?.offsetPx

      let distance = 0

      if (
        r1s !== undefined &&
        r1e !== undefined &&
        r2s !== undefined &&
        r2e !== undefined
      ) {
        if (v0.refName === v1.refName) {
          const s = Math.min(v0.start, v1.start)
          const e = Math.max(v0.end, v1.end)
          distance = Math.abs(e - s)
        }
        coords.push({
          r1s,
          r1e,
          r2s,
          r2e,
          v0,
          v1,
          distance,
        })
      }
    } else if (self.drawSingletons) {
      const v0 = chain[0]!

      const ra1 = asm.getCanonicalRefName(v0.refName) || v0.refName
      const r1s = view.bpToPx({ refName: ra1, coord: v0.start })?.offsetPx
      const r1e = view.bpToPx({ refName: ra1, coord: v0.end })?.offsetPx
      if (r1s !== undefined && r1e !== undefined) {
        const w1 = Math.max(r1e - r1s, 2)
        fillRectCtx(r1s - view.offsetPx, 0, w1, featureHeight, ctx, '#f00')
        strokeRectCtx(r1s - view.offsetPx, 0, w1, featureHeight, ctx, '#a00')
      }
    }
  }

  const maxD = Math.log(max(coords.map(c => c.distance)))
  const minD = Math.max(Math.log(min(coords.map(c => c.distance))) - 1, 0)
  const scaler = (self.height - 20) / (maxD - minD)
  for (const { r1e, r1s, r2e, r2s, distance, v0, v1 } of coords) {
    const w1 = Math.max(r1e - r1s, 2)
    const w2 = Math.max(r2e - r2s, 2)
    const [fill, stroke] = getPairedColor({ type, v0, v1, stats }) || []
    const top = (Math.log(distance) - minD) * scaler
    const halfHeight = featureHeight / 2 - 0.5
    const w = r2s - r1e
    fillRectCtx(r1e - view.offsetPx, top + halfHeight, w, 1, ctx, 'black')
    strokeRectCtx(r1s - view.offsetPx, top, w1, featureHeight, ctx, stroke)
    strokeRectCtx(r2s - view.offsetPx, top, w2, featureHeight, ctx, stroke)
    fillRectCtx(r1s - view.offsetPx, top, w1, featureHeight, ctx, fill)
    fillRectCtx(r2s - view.offsetPx, top, w2, featureHeight, ctx, fill)
  }
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
