import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { getDpr, makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { blockPx } from '@jbrowse/render-core/marks'
import { makeAbgrFill } from '@jbrowse/render-core/marks/colorFill'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/variant.generated.ts'
import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'
import { snapVariantCellX } from './snapVariantCellX.ts'
import { drawVariantShape } from './variantShape.ts'

import type { MarkShape } from '@jbrowse/render-core/marks'

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

/**
 * A pixel-snapped matrix cell: `span` plus a glyph lane, on the half-canvas
 * snap grid `variant.slang` owns with its 2 px floors. This display's own
 * shape rather than render-core's — the shader's generated twins
 * (`snapVariantCellX`, `drawnCellHeightPx`) are what its ink reads, so the
 * shape stays beside them.
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
      // The FULL width anchors the snap grid the painter and the hit test snap
      // against; the clipped block's span is what clip-space x covers.
      canvasWidth: frame.canvasWidth,
      viewportWidth: clip.scissorW,
      rowHeight: params.rowHeight,
      scrollTop: params.scrollTop,
      zero: 0,
      devicePixelRatio: getDpr(),
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { startEnd, row, shapeType, color, count } = channels
    const { canvasWidth, canvasHeight } = frame
    const { rowHeight, scrollTop } = params
    const h = drawnCellHeightPx(rowHeight)
    const toX = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const y = row[i]! * rowHeight - scrollTop
      if (y + h >= 0 && y <= canvasHeight) {
        const { x, width } = snapVariantCellX(
          toX(startEnd[i * 2]!),
          toX(startEnd[i * 2 + 1]!),
          canvasWidth,
        )
        setFill(color[i]!)
        drawVariantShape(ctx, shapeType[i]!, x, y, width, h)
      }
    }
  },

  // An inversion's triangle is its bounding box, the same box the display's
  // picker measured before this existed. The off-canvas test is
  // `paintBlock`'s: a row the viewport has scrolled past is ink nobody drew.
  ink(channels, block, frame, params, i) {
    const { startEnd, row } = channels
    const { canvasWidth, canvasHeight } = frame
    const { rowHeight, scrollTop } = params
    const height = drawnCellHeightPx(rowHeight)
    const top = row[i]! * rowHeight - scrollTop
    if (top + height < 0 || top > canvasHeight) {
      return undefined
    }
    const { x, width } = snapVariantCellX(
      blockPx(block, startEnd[i * 2]!),
      blockPx(block, startEnd[i * 2 + 1]!),
      canvasWidth,
    )
    return { left: x, top, width, height }
  },
}
