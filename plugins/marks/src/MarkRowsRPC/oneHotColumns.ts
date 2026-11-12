import { spanColumns } from '@jbrowse/tree-sidebar/binColumns'

import type { ColumnSegment } from '@jbrowse/tree-sidebar/binColumns'

/**
 * Past this many distinct values a field is an identifier, not a category:
 * one-hot over it is a row of channels no two rows share, so the distance
 * carries only coverage, at `channels` times its cost.
 */
export const MAX_CATEGORICAL_VALUES = 64

/**
 * Columns a categorical or presence matrix row keeps under a budget of
 * `maxCells` per row: the view's own, or fewer and wider where `channels`
 * would pass the budget.
 */
export function categoryColumnWidth(
  regions: readonly { start: number; end: number }[],
  bpPerPx: number,
  channels: number,
  maxCells = 13_000,
) {
  const span = regions.reduce((a, r) => a + Math.max(0, r.end - r.start), 0)
  return Math.max(bpPerPx, (span * channels) / maxCells)
}

/**
 * One-hot `slot` of `channels` into each column of `segment` that
 * `spanColumns` says `[start, end)` covers, in the row starting at
 * `rowOffset`. A later span overwrites the columns it shares with an earlier
 * one, so the last covering wins. Presence is one channel and slot 0.
 */
export function coverSpan(
  row: Float32Array,
  rowOffset: number,
  channels: number,
  segment: ColumnSegment,
  start: number,
  end: number,
  slot: number,
) {
  const { startX, endX } = spanColumns(segment, start, end)
  for (let x = startX; x < endX; x++) {
    const at = rowOffset + (segment.colOffset + x) * channels
    row.fill(0, at, at + channels)
    row[at + slot] = 1
  }
}

/**
 * Set the last channel, the gap's, in every column of the `width` columns at
 * `rowOffset` that no `coverSpan` reached, so two rows absent there agree.
 */
export function markGaps(
  row: Float32Array,
  rowOffset: number,
  width: number,
  channels: number,
) {
  for (let x = 0; x < width; x++) {
    const at = rowOffset + x * channels
    let covered = false
    for (let c = 0; c < channels - 1 && !covered; c++) {
      covered = row[at + c] !== 0
    }
    if (!covered) {
      row[at + channels - 1] = 1
    }
  }
}
