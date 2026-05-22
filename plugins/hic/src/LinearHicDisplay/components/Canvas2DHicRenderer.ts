import {
  makeRampFillStyleLut,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { Canvas2DMonolithicBackend } from '@jbrowse/core/gpu/monolithicBackend'

import { lookupColorRamp, mapHicCount } from './colorRamp.ts'

import type {
  HicBackend,
  HicRenderState,
  HicUploadData,
} from './hicBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Pure draw entry point. Paints the hic contact-matrix as axis-aligned
 * fillRects in pre-rotation space, then rotates the whole layer by -45° via
 * ctx.transform stack. Adjacent rects share grid-aligned edges and tile
 * seamlessly — the path-based diamond approach left thin AA seams between
 * neighboring bins.
 */
export function drawHicBlocks(
  ctx: Ctx2D,
  data: HicUploadData,
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

export class Canvas2DHicRenderer
  extends Canvas2DMonolithicBackend<HicUploadData, HicRenderState>
  implements HicBackend
{
  private colorRamp: Uint8Array | null = null

  uploadColorRamp(colors: Uint8Array) {
    this.colorRamp = colors
  }

  render(data: HicUploadData | null, state: HicRenderState) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    if (!data || !this.colorRamp) {
      return
    }
    drawHicBlocks(this.ctx, data, this.colorRamp, state)
  }
}
