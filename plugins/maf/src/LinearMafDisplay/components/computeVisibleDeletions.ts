import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'
import { measureText } from '@jbrowse/core/util'

import { forEachDeletion } from '../../LinearMafRenderer/rendering/forEachDeletion.ts'
import { makeRowFlank } from '../../LinearMafRenderer/rendering/rowFlank.ts'
import {
  bpSpanPx,
  eachVisibleRegion,
  rowBandGeometry,
  visibleRowRange,
} from './visibleRegionGeometry.ts'

import type { MafOverlayParams } from './visibleRegionGeometry.ts'

// Narrowest label `drawMafDeletionLabels` could ever fit: the min over the
// single digits, plus its 2px padding. A run below this can't draw at any digit
// count — a longer run is proportionally wider, so width outruns the label long
// before the digit count does.
const MIN_LABEL_WIDTH =
  Math.min(...'0123456789'.split('').map(d => measureText(d))) + 2

export interface DeletionMarker {
  /** screen px of the left edge of the deleted run */
  xLeft: number
  /** screen px width of the deleted run */
  width: number
  rowTop: number
  h: number
  /** number of deleted reference bases */
  length: number
}

/**
 * Positioned deletion runs for every aligned row in the visible blocks. A
 * deletion spans reference bases `[start, start+length)`, so the marker spans
 * those cells; the overlay draws the bp count centered when it fits. Geometry
 * comes from the shared `forEachDeletion` walk, the same source the hover
 * hit-test uses.
 *
 * Only runs that could actually carry their label become markers, because this
 * walk is per column per row per frame and every marker it emits is otherwise
 * re-tested and thrown away at draw time. Unlike the insertion overlay, which
 * paints a bar whether or not the count fits, this one draws *nothing but* the
 * label — the gap cells themselves come from the base pass — so a band under
 * `MIN_HEIGHT_FOR_TEXT` makes the entire walk dead work. Zoomed out on a
 * multi-species alignment that was 679k markers built and 0 drawn per frame.
 *
 * The height gate is the one `computeVisibleLabels` already applies, so all row
 * text still reveals together.
 */
export function computeVisibleDeletions(
  params: MafOverlayParams,
): DeletionMarker[] {
  const { view, rpcDataMap, rowHeight, rowProportion, scrollTop } = params
  const markers: DeletionMarker[] = []
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion, scrollTop)
  const { firstRow, endRow } = visibleRowRange(
    rowHeight,
    scrollTop,
    params.viewportHeight,
  )

  if (h >= MIN_HEIGHT_FOR_TEXT) {
    for (const { data: regionData, bpToPx } of eachVisibleRegion(
      view,
      rpcDataMap,
    )) {
      const rowFlank = makeRowFlank(regionData.blocks)
      for (let i = 0; i < regionData.blocks.length; i++) {
        const block = regionData.blocks[i]!
        for (const row of block.rows) {
          if (row.rowIndex >= firstRow && row.rowIndex < endRow) {
            const rowTop = offset + rowHeight * row.rowIndex
            forEachDeletion(
              block.refSeqBytes,
              row.alignmentBytes,
              block.startBp,
              rowFlank(i, row.rowIndex),
              (start, length) => {
                const { xLeft, width } = bpSpanPx(bpToPx, start, start + length)
                if (width >= MIN_LABEL_WIDTH) {
                  markers.push({ xLeft, width, rowTop, h, length })
                }
              },
            )
          }
        }
      }
    }
  }
  return markers
}
