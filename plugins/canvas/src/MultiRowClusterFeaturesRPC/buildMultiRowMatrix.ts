import {
  binSpan,
  columnMeans,
  columnSegments,
  spanColumns,
} from '@jbrowse/tree-sidebar/binColumns'

// `regionIndex` is required because genomic coordinates repeat across
// chromosomes, so start/end alone cannot say which region a feature covers.
export interface MatrixFeature {
  regionIndex: number
  row: string
  start: number
  end: number
  value: string
}

export type MatrixEncoding = 'presence' | 'scalar' | 'categorical'

// Past this many distinct values a field is an identifier, not a category:
// one-hot over it is a row of channels no two rows share, so the distance
// carries only coverage, at `channels` times the cost of measuring coverage
// directly. `name` under the auto pick is the field that gets here.
export const MAX_CATEGORICAL_VALUES = 64

function chooseEncoding(
  clusterField: string,
  values: Set<string>,
): MatrixEncoding {
  if (clusterField === '') {
    return 'presence'
  }
  let anyValue = false
  let numeric = true
  for (const v of values) {
    if (v !== '') {
      anyValue = true
      numeric &&= Number.isFinite(Number(v))
    }
  }
  if (!anyValue) {
    return 'presence'
  }
  if (numeric) {
    return 'scalar'
  }
  return values.size > MAX_CATEGORICAL_VALUES ? 'presence' : 'categorical'
}

/**
 * One row per source, one to several channels per bin, keyed in `sources`
 * order. Presence marks the bins a row covers, a numeric attribute becomes the
 * mean over each bin, and anything else is one-hot over its distinct values so
 * Euclidean distance counts mismatched bins. `encoding` says which of the three
 * the data got, since a wide vocabulary degrades to presence. Bins are
 * `columnSegments` columns and a feature covers them by `spanColumns`, so one
 * narrower than a bin counts in the bin it starts in.
 */
export function buildMultiRowMatrix({
  sources,
  regions,
  features,
  clusterField,
  maxBins = 1000,
  maxCells = 13_000,
}: {
  sources: string[]
  regions: { start: number; end: number }[]
  features: MatrixFeature[]
  clusterField: string
  maxBins?: number
  maxCells?: number
}): { rows: Map<string, Float32Array<ArrayBuffer>>; encoding: MatrixEncoding } {
  const distinctValues = new Set<string>()
  for (const f of features) {
    distinctValues.add(f.value)
  }
  const encoding = chooseEncoding(clusterField, distinctValues)
  // The categorical path gives the gap the last slot of its own, so "absent" is
  // one more category and two absent rows still agree at that bin.
  const channels = encoding === 'categorical' ? distinctValues.size + 1 : 1
  const slotOf = new Map<string, number>()
  if (encoding === 'categorical') {
    for (const value of distinctValues) {
      slotOf.set(value, slotOf.size)
    }
  }

  // A wide vocabulary buys its channels out of the bins rather than off an
  // unbounded row: same cell budget, fewer and wider bins.
  const binCount = Math.max(
    1,
    Math.min(maxBins, Math.floor(maxCells / channels)),
  )
  const totalWidth =
    regions.reduce((a, r) => a + Math.max(0, r.end - r.start), 0) || 1
  const { segments, width, invBpPerPx } = columnSegments(
    regions,
    totalWidth / binCount,
  )

  const byRow = new Map<string, MatrixFeature[]>()
  for (const f of features) {
    let arr = byRow.get(f.row)
    if (!arr) {
      arr = []
      byRow.set(f.row, arr)
    }
    arr.push(f)
  }

  const rows = new Map<string, Float32Array<ArrayBuffer>>()
  // Refilled per row, and assigned in feature order so a later feature
  // overwrites the bins it shares with an earlier one: last covering wins.
  const coveringPerBin = new Array<MatrixFeature | undefined>(width)
  // The scalar path averages instead, the way a wiggle column does: several
  // features commonly land in one bin, and last-wins would sample one of them
  // at random.
  const sums = new Float64Array(encoding === 'scalar' ? width : 0)
  const counts = new Int32Array(encoding === 'scalar' ? width : 0)
  for (const name of sources) {
    const intervals = byRow.get(name) ?? []
    const row = new Float32Array(width * channels)
    if (encoding === 'scalar') {
      sums.fill(0)
      counts.fill(0)
      for (const f of intervals) {
        const segment = segments[f.regionIndex]
        if (segment && f.value !== '') {
          const value = Number(f.value)
          binSpan(sums, counts, 0, segment, invBpPerPx, f.start, f.end, value)
        }
      }
      rows.set(name, columnMeans(sums, counts, 0, row))
      continue
    }
    coveringPerBin.fill(undefined)
    for (const f of intervals) {
      const segment = segments[f.regionIndex]
      if (segment) {
        const { startX, endX } = spanColumns(
          segment,
          invBpPerPx,
          f.start,
          f.end,
        )
        const from = segment.colOffset + startX
        coveringPerBin.fill(f, from, from + Math.max(0, endX - startX))
      }
    }
    for (let binIndex = 0; binIndex < width; binIndex++) {
      const covering = coveringPerBin[binIndex]
      if (encoding === 'presence') {
        row[binIndex] = covering ? 1 : 0
      } else {
        row[
          binIndex * channels +
            (covering ? slotOf.get(covering.value)! : channels - 1)
        ] = 1
      }
    }
    rows.set(name, row)
  }
  return { rows, encoding }
}
