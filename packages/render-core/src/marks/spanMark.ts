import { bpRangeXTuple } from '../blockClipUtils.ts'
import { makeBpMapper, spanLeft } from '../canvas2dUtils.ts'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '../shaders/rowRect.js.generated.ts'
import * as shader from '../shaders/spanMark.generated.ts'
import { slangPass } from '../slangPass.ts'
import { makeAbgrFill } from './colorFill.ts'
import { inkOnRect, nearestInk } from './markHit.ts'

import type { MarkShape } from './types.ts'

/**
 * The `span` shape's channels: a coloured rectangle from `x` to `x2` on the
 * band belonging to `row`.
 */
export interface SpanChannels {
  x: Uint32Array
  x2: Uint32Array
  row: Uint32Array
  color: Uint32Array
  count: number
}

export interface SpanParams {
  /** CSS px per row. */
  rowHeight: number
  /** Fraction of the row the rect fills, leaving inter-row gaps. */
  rowProportion: number
  /**
   * Narrowest a span is painted, in CSS px. Zero is a no-op and is what a
   * caller whose marks TILE writes — widening a sub-pixel cell inside a run
   * paints ink the data does not contain. A caller whose marks are sparse
   * intervals floors, because at chromosome zoom the alternative is a smudge.
   */
  minWidthPx: number
  /**
   * CSS px of overlap added to each span's right edge by the **painter only**.
   *
   * The GPU pass needs none: abutting quads share an exact clip-space edge and
   * the rasterizer fills it once. Canvas2D antialiases each `fillRect`
   * independently, so two runs meeting on a fractional pixel each take partial
   * coverage of it and a hairline of background shows through. Which callers
   * want it splits on the same axis `minWidthPx` does — MAF's cells tile, so it
   * pads; the multi-row painter's features are sparse intervals with background
   * between them by right, so it writes 0.
   *
   * Padding the drawn width and not the anchor is what keeps it growing
   * rightward on both orientations, so a reversed block's spans stay exact
   * mirrors of a forward block's. Wiggle's `WIGGLE_FUDGE_FACTOR` is the same
   * rule spelled per display; the shader must not grow a matching pad.
   */
  seamPx: number
  /** Rows-area scroll offset in CSS px; 0 for a canvas sized to its content. */
  scrollTop: number
}

export const spanMark: MarkShape<SpanChannels, SpanParams> = {
  id: 'span',
  pass: {
    ...slangPass({ id: 'span', mod: shader }),
    pack: c => shader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      // CSS px, not physical: `extendToMinWidthX` divides `minCellPx` by this
      // to reach clip space, so a CSS width is what makes the floor a CSS-pixel
      // one and matches the painter's `Math.max` below.
      minCellDenomPx: clip.scissorW,
      minCellPx: params.minWidthPx,
      zero: 0,
      rowHeight: params.rowHeight,
      rowProportion: params.rowProportion,
      scrollTop: params.scrollTop,
    })
  },

  paintBlock(ctx, channels, block, _frame, params) {
    const { x, x2, row, color, count } = channels
    const { rowHeight, rowProportion, minWidthPx, seamPx, scrollTop } = params
    const h = drawnRowHeightPx(rowHeight, rowProportion)
    const offset = rowBandOffsetPx(rowHeight, rowProportion)
    const bpToPx = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const xa = bpToPx(x[i]!)
      const xb = bpToPx(x2[i]!)
      const width = Math.max(minWidthPx, Math.abs(xb - xa))
      setFill(color[i]!)
      ctx.fillRect(
        spanLeft(xa, xb, width),
        offset + rowHeight * row[i]! - scrollTop,
        width + seamPx,
        h,
      )
    }
  },

  hitNearest(channels, block, _frame, params, xPx, yPx, candidates, maxDistSq) {
    const { x, x2, row } = channels
    const { rowHeight, rowProportion, minWidthPx, scrollTop } = params
    const h = drawnRowHeightPx(rowHeight, rowProportion)
    const offset = rowBandOffsetPx(rowHeight, rowProportion)
    const bpToPx = makeBpMapper(block)
    return nearestInk(candidates, maxDistSq, i => {
      const xa = bpToPx(x[i]!)
      const xb = bpToPx(x2[i]!)
      const width = Math.max(minWidthPx, Math.abs(xb - xa))
      // the rect `paintBlock` fills, less `seamPx`, which is painter-only
      // overdraw
      return inkOnRect(
        xPx,
        yPx,
        spanLeft(xa, xb, width),
        offset + rowHeight * row[i]! - scrollTop,
        width,
        h,
      )
    })
  },
}
