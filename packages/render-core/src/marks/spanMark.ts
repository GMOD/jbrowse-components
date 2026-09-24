import { bpRangeXTuple } from '../blockClipUtils.ts'
import { bpProjection, projectBp, spanLeft } from '../canvas2dUtils.ts'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '../shaders/rowRect.js.generated.ts'
import * as shader from '../shaders/spanMark.generated.ts'
import { slangPass } from '../slangPass.ts'
import { makeAbgrFill } from './colorFill.ts'
import { HIDDEN_ROW } from './rowTable.ts'

import type { BpProjection } from '../canvas2dUtils.ts'
import type { TextureBinding } from '../hal/index.ts'
import type { RenderBlock } from '../renderBlock.ts'
import type { RowTable } from './rowTable.ts'
import type { MarkShape } from './types.ts'

/**
 * The `span` shape's channels: a coloured rectangle from `x` to `x2` on the
 * band belonging to `row`.
 */
export interface SpanChannels {
  x: Uint32Array
  x2: Uint32Array
  /** The band's slot, or its key where the params bind a `rowTable`. */
  row: Uint32Array
  /** Packed ABGR, resolved in the worker: a span has no ramp arm (ADR-113). */
  color: Uint32Array
  count: number
}

export interface SpanParams {
  /** CSS px per row. */
  rowHeight: number
  /** Fraction of the row the rect fills, leaving inter-row gaps. */
  rowProportion: number
  /**
   * Narrowest a span is painted, in CSS px. A caller whose marks tile writes
   * zero; one whose marks are sparse intervals floors them.
   */
  minWidthPx: number
  /**
   * CSS px the **painter alone** adds to each span's right edge, closing the
   * hairline two antialiased `fillRect`s leave where tiling runs meet on a
   * fractional pixel. The GPU pass needs none, and the ink excludes it.
   */
  seamPx: number
  /** Rows-area scroll offset in CSS px; 0 for a canvas sized to its content. */
  scrollTop: number
  /**
   * The table `row` is read through as a key: its drawn slot, hidden, or a
   * colour override. Absent, `row` is the slot.
   */
  rowTable?: RowTable
}

interface SpanFrame extends BpProjection {
  rowHeight: number
  scrollTop: number
  bandOffsetPx: number
  minWidthPx: number
  table: RowTable | undefined
  left: number
  top: number
  width: number
  height: number
  color: number
}

function spanFrame(block: RenderBlock, params: SpanParams): SpanFrame {
  const { rowHeight, rowProportion } = params
  const { originPx, startBp, spanBp, signedSpanPx } = bpProjection(block)
  return {
    originPx,
    startBp,
    spanBp,
    signedSpanPx,
    rowHeight,
    scrollTop: params.scrollTop,
    bandOffsetPx: rowBandOffsetPx(rowHeight, rowProportion),
    minWidthPx: params.minWidthPx,
    table: params.rowTable,
    left: 0,
    top: 0,
    width: 0,
    height: drawnRowHeightPx(rowHeight, rowProportion),
    color: 0,
  }
}

function placeSpan(c: SpanChannels, g: SpanFrame, i: number) {
  const key = c.row[i]!
  let slot = key
  let color = c.color[i]!
  const { table } = g
  if (table) {
    slot = key < table.keys ? table.slot[key]! : HIDDEN_ROW
    if (slot === HIDDEN_ROW) {
      return false
    }
    color = table.color[key]! || color
  }
  const xa = projectBp(g, c.x[i]!)
  const xb = projectBp(g, c.x2[i]!)
  const width = Math.max(g.minWidthPx, Math.abs(xb - xa))
  g.left = spanLeft(xa, xb, width)
  g.top = g.bandOffsetPx + g.rowHeight * slot - g.scrollTop
  g.width = width
  g.color = color
  return true
}

function nearest(
  textures: readonly [TextureBinding, ...TextureBinding[]],
): [TextureBinding, ...TextureBinding[]] {
  return [{ ...textures[0], filter: 'nearest' }]
}

export const spanMark: MarkShape<SpanChannels, SpanParams> = {
  id: 'span',
  pass: {
    ...slangPass({
      id: 'span',
      mod: shader,
      textures: nearest(shader.TEXTURES),
    }),
    pack: c => shader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      minCellDenomPx: clip.scissorW,
      minCellPx: params.minWidthPx,
      zero: 0,
      rowHeight: params.rowHeight,
      rowProportion: params.rowProportion,
      scrollTop: params.scrollTop,
      rowTableKeys: params.rowTable ? params.rowTable.keys : -1,
    })
  },

  texture(params) {
    return params.rowTable?.texture
  },

  paintBlock(ctx, channels, block, _frame, params) {
    const { count } = channels
    const { seamPx } = params
    const g = spanFrame(block, params)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      if (placeSpan(channels, g, i)) {
        setFill(g.color)
        ctx.fillRect(g.left, g.top, g.width + seamPx, g.height)
      }
    }
  },

  ink(channels, block, _frame, params, i) {
    const g = spanFrame(block, params)
    return placeSpan(channels, g, i)
      ? { left: g.left, top: g.top, width: g.width, height: g.height }
      : undefined
  },
}
