import { cssColorToRgb } from '@jbrowse/core/util/colorBits'

// `regionIndex` is required because genomic coordinates repeat across
// chromosomes, so start/end alone cannot say which region a feature covers.
export interface MatrixFeature {
  regionIndex: number
  row: string
  start: number
  end: number
  colorKey: string
}

interface Bin {
  regionIndex: number
  mid: number
}

const RGB_CHANNELS = 3

// A gap sits one full channel range below black, just outside the color cube, so
// "no feature here" is at least as far from any color as black is from white
// without being an unbounded outlier that clusters rows by gap pattern alone.
const GAP_CHANNEL = -255

// The categorical encoding costs one channel per color, so this ceiling is also
// what keeps the matrix a comparable width to the RGB path's bins x 3.
const MAX_CATEGORICAL_COLORS = 12

// Few enough distinct colors and each bin gets a one-hot channel, so Euclidean
// distance over a row is a mismatch count; past that the r,g,b channels carry a
// continuous palette, whose ordering nothing categorical can use.
export function buildMultiRowMatrix({
  sources,
  regions,
  features,
  maxBins = 1000,
}: {
  sources: string[]
  regions: { start: number; end: number }[]
  features: MatrixFeature[]
  maxBins?: number
}): Map<string, Float32Array<ArrayBuffer>> {
  const totalWidth =
    regions.reduce((a, r) => a + Math.max(0, r.end - r.start), 0) || 1
  const bins: Bin[] = []
  // Bins go in per region in ascending `mid`, which is what lets the search
  // below be a binary one.
  const regionBinStart: number[] = []
  for (const [regionIndex, r] of regions.entries()) {
    regionBinStart.push(bins.length)
    const w = Math.max(0, r.end - r.start)
    const nb = Math.max(1, Math.round((maxBins * w) / totalWidth))
    for (let i = 0; i < nb; i++) {
      bins.push({ regionIndex, mid: r.start + ((i + 0.5) * w) / nb })
    }
  }
  regionBinStart.push(bins.length)

  // Compares the stored `mid` rather than re-deriving an index from the
  // spacing, which would disagree with the coverage test by an ulp at a
  // boundary — precisely where a bin changes hands.
  function firstBinAtOrAfter(regionIndex: number, start: number) {
    let lo = regionBinStart[regionIndex]!
    let hi = regionBinStart[regionIndex + 1]!
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (bins[mid]!.mid < start) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    return lo
  }

  const byRow = new Map<string, MatrixFeature[]>()
  for (const f of features) {
    let arr = byRow.get(f.row)
    if (!arr) {
      arr = []
      byRow.set(f.row, arr)
    }
    arr.push(f)
  }

  const distinctColors = new Set<string>()
  for (const f of features) {
    distinctColors.add(f.colorKey)
  }
  const categorical = distinctColors.size <= MAX_CATEGORICAL_COLORS

  // The categorical path gives the gap the last slot of its own, so "absent" is
  // one more category and two absent rows still agree at that bin.
  const channels = categorical ? distinctColors.size + 1 : RGB_CHANNELS
  const slotOf = new Map<string, number>()
  if (categorical) {
    for (const key of distinctColors) {
      slotOf.set(key, slotOf.size)
    }
  }
  const rgbCache = new Map<string, [number, number, number]>()
  function rgbOf(key: string) {
    let rgb = rgbCache.get(key)
    if (!rgb) {
      rgb = cssColorToRgb(key)
      rgbCache.set(key, rgb)
    }
    return rgb
  }

  const matrix = new Map<string, Float32Array<ArrayBuffer>>()
  // Refilled per row, and assigned in feature order so a later feature
  // overwrites the bins it shares with an earlier one: last covering wins.
  const coveringPerBin = new Array<MatrixFeature | undefined>(bins.length)
  for (const name of sources) {
    const intervals = byRow.get(name) ?? []
    const row = new Float32Array(bins.length * channels)
    coveringPerBin.fill(undefined)
    for (const f of intervals) {
      const end = regionBinStart[f.regionIndex + 1]
      if (end === undefined) {
        continue
      }
      for (
        let i = firstBinAtOrAfter(f.regionIndex, f.start);
        i < end && bins[i]!.mid < f.end;
        i++
      ) {
        coveringPerBin[i] = f
      }
    }
    for (let binIndex = 0; binIndex < bins.length; binIndex++) {
      const covering = coveringPerBin[binIndex]
      const o = binIndex * channels
      if (categorical) {
        row[o + (covering ? slotOf.get(covering.colorKey)! : channels - 1)] = 1
      } else {
        const [r, g, b] = covering
          ? rgbOf(covering.colorKey)
          : [GAP_CHANNEL, GAP_CHANNEL, GAP_CHANNEL]
        row[o] = r
        row[o + 1] = g
        row[o + 2] = b
      }
    }
    matrix.set(name, row)
  }
  return matrix
}
