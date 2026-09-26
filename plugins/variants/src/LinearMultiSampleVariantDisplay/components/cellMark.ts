import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import {
  bpProjection,
  getDpr,
  projectBp,
} from '@jbrowse/render-core/canvas2dUtils'
import { makeAbgrFill } from '@jbrowse/render-core/marks/colorFill'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/variant.generated.ts'
import {
  drawnCellHeightPx,
  snappedCellLeftPx,
  snappedCellWidthPx,
} from './shaders/variant.js.generated.ts'
import { drawVariantShape } from './variantShape.ts'

import type { BpProjection } from '@jbrowse/render-core/canvas2dUtils'
import type { MarkFrame, MarkShape } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * The `cell` shape's channels: a glyph from `startEnd[2i]` to `startEnd[2i+1]`
 * on `row`, painted as `shapeType` (`variantShape.ts`) in `color`.
 */
export interface CellChannels {
  startEnd: Uint32Array
  row: Uint32Array
  shapeType: Uint8Array
  color: Uint32Array
  count: number
}

export interface CellParams {
  /** CSS px per row; the painted height floors at 2 (`drawnCellHeightPx`). */
  rowHeight: number
  /** Rows-area scroll offset in CSS px. */
  scrollTop: number
}

interface CellFrame extends BpProjection {
  canvasHeight: number
  rowHeight: number
  scrollTop: number
  height: number
  left: number
  top: number
  width: number
}

function cellFrame(
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
): CellFrame {
  const { originPx, startBp, spanBp, signedSpanPx } = bpProjection(block)
  return {
    originPx,
    startBp,
    spanBp,
    signedSpanPx,
    canvasHeight: frame.canvasHeight,
    rowHeight: params.rowHeight,
    scrollTop: params.scrollTop,
    height: drawnCellHeightPx(params.rowHeight),
    left: 0,
    top: 0,
    width: 0,
  }
}

function placeCellY(c: CellChannels, g: CellFrame, i: number) {
  const top = c.row[i]! * g.rowHeight - g.scrollTop
  if (!(top + g.height >= 0 && top <= g.canvasHeight)) {
    return false
  }
  g.top = top
  return true
}

function placeCellX(c: CellChannels, g: CellFrame, i: number) {
  const x1 = projectBp(g, c.startEnd[i * 2]!)
  const x2 = projectBp(g, c.startEnd[i * 2 + 1]!)
  const width = snappedCellWidthPx(x1, x2)
  g.left = snappedCellLeftPx(x1, x2, width)
  g.width = width
}

/**
 * A pixel-snapped matrix cell on the pixel grid `variant.slang`
 * owns, its x through the shader's generated twins. An inversion's triangle
 * inks its bounding box.
 */
export const cellMark: MarkShape<CellChannels, CellParams> = {
  id: 'cell',
  pass: {
    ...slangPass({ id: 'cell', mod: shader }),
    pack: c => shader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      viewportWidth: clip.scissorW,
      rowHeight: params.rowHeight,
      scrollTop: params.scrollTop,
      zero: 0,
      devicePixelRatio: getDpr(),
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { shapeType, color, count } = channels
    // `cellFrame` spelled out: TurboFan scalar-replaces a frame this function
    // allocates, and reloads a returned frame's fields on every instance.
    const { originPx, startBp, spanBp, signedSpanPx } = bpProjection(block)
    const g: CellFrame = {
      originPx,
      startBp,
      spanBp,
      signedSpanPx,
      canvasHeight: frame.canvasHeight,
      rowHeight: params.rowHeight,
      scrollTop: params.scrollTop,
      height: drawnCellHeightPx(params.rowHeight),
      left: 0,
      top: 0,
      width: 0,
    }
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      if (placeCellY(channels, g, i)) {
        placeCellX(channels, g, i)
        setFill(color[i]!)
        drawVariantShape(ctx, shapeType[i]!, g.left, g.top, g.width, g.height)
      }
    }
  },

  ink(channels, block, frame, params, i) {
    const g = cellFrame(block, frame, params)
    if (!placeCellY(channels, g, i)) {
      return undefined
    }
    placeCellX(channels, g, i)
    return { left: g.left, top: g.top, width: g.width, height: g.height }
  },
}
