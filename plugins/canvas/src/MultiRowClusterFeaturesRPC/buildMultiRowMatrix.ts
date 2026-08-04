import { cssColorToRgb } from '@jbrowse/core/util/colorBits'

// One feature reduced to what clustering needs: its `regionIndex` (which of the
// clustered regions it was fetched from), its row (partition value), its genomic
// span, and a `colorKey` — the resolved per-feature color string, which is the
// signal painted on screen (e.g. "B" vs "D" ancestry map to blue vs red). Two
// rows are similar when they carry the same colors at the same positions.
// `regionIndex` is required because genomic coordinates repeat across
// chromosomes (every refName starts near 0), so start/end alone can't say which
// region a feature belongs to — a bin is only covered by features from its own
// region.
export interface MatrixFeature {
  regionIndex: number
  row: string
  start: number
  end: number
  colorKey: string
}

// A bin's sampling point: its genomic midpoint plus the region it belongs to, so
// coverage only matches features from that same region.
interface Bin {
  regionIndex: number
  mid: number
}

// RGB path: channels a covered bin contributes. A gap writes GAP_CHANNEL to all
// three: one full channel range below black, i.e. just outside the color cube.
// So "no feature here" is at least as different from any color as black is from
// white, without being an unbounded outlier that would cluster rows by gap
// pattern alone. Two rows that are both absent still agree at that bin.
const RGB_CHANNELS = 3
const GAP_CHANNEL = -255

// Categorical path: at or below this many distinct colors a painting is treated
// as a set of categories rather than as samples of a continuous palette. The
// cost of the categorical encoding is one channel per category, so the ceiling
// is also what keeps the matrix a comparable width to the RGB path's bins × 3
// (at the limit, bins × 13).
const MAX_CATEGORICAL_COLORS = 12

// Build a rows × (bins × channels) numeric matrix for hierarchical clustering,
// keyed by source in the given order — which is the order the cluster `order`
// result indexes back into, so the name travels with its row rather than being
// re-associated by position downstream. Each bin's channels encode the color of
// the feature covering that bin's midpoint on that row.
//
// The color is the encoding, not a rendering detail: a painting's color IS the
// per-bin value of the row (a `color` jexl over some feature field, or a BED
// `itemRgb`), so color differences ARE the row-property differences clustering
// is asking about. But *how* a color difference should be scored depends on
// whether the palette is categorical or continuous, and the two want opposite
// encodings — so this counts the distinct colors and picks:
//
//   - **Categorical** (<= MAX_CATEGORICAL_COLORS distinct): one channel per
//     color, 1 in the bin's own color's channel and 0 elsewhere. Every pair of
//     distinct categories is then sqrt(2) apart, so Euclidean distance over the
//     row is exactly a mismatch count. Under RGB it was not: an earlier comment
//     here claimed a categorical painting "reduces to a mismatch count", which
//     holds only for *two* colors. With three or more, RGB scores blue↔red and
//     blue↔purple very differently for no biological reason, so a gene-biotype
//     or multi-population painting clustered partly on palette geometry.
//   - **Continuous** (more than that): the r,g,b channels, as before. Ordering
//     in the palette carries real signal here and nothing categorical can use
//     it — PCLAI local ancestry paints a PCA coordinate as ~1800 distinct
//     itemRgb values on chr1 alone, and no two rows ever share an exact value.
//     One-hot over that would be both meaningless and impossibly wide.
//
// Detection is exact and free: the distinct colors are the same set the
// channel/slot cache is built from either way.
//
// Both paths deliberately replace an earlier first-seen ordinal encoding (first
// color → 0, next distinct → 1, …). Euclidean distance over those codes measured
// insertion order rather than similarity: past two categories, two unrelated
// colors seen consecutively scored as near-identical, which is what split single
// -color haplotype groups into separate blocks in the local-ancestry dendrogram.
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
}): Map<string, number[]> {
  const totalWidth =
    regions.reduce((a, r) => a + Math.max(0, r.end - r.start), 0) || 1
  const bins: Bin[] = []
  for (const [regionIndex, r] of regions.entries()) {
    const w = Math.max(0, r.end - r.start)
    const nb = Math.max(1, Math.round((maxBins * w) / totalWidth))
    for (let i = 0; i < nb; i++) {
      bins.push({ regionIndex, mid: r.start + ((i + 0.5) * w) / nb })
    }
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

  // Either encoding resolves a color string to its channel values once and
  // reuses them across every row and bin: a painting repeats the same color
  // strings across ~10^5 cells, and resolving is the only non-trivial per-cell
  // work.
  //
  // Categorical rows are written into a zero-filled array with a single 1, so
  // `channels` is the slot count and the gap gets the last slot of its own —
  // "absent" as just another category, exactly as far from every color as they
  // are from each other, and two absent rows still agree. The RGB path keeps
  // the out-of-cube gap sentinel instead, since there is no spare dimension to
  // give it.
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

  const matrix = new Map<string, number[]>()
  for (const name of sources) {
    const intervals = byRow.get(name) ?? []
    const row = new Array<number>(bins.length * channels)
    if (categorical) {
      row.fill(0)
    }
    for (const [binIndex, bin] of bins.entries()) {
      // last covering feature wins, matching the paint order (later features
      // draw on top); an uncovered bin is a gap. Only features from this bin's
      // own region count — coordinates repeat across regions, so a same-coord
      // feature on another chromosome must not leak in.
      let covering: MatrixFeature | undefined
      for (const f of intervals) {
        if (
          f.regionIndex === bin.regionIndex &&
          f.start <= bin.mid &&
          bin.mid < f.end
        ) {
          covering = f
        }
      }
      const o = binIndex * channels
      if (categorical) {
        // gap takes the slot past the last color
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
