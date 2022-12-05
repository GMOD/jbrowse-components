import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
// locals
import {
  getOrientationColor,
  getInsertSizeColor,
  getInsertSizeAndOrientationColor,
} from '../shared/color'
import { PairData, ReducedFeature } from '../shared/fetchPairs'

type LGV = LinearGenomeViewModel

interface PairCoord {
  distance: number
  r1s: number
  r1e: number
  r2s: number
  r2e: number
  v0: ReducedFeature
  v1: ReducedFeature
}

// avoid drawing negative width features for SVG exports
function fillRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  color?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (color) {
    ctx.fillStyle = color
  }
  ctx.fillRect(x, y, width, height)
}

export default async function drawFeats(
  self: {
    setLastDrawnOffsetPx: (n: number) => void
    setError: (e: unknown) => void
    colorBy?: { type: string }
    height: number
    pairedData?: PairData
    ref: HTMLCanvasElement | null
  },
  ctx: CanvasRenderingContext2D,
) {
  const { pairedData } = self
  if (!pairedData) {
    return
  }
  const featureHeight = getConf(self, 'featureHeight')
  const displayHeight = self.height
  const view = getContainingView(self) as LGV

  self.setLastDrawnOffsetPx(view.offsetPx)

  const { pairedFeatures, stats } = pairedData
  const coords = Object.values(pairedFeatures)
    .filter(val => val.length === 2)
    .map(val => {
      const [v0, v1] = val

      const r1s = view.bpToPx({
        refName: v0.refName,
        coord: v0.start,
      })?.offsetPx
      const r1e = view.bpToPx({
        refName: v0.refName,
        coord: v0.end,
      })?.offsetPx
      const r2s = view.bpToPx({
        refName: v1.refName,
        coord: v1.start,
      })?.offsetPx
      const r2e = view.bpToPx({
        refName: v1.refName,
        coord: v1.end,
      })?.offsetPx
      let distance = 0
      if (v0.refName === v1.refName) {
        const s = Math.min(v0.start, v1.start)
        const e = Math.max(v0.end, v1.end)
        distance = Math.abs(e - s)
      }
      return { r1s, r1e, r2s, r2e, v0, v1, distance }
    })
    .filter(
      (f): f is PairCoord =>
        f.r1s !== undefined &&
        f.r1e !== undefined &&
        f.r2s !== undefined &&
        f.r2e !== undefined,
    )

  let max = 0
  for (let i = 0; i < coords.length; i++) {
    const { distance } = coords[i]
    max = Math.max(max, distance)
  }
  max = Math.log(max)
  const halfHeight = featureHeight / 2 - 0.5
  const scaler = (displayHeight - 50) / max

  for (let i = 0; i < coords.length; i++) {
    const { r1s, r1e, r2s, r2e, v0, v1, distance } = coords[i]
    const type = self.colorBy?.type || 'insertSizeAndOrientation'

    const top = Math.log(distance) * scaler
    ctx.fillStyle = 'black'
    const w = r2s - r1e
    fillRectCtx(r1e - view.offsetPx, top + halfHeight, w, 1, ctx)

    if (type === 'insertSizeAndOrientation') {
      ctx.fillStyle = getInsertSizeAndOrientationColor(v0, v1, stats)
    } else if (type === 'orientation') {
      ctx.fillStyle = getOrientationColor(v0)
    } else if (type === 'insertSize') {
      ctx.fillStyle = getInsertSizeColor(v0, v1, stats) || 'grey'
    } else if (type === 'gradient') {
      const s = Math.min(v0.start, v1.start)
      const e = Math.max(v0.end, v1.end)
      ctx.fillStyle = `hsl(${Math.log10(Math.abs(e - s)) * 10},50%,50%)`
    }

    const w1 = Math.max(r1e - r1s, 2)
    const w2 = Math.max(r2e - r2s, 2)
    fillRectCtx(r1s - view.offsetPx, top, w1, featureHeight, ctx)
    fillRectCtx(r2s - view.offsetPx, top, w2, featureHeight, ctx)
  }
}
