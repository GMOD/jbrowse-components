import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { getDpr, makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { makeAbgrFill } from '@jbrowse/render-core/marks/colorFill'
import { inkOnRect, nearestInk } from '@jbrowse/render-core/marks/hit'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/variant.generated.ts'
import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'
import { snapVariantCellX } from './snapVariantCellX.ts'
import { drawVariantShape } from './variantShape.ts'

import type { MarkShape } from '@jbrowse/render-core/marks'
import type { InkHit } from '@jbrowse/render-core/marks/hit'

/**
 * The `cell` shape's channels: a glyph from `startEnd[2i]` to `startEnd[2i+1]`
 * on row `rowIndex`, painted as `shapeType` (`variantShape.ts`) in `color`.
 */
export interface CellChannels {
  startEnd: Uint32Array
  rowIndex: Uint32Array
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
 * (`snapVariantCellX`, `drawnCellHeightPx`) are what the hit test and the
 * hover highlight read too, so the shape stays beside them.
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
    const { startEnd, rowIndex, shapeType, color, count } = channels
    const { canvasWidth, canvasHeight } = frame
    const { rowHeight, scrollTop } = params
    const h = drawnCellHeightPx(rowHeight)
    const toX = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const y = rowIndex[i]! * rowHeight - scrollTop
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

  // An inversion's triangle answers as its bounding box, the same box the
  // display's picker measured before this existed.
  //
  // The off-canvas test is `paintBlock`'s, spelled the same way: a row the
  // viewport has scrolled past is ink nobody drew, so it must not be the nearest
  // thing to a cursor either. It also costs the walk nothing — a culled instance
  // skips both bp lookups and the snap.
  hitNearest(channels, block, frame, params, xPx, yPx, candidates, maxDistSq) {
    const { startEnd, rowIndex } = channels
    const { canvasWidth, canvasHeight } = frame
    const { rowHeight, scrollTop } = params
    const h = drawnCellHeightPx(rowHeight)
    const toX = makeBpMapper(block)
    return nearestInk(candidates, maxDistSq, i => {
      const y = rowIndex[i]! * rowHeight - scrollTop
      let ink: InkHit | undefined
      if (y + h >= 0 && y <= canvasHeight) {
        const { x, width } = snapVariantCellX(
          toX(startEnd[i * 2]!),
          toX(startEnd[i * 2 + 1]!),
          canvasWidth,
        )
        ink = inkOnRect(xPx, yPx, x, y, width, h)
      }
      return ink
    })
  },
}
