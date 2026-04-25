import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { lookupColorRamp, mapHicCount } from './colorRamp.ts'

import type { HicBackend, HicRenderState } from './hicBackendTypes.ts'

const SQRT_HALF = Math.SQRT1_2

export class Canvas2DHicRenderer implements HicBackend {
  private ctx: CanvasRenderingContext2D | SvgCanvas
  private canvas: HTMLCanvasElement | null = null
  private positions: Float32Array | null = null
  private counts: Float32Array | null = null
  private numContacts = 0
  private colorRamp: Uint8Array | null = null

  constructor(canvasOrCtx: HTMLCanvasElement | SvgCanvas) {
    if (canvasOrCtx instanceof SvgCanvas) {
      this.ctx = canvasOrCtx
    } else {
      this.canvas = canvasOrCtx
      this.ctx = canvasOrCtx.getContext('2d')!
    }
  }

  uploadData(data: {
    positions: Float32Array
    counts: Float32Array
    numContacts: number
  }) {
    this.positions = data.positions
    this.counts = data.counts
    this.numContacts = data.numContacts
  }

  uploadColorRamp(colors: Uint8Array) {
    this.colorRamp = colors
  }

  render(state: HicRenderState) {
    const {
      canvasWidth,
      canvasHeight,
      binWidth,
      yScalar,
      maxScore,
      useLogScale,
      viewScale,
      viewOffsetX,
    } = state

    const ctx = this.ctx
    if (this.canvas) {
      prepareCanvas(
        this.canvas,
        ctx as CanvasRenderingContext2D,
        canvasWidth,
        canvasHeight,
      )
    }

    if (
      this.numContacts === 0 ||
      !this.positions ||
      !this.counts ||
      !this.colorRamp
    ) {
      return
    }

    const s = SQRT_HALF * viewScale
    const hw = binWidth * s
    const hh = binWidth * s * yScalar

    for (let i = 0; i < this.numContacts; i++) {
      const px = this.positions[i * 2]!
      const py = this.positions[i * 2 + 1]!
      const count = this.counts[i]!

      const t = mapHicCount(count, maxScore, useLogScale)
      const { r, g, b, a } = lookupColorRamp(this.colorRamp, t)

      if (a < 0.01) {
        continue
      }

      // Rotate square corners by -45° and apply viewport transform inline.
      // The four corners of the square [px,py]→[px+bw,py+bw] map to a diamond:
      //   top=(base,rBase), right, bottom, left — rotated 45° in screen space.
      const base = (px + py) * s + viewOffsetX
      const rBase = (-px + py) * s * yScalar

      ctx.beginPath()
      ctx.moveTo(base, rBase)
      ctx.lineTo(base + hw, rBase - hh)
      ctx.lineTo(base + 2 * hw, rBase)
      ctx.lineTo(base + hw, rBase + hh)
      ctx.closePath()
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`
      ctx.fill()
    }
  }

  dispose() {
    this.positions = null
    this.counts = null
    this.colorRamp = null
  }
}
