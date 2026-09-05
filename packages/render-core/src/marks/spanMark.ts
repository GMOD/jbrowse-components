import { bpRangeXTuple } from '../blockClipUtils.ts'
import { makeBpMapper, spanLeft } from '../canvas2dUtils.ts'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '../shaders/rowRect.js.generated.ts'
import * as shader from '../shaders/spanMark.generated.ts'
import { slangPass } from '../slangPass.ts'
import { makeAbgrFill } from './colorFill.ts'

import type { MarkHit, MarkShape } from './types.ts'

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
  /** Rows-area scroll offset in CSS px; 0 for a canvas sized to its content. */
  scrollTop: number
}

export const spanMark: MarkShape<SpanChannels, SpanParams> = {
  id: 'span',
  uniformByteSize: shader.UNIFORMS_SIZE_BYTES,
  pass: {
    ...slangPass({ id: 'span', mod: shader }),
    pack: c =>
      shader.packInstances(
        { startBp: c.x, endBp: c.x2, rowIndex: c.row, color: c.color },
        c.count,
      ),
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
    const { rowHeight, rowProportion, minWidthPx, scrollTop } = params
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
        width,
        h,
      )
    }
  },

  hitNearest(channels, block, _frame, params, xPx, yPx, candidates, maxDistSq) {
    const { x, x2, row, count } = channels
    const { rowHeight, rowProportion, minWidthPx, scrollTop } = params
    const h = drawnRowHeightPx(rowHeight, rowProportion)
    const offset = rowBandOffsetPx(rowHeight, rowProportion)
    const bpToPx = makeBpMapper(block)
    let best: MarkHit | undefined
    let bestDistSq = maxDistSq
    for (const i of candidates) {
      if (i >= count) {
        continue
      }
      const xa = bpToPx(x[i]!)
      const xb = bpToPx(x2[i]!)
      const width = Math.max(minWidthPx, Math.abs(xb - xa))
      const left = spanLeft(xa, xb, width)
      const top = offset + rowHeight * row[i]! - scrollTop
      const px = Math.max(left, Math.min(xPx, left + width))
      const py = Math.max(top, Math.min(yPx, top + h))
      const dx = xPx - px
      const dy = yPx - py
      const distSq = dx * dx + dy * dy
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        best = { index: i, x: px, y: py, distSq }
      }
    }
    return best
  },
}
