import { getContainingView } from '@jbrowse/core/util'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
// locals
import {
  getOrientationColor,
  getInsertSizeColor,
  getInsertSizeAndOrientationColor,
} from '../shared/color'
import { PairData } from '../shared/fetchPairs'

type LGV = LinearGenomeViewModel

const height = 1200

export default async function drawFeats(self: {
  setLastDrawnOffsetPx: (n: number) => void
  setError: (e: unknown) => void
  colorBy?: { type: string }
  pairedData?: PairData
  ref: HTMLCanvasElement | null
}) {
  try {
    const { pairedData, ref } = self
    if (!pairedData) {
      return
    }
    const view = getContainingView(self) as LGV
    const canvas = ref
    if (!canvas) {
      return
    }
    const width = canvas.getBoundingClientRect().width
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    self.setLastDrawnOffsetPx(view.offsetPx)
    ctx.clearRect(0, 0, width, height)
    ctx.resetTransform()
    ctx.scale(2, 2)
    const { pairedFeatures, stats } = pairedData
    Object.values(pairedFeatures)
      .filter(val => val.length === 2)
      .forEach(val => {
        const [v0, v1] = val
        const s = Math.min(v0.start, v1.start)
        const e = Math.max(v0.end, v1.end)
        const r1 = view.bpToPx({ refName: v0.refName, coord: s })
        const r2 = view.bpToPx({ refName: v0.refName, coord: e })

        if (!r1 || !r2) {
          return
        }
        const radius = (r2.offsetPx - r1.offsetPx) / 2
        const absrad = Math.abs(radius)
        const p = r1.offsetPx - view.offsetPx
        ctx.moveTo(p, 0)
        ctx.beginPath()
        const type = self.colorBy?.type || 'insertSizeAndOrientation'

        if (type === 'insertSizeAndOrientation') {
          ctx.strokeStyle = getInsertSizeAndOrientationColor(v0, v1, stats)
        } else if (type === 'orientation') {
          ctx.strokeStyle = getOrientationColor(v0)
        } else if (type === 'insertSize') {
          ctx.strokeStyle = getInsertSizeColor(v0, v1, stats) || 'grey'
        } else if (type === 'gradient') {
          ctx.strokeStyle = `hsl(${Math.log10(Math.abs(e - s)) * 10},50%,50%)`
        }

        ctx.arc(p + radius, 0, absrad, 0, Math.PI)
        ctx.stroke()
      })
  } catch (e) {
    console.error(e)
    self.setError(e)
  }
}
