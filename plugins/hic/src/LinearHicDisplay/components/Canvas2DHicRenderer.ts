import { prepareCanvas } from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DGlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'

import { makeHicFillStyleLut } from './colorRamp.ts'
import { mapHicCount } from './shaders/hic.js.generated.ts'

import type {
  HicDrawState,
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
 *
 * Call order is load-bearing and matches hic.slang: the rotation applies to the
 * bin first, the `yScalar` squash to the already-rotated triangle. `SvgCanvas`
 * composes its CTM the same way, so `viewScale !== viewScale * yScalar` (any
 * fit-to-height export) lands on the diagonal — see svgExportGeometry.test.ts.
 *
 * `width` is the width of the surface being painted, used only to cull. It's an
 * explicit argument rather than a field on `HicDrawState` because the two
 * callers paint different surfaces: the live renderer its canvas, the SVG export
 * a layer of its own size.
 */
export function drawHicBlocks(
  ctx: Ctx2D,
  data: HicUploadData,
  fillStyleLut: (t: number) => string | undefined,
  state: HicDrawState,
  width: number,
) {
  const { yScalar, colorMaxScore, useLogScale, viewScale, viewOffsetX } = state
  const { positions, counts, numContacts, binWidth } = data
  if (numContacts === 0) {
    return
  }

  // Cull in pre-rotation data space, where the visible strip is a plain range on
  // one axis: a cell's screen x is `((px+py)/√2)*viewScale + viewOffsetX`, so
  // `px+py` alone decides whether it lands on the surface. The GPU path lets the
  // rasterizer discard these, but Canvas2D pays a full fillRect for every one —
  // and at the auto binsize a full-width triangle is ~300k contacts, several
  // times that once the user steps the resolution finer. Panning keeps the
  // fetched matrix and redraws it shifted (see renderTransform), so off-surface
  // contacts are the normal case, not an edge one.
  //
  // `positions` holds the cell's apex-ward corner, and the opposite corner
  // `(px+w, py+w)` sits `2*binWidth` further along the sum axis — so a cell
  // straddling the left edge has a min corner that far outside it. Padding by
  // exactly that keeps every partially-visible bin (the right edge needs no pad,
  // but symmetry is cheaper to keep honest than an asymmetric bound).
  //
  // Height is deliberately not culled: the triangle apex and `yScalar` already
  // bound it, and a second test per cell would eat the win.
  const pad = 2 * binWidth
  const minSum = (-viewOffsetX / viewScale) * Math.SQRT2 - pad
  const maxSum = ((width - viewOffsetX) / viewScale) * Math.SQRT2 + pad

  ctx.save()
  ctx.translate(viewOffsetX, 0)
  ctx.scale(viewScale, viewScale * yScalar)
  ctx.rotate(-Math.PI / 4)

  for (let i = 0; i < numContacts; i++) {
    const px = positions[i * 2]!
    const py = positions[i * 2 + 1]!
    const sum = px + py
    if (sum < minSum || sum > maxSum) {
      continue
    }
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
    drawHicBlocks(this.ctx, data, this.fillStyleLut, state, state.canvasWidth)
  }
}
