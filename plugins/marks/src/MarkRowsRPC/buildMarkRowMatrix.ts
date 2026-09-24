/** One drawn value: the row it stands in, where it spans, and its value. */
export interface RowInstance {
  regionIndex: number
  row: string
  start: number
  end: number
  value: number
}

/** The most columns a row holds, across every region. */
export const MAX_MATRIX_BINS = 1000

/**
 * One matrix row per name in `rows`, in that order: each region takes its
 * share of `maxBins` by span, and a bin holds the mean value of the row's
 * instances covering its midpoint, 0 where none does.
 */
export function buildMarkRowMatrix({
  rows,
  regions,
  instances,
  maxBins = MAX_MATRIX_BINS,
}: {
  rows: readonly string[]
  regions: readonly { start: number; end: number }[]
  instances: Iterable<RowInstance>
  maxBins?: number
}) {
  const total = regions.reduce((n, r) => n + (r.end - r.start), 0)
  const binCounts = regions.map(r =>
    Math.max(1, Math.round((maxBins * (r.end - r.start)) / Math.max(total, 1))),
  )
  const offsets: number[] = []
  let width = 0
  for (const n of binCounts) {
    offsets.push(width)
    width += n
  }
  const indexOf = new Map(rows.map((name, i) => [name, i]))
  const sums = rows.map(() => new Float64Array(width))
  const counts = rows.map(() => new Uint32Array(width))
  for (const { regionIndex, row, start, end, value } of instances) {
    const r = indexOf.get(row)
    const region = regions[regionIndex]
    if (r === undefined || region === undefined) {
      continue
    }
    const bins = binCounts[regionIndex]!
    const binWidth = (region.end - region.start) / bins
    const first = Math.max(
      0,
      Math.ceil((start - region.start) / binWidth - 0.5),
    )
    const last = Math.min(
      bins,
      Math.ceil((end - region.start) / binWidth - 0.5),
    )
    const offset = offsets[regionIndex]!
    for (let b = first; b < last; b++) {
      sums[r]![offset + b]! += value
      counts[r]![offset + b]! += 1
    }
  }
  return new Map(
    rows.map((name, r) => {
      const sum = sums[r]!
      const count = counts[r]!
      const out = new Float32Array(width)
      for (let i = 0; i < width; i++) {
        out[i] = count[i]! > 0 ? sum[i]! / count[i]! : 0
      }
      return [name, out] as const
    }),
  )
}
