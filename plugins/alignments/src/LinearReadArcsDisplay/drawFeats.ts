import { getContainingView } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import {
  getOrientationColor,
  getInsertSizeColor,
  getInsertSizeAndOrientationColor,
} from '../shared/color'
import { ChainData } from '../shared/fetchChains'

export function hasPairedReads(features: ChainData) {
  for (const f of features.chains.values()) {
    if (f[0].flags & 1) {
      return true
    }
  }
  return false
}

type LGV = LinearGenomeViewModel

export default async function drawFeats(
  self: {
    setLastDrawnOffsetPx: (n: number) => void
    setError: (e: unknown) => void
    colorBy?: { type: string }
    height: number
    chainData?: ChainData
  },
  ctx: CanvasRenderingContext2D,
) {
  const { chainData } = self
  if (!chainData) {
    return
  }
  const displayHeight = self.height
  const view = getContainingView(self) as LGV
  self.setLastDrawnOffsetPx(view.offsetPx)

  const { chains, stats } = chainData
  const hasPaired = hasPairedReads(chainData)
  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i]
    if (!hasPaired) {
      chain.sort((a, b) => a.clipPos - b.clipPos)
    }

    for (let i = 0; i < chain.length - 1; i++) {
      const v0 = chain[i]
      const v1 = chain[i + 1]
      const f1 = v0.strand === -1
      const f2 = v1.strand === -1
      const p1 = f1 ? v0.start : v0.end
      const p2 = hasPaired ? (f2 ? v1.start : v1.end) : f2 ? v1.end : v1.start

      const r1 = view.bpToPx({ refName: v0.refName, coord: p1 })
      const r2 = view.bpToPx({ refName: v0.refName, coord: p2 })

      if (!r1 || !r2) {
        continue
      }
      const radius = (r2.offsetPx - r1.offsetPx) / 2
      const absrad = Math.abs(radius)
      const p = r1.offsetPx - view.offsetPx
      ctx.beginPath()
      ctx.moveTo(p, 0)
      const type = self.colorBy?.type || 'insertSizeAndOrientation'

      if (type === 'insertSizeAndOrientation') {
        ctx.strokeStyle = getInsertSizeAndOrientationColor(v0, v1, stats)
      } else if (type === 'orientation') {
        ctx.strokeStyle = getOrientationColor(v0)
      } else if (type === 'insertSize') {
        ctx.strokeStyle = getInsertSizeColor(v0, v1, stats) || 'grey'
      } else if (type === 'gradient') {
        const s = Math.min(v0.start, v1.start)
        const e = Math.max(v0.end, v1.end)
        ctx.strokeStyle = `hsl(${Math.log10(Math.abs(e - s)) * 10},50%,50%)`
      }

      const destX = p + radius * 2
      const destY = Math.min(displayHeight, absrad)
      ctx.bezierCurveTo(p, destY, destX, destY, destX, 0)
      ctx.stroke()
    }
  }
}
