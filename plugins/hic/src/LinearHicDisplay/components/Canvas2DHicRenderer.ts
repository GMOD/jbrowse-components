import {
  makeRampFillStyleLut,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { lookupColorRamp, mapHicCount } from './colorRamp.ts'

import type { HicBackend, HicRenderState } from './hicBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export interface HicData {
  positions: Float32Array
  counts: Float32Array
  numContacts: number
}

/**
 * Pure draw entry point. Paints the hic contact-matrix as axis-aligned
 * fillRects in pre-rotation space, then rotates the whole layer by -45° via
 * ctx.transform stack. Adjacent rects share grid-aligned edges and tile
 * seamlessly — the path-based diamond approach left thin AA seams between
 * neighboring bins.
 */
export function drawHicBlocks(
  ctx: Ctx2D,
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

  const fillStyleLut = makeRampFillStyleLut(colorRamp)

  ctx.save()
  ctx.translate(viewOffsetX, 0)
  ctx.scale(viewScale, viewScale * yScalar)
  ctx.rotate(-Math.PI / 4)

  for (let i = 0; i < numContacts; i++) {
    const px = positions[i * 2]!
    const py = positions[i * 2 + 1]!
    const count = counts[i]!

    const t = mapHicCount(count, colorMaxScore, useLogScale)
    const { a } = lookupColorRamp(colorRamp, t)
    if (a < 0.01) {
      continue
    }

    ctx.fillStyle = fillStyleLut(t)
    ctx.fillRect(px, py, binWidth, binWidth)
  }

  ctx.restore()
}

export class Canvas2DHicRenderer implements HicBackend {
  private ctx: Ctx2D
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
