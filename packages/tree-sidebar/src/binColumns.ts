/** Where one region's columns sit in a matrix row, and the base its first starts at. */
export interface ColumnSegment {
  colOffset: number
  width: number
  regionStart: number
}

/**
 * A clustering matrix row's columns: one per `bpPerPx` of each region, the
 * regions end to end, as the view draws them.
 */
export function columnSegments(
  regions: readonly { start: number; end: number }[],
  bpPerPx: number,
) {
  const invBpPerPx = 1 / bpPerPx
  const segments: ColumnSegment[] = []
  let width = 0
  for (const r of regions) {
    const w = Math.max(0, Math.floor((r.end - r.start) * invBpPerPx))
    segments.push({ colOffset: width, width: w, regionStart: r.start })
    width += w
  }
  return { segments, width, invBpPerPx }
}

/**
 * The columns of `segment` that `[start, end)` covers, as offsets from its
 * first, empty for a span off it. Both edges truncate, and a span narrower
 * than a column covers the column it starts in, so base-resolution data never
 * bins to an all-zero row.
 */
export function spanColumns(
  segment: ColumnSegment,
  invBpPerPx: number,
  start: number,
  end: number,
) {
  const { width, regionStart } = segment
  if (end <= regionStart) {
    return { startX: 0, endX: 0 }
  }
  const startX = Math.max(0, ((start - regionStart) * invBpPerPx) | 0)
  const rawEndX = ((end - regionStart) * invBpPerPx) | 0
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
  invBpPerPx: number,
  start: number,
  end: number,
  value: number,
) {
  const { startX, endX } = spanColumns(segment, invBpPerPx, start, end)
  const base = rowOffset + segment.colOffset
  for (let x = startX; x < endX; x++) {
    sums[base + x]! += value
    counts[base + x]! += 1
  }
}

/**
 * Each column's mean of what `binSpan` added into `row`, 0 where nothing did.
 * A mean rather than the last value: at 10 kb/px a column holds hundreds of a
 * bedMethyl's CpGs, and a BigWig zoom bin is already a mean.
 */
export function columnMeans<R extends Float32Array>(
  sums: Float64Array,
  counts: Int32Array,
  rowOffset: number,
  row: R,
) {
  for (let x = 0; x < row.length; x++) {
    const n = counts[rowOffset + x]!
    const sum = sums[rowOffset + x]!
    row[x] = n > 1 ? sum / n : sum
  }
  return row
}
