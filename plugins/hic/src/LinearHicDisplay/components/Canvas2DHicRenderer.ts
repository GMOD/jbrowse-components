import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { lookupColorRamp, mapHicCount } from './colorRamp.ts'

import type { HicBackend, HicRenderState } from './hicBackendTypes.ts'

const SQRT_HALF = Math.SQRT1_2

type Ctx = CanvasRenderingContext2D | SvgCanvas

export interface HicData {
  positions: Float32Array
  counts: Float32Array
  numContacts: number
}

/**
 * Pure draw entry point. Paints the hic contact-matrix diamonds into any
 * 2D-canvas-like context using inline rotation/scaling math (rather than
 * ctx.transform stack), so the same path works for on-screen rendering and
 * SVG export.
 */
export function drawHicBlocks(
  ctx: Ctx,
  data: HicData,
  colorRamp: Uint8Array,
  state: HicRenderState,
) {
  const {
    binWidth,
    yScalar,
    colorMaxScore,
    useLogScale,
    viewScale,
    viewOffsetX,
  } = state
  const { positions, counts, numContacts } = data
  if (numContacts === 0) {
    return
  }

  const s = SQRT_HALF * viewScale
  const hw = binWidth * s
  const hh = binWidth * s * yScalar

  for (let i = 0; i < numContacts; i++) {
    const px = positions[i * 2]!
    const py = positions[i * 2 + 1]!
    const count = counts[i]!

    const t = mapHicCount(count, colorMaxScore, useLogScale)
    const { r, g, b, a } = lookupColorRamp(colorRamp, t)

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

export class Canvas2DHicRenderer implements HicBackend {
  private ctx: Ctx
  private canvas: HTMLCanvasElement | null = null
  private data: HicData = {
    positions: new Float32Array(0),
    counts: new Float32Array(0),
    numContacts: 0,
  }
  private colorRamp: Uint8Array | null = null

  constructor(canvasOrCtx: HTMLCanvasElement | SvgCanvas) {
    if (canvasOrCtx instanceof SvgCanvas) {
      this.ctx = canvasOrCtx
    } else {
      this.canvas = canvasOrCtx
      this.ctx = canvasOrCtx.getContext('2d')!
    }
  }

  uploadData(data: HicData) {
    this.data = data
  }

  uploadColorRamp(colors: Uint8Array) {
    this.colorRamp = colors
  }

  render(state: HicRenderState) {
    if (this.canvas) {
      prepareCanvas(
        this.canvas,
        this.ctx as CanvasRenderingContext2D,
        state.canvasWidth,
        state.canvasHeight,
      )
    }
    if (!this.colorRamp) {
      return
    }
    drawHicBlocks(this.ctx, this.data, this.colorRamp, state)
  }

  dispose() {
    this.data = {
      positions: new Float32Array(0),
      counts: new Float32Array(0),
      numContacts: 0,
    }
    this.colorRamp = null
  }
}
