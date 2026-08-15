import { regionInsertionEvents } from './mafRowEvents.ts'
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
 * Positioned insertion markers for every aligned row in the visible blocks.
 * Insertions are interbase, so each marker centers on the genomic boundary
 * (`anchorBp`) of the reference base following the inserted run. Drawing is
 * shared with plugin-alignments via `drawInsertionMarker`.
 *
 * Two things keep this affordable, and they cover the two halves of the cost.
 *
 * **Where the insertions are** comes from `regionInsertionEvents`, which reads
 * the alignment bytes once per block rather than once per frame — so panning
 * costs one `bpToPx` per event in view instead of a per-column scan of every
 * visible block × row.
 *
 * **How many markers survive** is the other half, and it dominates once the
 * first is fixed: zoomed out, a wide region across many species piles hundreds
 * of thousands of insertions into a few hundred pixel columns of each row. The
 * drawn bar's width grows with `length`, so within one pixel column the longest
 * is the one that covered the others and dropping the rest changes no pixel —
 * the merge below is lossless. It runs *during* the projection rather than over
 * a finished array, which is what keeps the allocation proportional to what is
 * drawn (~21k markers on the measured shape) rather than to what is found
 * (~300k): a marker object exists only for a pixel column that wins one, and a
 * later, longer insertion in the same column mutates it in place.
 *
 * At <=1 bp/px the merge is skipped rather than run: insertion anchors sit at
 * distinct base boundaries, so they already occupy distinct pixel columns and it
 * would merge nothing while still paying a map entry per marker. That is also
 * the only regime where the count label draws, so no label is ever lost to it.
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
  // Nested rather than one map under a joined key: both halves are per marker,
  // and a joined key would build a string (or a hand-rolled integer key that has
  // to not overflow on a deep alignment) hundreds of thousands of times a frame.
  // Rows are collected in first-seen order and pixel columns within them the
  // same way, which is the order the merge produced when it ran over a finished
  // array — so the marker list is unchanged, not merely equivalent.
  const byRow =
    view.bpPerPx > 1 ? new Map<number, Map<number, InsertionMarker>>() : null

  for (const { data: regionData, bpToPx, bpLo, bpHi } of eachVisibleRegion(
    view,
    rpcDataMap,
  )) {
    const events = regionInsertionEvents(regionData)
    const { blocks } = regionData
    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b]!
      if (block.endBp <= bpLo || block.startBp >= bpHi) {
        continue
      }
      const { from, to } = events.ensure(b)
      const { positionBp, rowIndex, length } = events
      for (let e = from; e < to; e++) {
        const row = rowIndex[e]!
        if (row < firstRow || row >= endRow) {
          continue
        }
        const xCenter = bpToPx(positionBp[e]!)
        const len = length[e]!
        if (byRow === null) {
          markers.push({
            xCenter,
            rowTop: offset + rowHeight * row,
            h,
            length: len,
          })
          continue
        }
        let byPixel = byRow.get(row)
        if (byPixel === undefined) {
          byPixel = new Map()
          byRow.set(row, byPixel)
        }
        const px = Math.round(xCenter)
        const existing = byPixel.get(px)
        if (existing === undefined) {
          byPixel.set(px, {
            xCenter,
            rowTop: offset + rowHeight * row,
            h,
            length: len,
          })
        } else if (len > existing.length) {
          // In place, so a pixel column costs one object however many
          // insertions land in it — and `>` rather than `>=` keeps the first of
          // equal lengths, as collecting then merging did.
          existing.xCenter = xCenter
          existing.length = len
        }
      }
    }
  }
  if (byRow !== null) {
    for (const byPixel of byRow.values()) {
      for (const marker of byPixel.values()) {
        markers.push(marker)
      }
    }
  }
  return markers
}
