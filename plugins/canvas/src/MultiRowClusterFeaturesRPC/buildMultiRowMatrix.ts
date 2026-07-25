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

// Channels a covered bin contributes. A gap writes GAP_CHANNEL to all three:
// one full channel range below black, i.e. just outside the color cube. So "no
// feature here" is at least as different from any color as black is from white,
// without being an unbounded outlier that would cluster rows by gap pattern
// alone. Two rows that are both absent still agree at that bin.
const CHANNELS = 3
const GAP_CHANNEL = -255

// Build a rows × (bins × 3) numeric matrix for hierarchical clustering. Rows are
// the `sources` (in the given order — the cluster `order` result indexes back
// into it); each column triple is the r,g,b of the feature color covering that
// bin's midpoint on that row.
//
// The channels are the encoding, not a rendering detail: a painting's color IS
// the per-bin value of the row (a `color` jexl over some feature field, or a BED
// `itemRgb`), so channel differences ARE the row-property differences clustering
// is asking about. A two-category painting (blue vs red B/D ancestry) gives two
// well-separated points per bin, so Euclidean distance still reduces to a
// mismatch count; a continuous palette keeps its ordering, so rows painted
// similar shades land together (PCLAI local ancestry paints a PCA coordinate as
// ~1800 distinct itemRgb values on chr1 alone, and no two rows ever share an
// exact value — nothing categorical can separate those).
//
// This deliberately replaces an earlier first-seen ordinal encoding (first color
// → 0, next distinct → 1, …). Euclidean distance over those codes measured
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
}): number[][] {
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

  // css → channels is memoized across every row and bin: a painting reuses the
  // same color strings across ~10^5 cells, and the parse is the only non-trivial
  // per-cell work.
  const channelCache = new Map<string, [number, number, number]>()
  function channelsOf(key: string) {
    let rgb = channelCache.get(key)
    if (!rgb) {
      rgb = cssColorToRgb(key)
      channelCache.set(key, rgb)
    }
    return rgb
  }

  return sources.map(name => {
    const intervals = byRow.get(name) ?? []
    const row = new Array<number>(bins.length * CHANNELS)
    for (const [binIndex, bin] of bins.entries()) {
      // last covering feature wins, matching the paint order (later features
      // draw on top); an uncovered bin keeps the gap sentinel. Only features from
      // this bin's own region count — coordinates repeat across regions, so a
      // same-coord feature on another chromosome must not leak in.
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
      const [r, g, b] = covering
        ? channelsOf(covering.colorKey)
        : [GAP_CHANNEL, GAP_CHANNEL, GAP_CHANNEL]
      const o = binIndex * CHANNELS
      row[o] = r
      row[o + 1] = g
      row[o + 2] = b
    }
    return row
  })
}
