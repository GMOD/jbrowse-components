import { prepareCanvas } from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DGlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'

import { makeHicFillStyleLut, mapHicCount } from './colorRamp.ts'

import type {
  HicRenderState,
  HicRenderingBackend,
  HicUploadData,
} from './hicRenderingBackendTypes.ts'
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
  fillStyleLut: (t: number) => string | undefined,
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

  ctx.save()
  ctx.translate(viewOffsetX, 0)
  ctx.scale(viewScale, viewScale * yScalar)
  ctx.rotate(-Math.PI / 4)

  for (let i = 0; i < numContacts; i++) {
    const px = positions[i * 2]!
    const py = positions[i * 2 + 1]!
    const count = counts[i]!

    const t = mapHicCount(count, colorMaxScore, useLogScale)
    const fill = fillStyleLut(t)
    if (fill === undefined) {
      continue
    }

    ctx.fillStyle = fill
    ctx.fillRect(px, py, binWidth, binWidth)
  }

  ctx.restore()
}

export class Canvas2DHicRenderer
  extends Canvas2DGlobalRenderingBackend<HicUploadData, HicRenderState>
  implements HicRenderingBackend
{
  private fillStyleLut: ((t: number) => string | undefined) | null = null

  uploadColorRamp(colors: Uint8Array) {
    this.fillStyleLut = makeHicFillStyleLut(colors)
  }

  render(data: HicUploadData | null, state: HicRenderState) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    if (!data || !this.fillStyleLut) {
      return
    }
    drawHicBlocks(this.ctx, data, this.fillStyleLut, state)
  }
}
