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
    ctx.setTransform(2, 0, 0, 2, -view.offsetPx * 2, 0)
    const { pairedFeatures, stats } = pairedData
    Object.values(pairedFeatures)
      .filter(val => val.length === 2)
      .forEach(val => {
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

        if (!r1s || !r1e || !r2s || !r2e) {
          return
        }
        const radius = (r2e - r1s) / 2
        const absrad = Math.abs(radius)
        const type = self.colorBy?.type || 'insertSizeAndOrientation'

        const top = Math.log(absrad) * 10
        ctx.fillStyle = 'black'
        ctx.fillRect(r1e, top + 5, r2s - r1e, 1)

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

        ctx.fillRect(r1s, top, r1e - r1s, 10)
        ctx.fillRect(r2s, top, r2e - r2s, 10)
      })
  } catch (e) {
    console.error(e)
    self.setError(e)
  }
}
