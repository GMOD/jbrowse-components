import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession, max } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import {
  getOrientationColor,
  getInsertSizeColor,
  getInsertSizeAndOrientationColor,
} from '../shared/color'
import { ReducedFeature } from '../shared/fetchChains'
import { LinearReadCloudDisplayModel } from './model'

type LGV = LinearGenomeViewModel

interface ChainCoord {
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

export default function drawFeats(
  self: LinearReadCloudDisplayModel,
  ctx: CanvasRenderingContext2D,
) {
  const { chainData } = self
  if (!chainData) {
    return
  }
  const { assemblyManager } = getSession(self)
  const featureHeight = getConf(self, 'featureHeight')
  const displayHeight = self.height
  const view = getContainingView(self) as LGV
  const assemblyName = view.assemblyNames[0]
  const asm = assemblyManager.get(assemblyName)
  if (!asm) {
    return
  }

  const { chains, stats } = chainData
  const coords: ChainCoord[] = []
  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i]
    // if we're looking at a paired read (flag 1) then assume it is just two
    // reads (some small cases may defy this assumption such as secondary
    // alignments but this may be uncommon)
    if (chain[0].flags & 1 && chain.length > 1) {
      const v0 = chain[0]
      const v1 = chain[1]
      const ra1 = asm.getCanonicalRefName(v0.refName) || v0.refName
      const ra2 = asm.getCanonicalRefName(v1.refName) || v1.refName
      const r1s = view.bpToPx({ refName: ra1, coord: v0.start })
      const r1e = view.bpToPx({ refName: ra1, coord: v0.end })
      const r2s = view.bpToPx({ refName: ra2, coord: v1.start })
      const r2e = view.bpToPx({ refName: ra2, coord: v1.end })

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
          r1s: r1s.offsetPx,
          r1e: r1e.offsetPx,
          r2s: r2s.offsetPx,
          r2e: r2e.offsetPx,
          v0,
          v1,
          distance,
        })
      }
    } else {
      // if we're not looking at pairs, then it could be a multiply-split-long
      // read, so traverse chain
      for (let i = 1; i < chain.length; i++) {
        const v0 = chain[i - 1]
        const v1 = chain[i]
        const ra1 = asm.getCanonicalRefName(v0.refName) || v0.refName
        const ra2 = asm.getCanonicalRefName(v1.refName) || v1.refName
        const r1s = view.bpToPx({ refName: ra1, coord: v0.start })
        const r1e = view.bpToPx({ refName: ra1, coord: v0.end })
        const r2s = view.bpToPx({ refName: ra2, coord: v1.start })
        const r2e = view.bpToPx({ refName: ra2, coord: v1.end })

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
            r1s: r1s.offsetPx,
            r1e: r1e.offsetPx,
            r2s: r2s.offsetPx,
            r2e: r2e.offsetPx,
            v0,
            v1,
            distance,
          })
        }
      }
    }
  }

  const halfHeight = featureHeight / 2 - 0.5
  const scaler =
    (displayHeight - 20) / Math.log(max(coords.map(c => c.distance)))

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
