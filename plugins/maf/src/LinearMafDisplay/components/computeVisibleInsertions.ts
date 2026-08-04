import {
  blockHasRefGap,
  forEachInsertion,
} from '../../LinearMafRenderer/rendering/forEachInsertion.ts'
import {
  eachVisibleRegion,
  rowBandGeometry,
  visibleRowRange,
} from './visibleRegionGeometry.ts'

import type { MafOverlayParams } from './visibleRegionGeometry.ts'

export interface InsertionMarker {
  /** screen px of the cell boundary the marker centers on */
  xCenter: number
  rowTop: number
  h: number
  length: number
}

/**
 * Reduce markers that land in the same pixel column of the same row to the
 * longest one there. The drawn bar's width grows with `length`, so the longest
 * is the one that covered the others — dropping the rest changes no pixel.
 *
 * Worth doing only once a base is sub-pixel, which is why this is a separate
 * pass over the finished array rather than a check inside the walk. Zoomed out,
 * a wide region across many species piles hundreds of thousands of markers into
 * a few hundred pixel columns, each otherwise costing a full
 * `drawMafInsertionMarker` (fill + measure + text) every frame to paint over
 * the last; on the measured shape this cuts ~400k markers to ~21k. At <=1 bp/px
 * it would merge nothing — insertion anchors sit at distinct base boundaries,
 * so they already occupy distinct pixel columns — while still paying a map
 * entry per marker, measured several times the cost of the plain push. So the
 * caller skips it there. (That is also the only regime where the count label
 * draws, so no label is ever lost to the merge.)
 *
 * `rowTop` keys the row: it is `offset + rowHeight * rowIndex`, identical for
 * every marker of a row within one pass.
 */
function mergeByPixelColumn(markers: InsertionMarker[]): InsertionMarker[] {
  const byRow = new Map<number, Map<number, InsertionMarker>>()
  for (const marker of markers) {
    let byPixel = byRow.get(marker.rowTop)
    if (!byPixel) {
      byPixel = new Map()
      byRow.set(marker.rowTop, byPixel)
    }
    const px = Math.round(marker.xCenter)
    const existing = byPixel.get(px)
    if (!existing || marker.length > existing.length) {
      byPixel.set(px, marker)
    }
  }
  const out: InsertionMarker[] = []
  for (const byPixel of byRow.values()) {
    out.push(...byPixel.values())
  }
  return out
}

/**
 * Positioned insertion markers for every aligned row in the visible blocks.
 * Insertions are interbase, so each marker centers on the genomic boundary
 * (`anchorBp`) of the reference base following the inserted run. Geometry comes
 * from the shared `forEachInsertion` walk; drawing is shared with plugin-
 * alignments via `drawInsertionMarker`. Once a base goes sub-pixel the markers
 * sharing a pixel column collapse to the visible one — see
 * `mergeByPixelColumn`.
 */
export function computeVisibleInsertions(
  params: MafOverlayParams,
): InsertionMarker[] {
  const { view, rpcDataMap, rowHeight, rowProportion, scrollTop } = params
  const markers: InsertionMarker[] = []
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion, scrollTop)
  const { firstRow, endRow } = visibleRowRange(
    rowHeight,
    scrollTop,
    params.viewportHeight,
  )

  for (const { data: regionData, bpToPx, bpLo, bpHi } of eachVisibleRegion(
    view,
    rpcDataMap,
  )) {
    for (const block of regionData.blocks) {
      if (
        block.endBp <= bpLo ||
        block.startBp >= bpHi ||
        !blockHasRefGap(block)
      ) {
        continue
      }
      for (const row of block.rows) {
        if (row.rowIndex >= firstRow && row.rowIndex < endRow) {
          const rowTop = offset + rowHeight * row.rowIndex
          forEachInsertion(
            block.refSeqBytes,
            row.alignmentBytes,
            block.startBp,
            (anchorBp, length) => {
              markers.push({ xCenter: bpToPx(anchorBp), rowTop, h, length })
            },
          )
        }
      }
    }
  }
  return view.bpPerPx > 1 ? mergeByPixelColumn(markers) : markers
}
