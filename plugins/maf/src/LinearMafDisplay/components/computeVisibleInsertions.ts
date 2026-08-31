import { regionInsertionEvents } from './mafRowEvents.ts'
import { eachVisibleRegion, rowViewport } from './visibleRegionGeometry.ts'

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
 * the merge below is lossless. It runs *during* the projection, so a marker
 * object exists only for a pixel column that wins one and the allocation is
 * proportional to what is drawn rather than to what is found.
 *
 * **The merge needs no index at all, only the previous event of the same row.**
 * A row's events arrive in ascending bp — blocks ascend, and `forEachInsertion`
 * walks a block's columns left to right — and `bpToPx` is monotonic in bp
 * (descending on a reversed region, which is just as monotonic), so every event
 * sharing a pixel column with another is *adjacent* to it in that row's stream.
 * Two small typed arrays carrying the last column and marker per visible row
 * therefore do what a `Map` of `Map`s did, without hashing an integer or
 * allocating a bucket per row. The rows interleave because the walk is
 * block-major, which is why the state is per row rather than a single pair.
 *
 * At <=1 bp/px the merge is skipped rather than run: insertion anchors sit at
 * distinct base boundaries, so they already occupy distinct pixel columns and it
 * would merge nothing while still paying for the state. That is also the only
 * regime where the count label draws, so no label is ever lost to it.
 *
 * Markers come back in walk order — block-major, ascending px within each row —
 * where collecting into per-row buckets grouped them by row first. Only the
 * interleaving between rows differs, and rows occupy disjoint bands, so the
 * painted result is identical.
 */
export function computeVisibleInsertions(
  params: MafOverlayParams,
): InsertionMarker[] {
  const { view, rpcDataMap, rowHeight } = params
  const markers: InsertionMarker[] = []
  const { h, offset, firstRow, endRow } = rowViewport(params)
  const merging = view.bpPerPx > 1
  // Indexed by `row - firstRow`, so these are viewport-sized whatever the depth
  // of the alignment. `lastMarker` starts at -1 for "this row has none yet",
  // which is what lets `lastPx` hold any pixel column including a negative one.
  const rowSlots = merging ? Math.max(0, endRow - firstRow) : 0
  const lastPx = new Int32Array(rowSlots)
  const lastMarker = new Int32Array(rowSlots).fill(-1)

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
        if (!merging) {
          markers.push({
            xCenter,
            rowTop: offset + rowHeight * row,
            h,
            length: len,
          })
          continue
        }
        const slot = row - firstRow
        const px = Math.round(xCenter)
        const held = lastMarker[slot]!
        if (held >= 0 && lastPx[slot] === px) {
          // In place, so a pixel column costs one object however many
          // insertions land in it — and `>` rather than `>=` keeps the first of
          // equal lengths, as collecting then merging did.
          const marker = markers[held]!
          if (len > marker.length) {
            marker.xCenter = xCenter
            marker.length = len
          }
          continue
        }
        lastPx[slot] = px
        lastMarker[slot] = markers.length
        markers.push({
          xCenter,
          rowTop: offset + rowHeight * row,
          h,
          length: len,
        })
      }
    }
  }
  return markers
}
