import { bpRangeXTuple } from '../blockClipUtils.ts'
import { bpProjection, projectBp, spanLeft } from '../canvas2dUtils.ts'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '../shaders/rowRect.js.generated.ts'
import * as shader from '../shaders/spanMark.generated.ts'
import { slangPass } from '../slangPass.ts'
import { makeAbgrFill } from './colorFill.ts'
import { colorBits, paintColors, rampUniforms } from './markRamp.ts'
import { rowColor, rowSlot, rowTableKeys, rowTableTextures } from './rowLane.ts'

import type { BpProjection } from '../canvas2dUtils.ts'
import type { RenderBlock } from '../renderBlock.ts'
import type { ColorChannel } from './markRamp.ts'
import type { RowTable } from './rowTable.ts'
import type { MarkColorScale, MarkShape } from './types.ts'

/**
 * The `span` shape's channels: a coloured rectangle from `x` to `x2` on the
 * band belonging to `row`, its colour packed or, under a colour scale, the
 * value it resolves from.
 */
export interface SpanChannels extends ColorChannel {
  x: Uint32Array
  x2: Uint32Array
  /** The band's slot, or its key where the params bind a `rowTable`. */
  row: Uint32Array
  count: number
}

export interface SpanParams {
  /** The quantitative colour scale, for a span whose colour is a ramp or a threshold. */
  colorScale?: MarkColorScale
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
  }
}

function placeSpan(c: SpanChannels, g: SpanFrame, i: number) {
  const slot = rowSlot(c.row, i, g.table)
  if (slot === undefined) {
    return false
  }
  const xa = projectBp(g, c.x[i]!)
  const xb = projectBp(g, c.x2[i]!)
  const width = Math.max(g.minWidthPx, Math.abs(xb - xa))
  g.left = spanLeft(xa, xb, width)
  g.top = g.bandOffsetPx + g.rowHeight * slot - g.scrollTop
  g.width = width
  return true
}

export const spanMark: MarkShape<SpanChannels, SpanParams> = {
  id: 'span',
  pass: {
    ...slangPass({ id: 'span', mod: shader }),
    pack: c =>
      shader.packInstances({ ...c, color: colorBits(c, c.count) }, c.count),
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
      rowTableKeys: rowTableKeys(params),
      ...rampUniforms(params.colorScale),
    })
  },

  textures: rowTableTextures,

  paintBlock(ctx, channels, block, _frame, params) {
    const { count, row } = channels
    const { seamPx } = params
    const color = paintColors(channels, count, params.colorScale)
    const g = spanFrame(block, params)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      if (placeSpan(channels, g, i)) {
        setFill(rowColor(color[i]!, row, i, g.table))
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
