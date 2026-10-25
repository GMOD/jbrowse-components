/** Where one region's columns sit in a matrix row, and the base its first starts at. */
export interface ColumnSegment {
  colOffset: number
  width: number
  regionStart: number
  bpPerPx: number
}

// A caller's `bpPerPx` is often itself a quotient, `span / columns`, so
// `span / bpPerPx` can land a few ulps under the whole number it means:
// 1000 bp over 228 columns gives 227.99999999999997. Snap that back before
// flooring, or the last column, and a span starting on a column edge, slip
// one column early.
function columnFloor(x: number) {
  return Math.floor(x + 1e-9 * Math.max(1, Math.abs(x)))
}

/**
 * A clustering matrix row's columns: one per `bpPerPx` of each region, the
 * regions end to end, as the view draws them.
 */
export function columnSegments(
  regions: readonly { start: number; end: number }[],
  bpPerPx: number,
) {
  const segments: ColumnSegment[] = []
  let width = 0
  for (const r of regions) {
    const w = Math.max(0, columnFloor((r.end - r.start) / bpPerPx))
    segments.push({ colOffset: width, width: w, regionStart: r.start, bpPerPx })
    width += w
  }
  return { segments, width }
}

/**
 * The columns of `segment` that `[start, end)` covers, as offsets from its
 * first, empty for a span off it. Both edges floor, and a span narrower than a
 * column covers the column it starts in, so base-resolution data never bins to
 * an all-zero row.
 */
export function spanColumns(
  segment: ColumnSegment,
  start: number,
  end: number,
) {
  const { width, regionStart, bpPerPx } = segment
  if (end <= regionStart) {
    return { startX: 0, endX: 0 }
  }
  const startX = Math.max(0, columnFloor((start - regionStart) / bpPerPx))
  const rawEndX = columnFloor((end - regionStart) / bpPerPx)
  return { startX, endX: Math.min(width, Math.max(rawEndX, startX + 1)) }
}

/**
 * Add `value` to every column of `segment` that `spanColumns` says
 * `[start, end)` covers, in the row starting at `rowOffset` of `sums` and
 * `counts`.
 */
export function binSpan(
  sums: Float64Array,
  counts: Int32Array,
  rowOffset: number,
  segment: ColumnSegment,
  start: number,
  end: number,
  value: number,
) {
  const { startX, endX } = spanColumns(segment, start, end)
  const base = rowOffset + segment.colOffset
  for (let x = startX; x < endX; x++) {
    sums[base + x]! += value
    counts[base + x]! += 1
  }
}

/**
 * Each column's mean of what `binSpan` added into `row`, `empty` where nothing
 * did. A mean rather than the last value: at 10 kb/px a column holds hundreds
 * of a bedMethyl's CpGs, and a BigWig zoom bin is already a mean.
 */
export function columnMeans<R extends Float32Array>(
  sums: Float64Array,
  counts: Int32Array,
  rowOffset: number,
  row: R,
  empty = 0,
) {
  for (let x = 0; x < row.length; x++) {
    const n = counts[rowOffset + x]!
    row[x] = n === 0 ? empty : sums[rowOffset + x]! / n
  }
  return row
}

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
