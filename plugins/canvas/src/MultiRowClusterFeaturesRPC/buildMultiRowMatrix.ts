// One feature reduced to what clustering needs: its `regionIndex` (which of the
// clustered regions it was fetched from), its row (partition value), its genomic
// span, and a `colorKey` — the resolved per-feature color string, which is the
// categorical signal painted on screen (e.g. "B" vs "D" ancestry map to blue vs
// red). Two rows are similar when they carry the same colors at the same
// positions. `regionIndex` is required because genomic coordinates repeat across
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

// Build a rows × bins numeric matrix for hierarchical clustering. Rows are the
// `sources` (in the given order — the cluster `order` result indexes back into
// it); columns are evenly-spaced genomic bins across the visible regions. Each
// cell is the ordinal index of the feature color covering that bin's midpoint on
// that row (first-seen color → 0, next distinct → 1, …), or -1 where the row has
// no feature. For a 2-category painting (B/D) this is a clean binary matrix, so
// Euclidean distance reduces to a mismatch count; extra categories degrade
// gracefully to an ordinal encoding.
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

  const colorIndex = new Map<string, number>()
  function indexOfColor(key: string) {
    let idx = colorIndex.get(key)
    if (idx === undefined) {
      idx = colorIndex.size
      colorIndex.set(key, idx)
    }
    return idx
  }

  return sources.map(name => {
    const intervals = byRow.get(name) ?? []
    return bins.map(bin => {
      // last covering feature wins, matching the paint order (later features
      // draw on top); -1 marks a gap so absent rows stay maximally distant. Only
      // features from this bin's own region count — coordinates repeat across
      // regions, so a same-coord feature on another chromosome must not leak in.
      let val = -1
      for (const f of intervals) {
        if (
          f.regionIndex === bin.regionIndex &&
          f.start <= bin.mid &&
          bin.mid < f.end
        ) {
          val = indexOfColor(f.colorKey)
        }
      }
      return val
    })
  })
}
