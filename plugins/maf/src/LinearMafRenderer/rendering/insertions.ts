import {
  MIN_HEIGHT_FOR_TEXT,
  MIN_PX_PER_BP_FOR_TEXT,
  drawInsertionMarker,
  getInsertionType,
} from '@jbrowse/alignments-core'

import { CHAR_SIZE_WIDTH, LABEL_FONT } from './types.ts'

import type { InsertionMarker } from '../../LinearMafDisplay/components/computeVisibleInsertions.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function insertionDrawsLabel(marker: InsertionMarker, pxPerBp: number) {
  const type = getInsertionType(marker.length, pxPerBp)
  return (
    marker.h >= MIN_HEIGHT_FOR_TEXT &&
    (type === 'large' ||
      (type === 'small' && pxPerBp >= MIN_PX_PER_BP_FOR_TEXT))
  )
}

/**
 * Draw one insertion marker + its length label, shared by the on-screen MAF
 * `InsertionsOverlay` and the Canvas2D export path so the two can't drift. The
 * `xCenter` is the cell boundary the insertion sits before. A row text label
 * (large insertions: the bp count centered in the box, small insertions: a
 * `(N)` beside the bar — matching plugin-alignments) only renders once the row
 * is tall enough for letters (`MIN_HEIGHT_FOR_TEXT`, shared with the base/SNP
 * letters so insertions and mismatches reveal together). With no count drawn, a
 * large insertion shrinks to the narrow bar rather than an empty wide box.
 * Callers must set `ctx.font` and `ctx.textBaseline = 'middle'` first.
 */
function drawMafInsertionMarker(
  ctx: Ctx2D,
  xCenter: number,
  rowTop: number,
  h: number,
  length: number,
  pxPerBp: number,
  insertionColor: string,
) {
  const type = getInsertionType(length, pxPerBp)
  // drawInsertionMarker gates the box width on `h` itself, so it shrinks a large
  // insertion to the narrow bar when the row is too short to show the count.
  const labelFits = h >= MIN_HEIGHT_FOR_TEXT
  ctx.fillStyle = insertionColor
  drawInsertionMarker(ctx, xCenter, rowTop, h, length, pxPerBp)
  const yMid = Math.round(rowTop + h / 2)
  if (type === 'large' && labelFits) {
    const text = String(length)
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.fillText(text, xCenter, yMid, CHAR_SIZE_WIDTH * text.length)
  } else if (
    type === 'small' &&
    labelFits &&
    pxPerBp >= MIN_PX_PER_BP_FOR_TEXT
  ) {
    ctx.fillStyle = insertionColor
    ctx.textAlign = 'left'
    ctx.fillText(`(${length})`, xCenter + 3, yMid)
  }
}

/**
 * Draw all positioned insertion markers, shared by the on-screen
 * `InsertionsOverlay` and the SVG export so the two can't drift (the same
 * pattern the other MAF overlays use). Markers carry the orientation-aware
 * `xCenter` already resolved by `computeVisibleInsertions`, so this is a plain
 * marker loop over the shared `drawMafInsertionMarker`.
 */
export function drawMafInsertions(
  ctx: Ctx2D,
  markers: InsertionMarker[],
  insertionColor: string,
  pxPerBp: number,
) {
  // Only when a marker will actually draw a count. Touching text on a canvas —
  // the `font` setter and `fillText` alike — makes the browser resolve the
  // canvas element's font, which flushes the whole document's pending style
  // recalc. This overlay draws from a passive effect, right after React has
  // committed a frame's worth of dirty inline styles, so an unconditional
  // `ctx.font` charged this draw for all of it (measured at 1.3ms a frame on a
  // four-track view, at zoom levels where the rows are too short for a single
  // letter). Markers themselves are rects, which force nothing.
  if (markers.some(m => insertionDrawsLabel(m, pxPerBp))) {
    ctx.font = LABEL_FONT.css
    ctx.textBaseline = 'middle'
  }
  for (const m of markers) {
    drawMafInsertionMarker(
      ctx,
      m.xCenter,
      m.rowTop,
      m.h,
      m.length,
      pxPerBp,
      insertionColor,
    )
  }
}
