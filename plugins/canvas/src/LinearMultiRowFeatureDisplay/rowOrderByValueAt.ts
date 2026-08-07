// A loaded region's slim feature arrays plus its refName (rpcDataMap value +
// the refName from loadedRegions). Just what the sort reads.
export interface RowValueRegion {
  refName: string
  featureStarts: Uint32Array
  featureEnds: Uint32Array
  featureColors: Uint32Array
  partitionValues: string[]
  featurePartitionIndex: Uint32Array
}

// The ABGR color painted at `pos` on each row, for the rows that have one. The
// last covering feature wins, matching paint order — the same rule the hit test
// follows for overlapping features.
function colorsPaintedAt(
  regions: RowValueRegion[],
  refName: string,
  pos: number,
) {
  const byRow = new Map<string, number>()
  for (const r of regions.filter(r => r.refName === refName)) {
    for (let i = 0; i < r.featureStarts.length; i++) {
      if (r.featureStarts[i]! <= pos && pos < r.featureEnds[i]!) {
        byRow.set(
          r.partitionValues[r.featurePartitionIndex[i]!]!,
          r.featureColors[i]!,
        )
      }
    }
  }
  return byRow
}

// Order rows by the value each carries at genomic (refName, pos) — the analogue
// of alignments "sort by base/tag at position". The value is the ABGR color of
// the feature covering pos on that row (the same categorical signal the row
// paints, e.g. B vs D ancestry), so equal-value rows group contiguously: a
// coat-color QTL painting sorted at its peak resolves into one block per allele.
//
// **Blocks are ordered largest first**, not by their color's numeric value.
// Grouping is what the sort is for and either ordering delivers it, but the
// packed ABGR integer is an artifact of how a color is stored — so the same
// rows over the same locus rearranged whenever the track was recolored, and no
// caption could say why one allele was on top. Commonest first is a statement a
// reader can check. Equal-sized blocks fall back to the color value purely so
// the result is deterministic.
//
// Rows with no feature at pos sort last, keeping their original relative order;
// the sort is otherwise stable within a block, so an earlier sort still orders
// each block by what it sorted on.
//
// Returns the rows themselves rather than their names, so the caller writes the
// result straight to `layout` — the rows it hands in are already layout-merged,
// and a name round-trip would only re-look-up what it had. Same shape as
// multi-wiggle's `sortSourcesByScoreAt`.
export function rowOrderByValueAt<T extends { name: string }>(
  sources: T[],
  regions: RowValueRegion[],
  refName: string,
  pos: number,
): T[] {
  const colorByRow = colorsPaintedAt(regions, refName, pos)
  const keyed = sources.map((source, idx) => ({
    source,
    idx,
    color: colorByRow.get(source.name),
  }))
  // counted over the rows being ordered, not over the data, so a subtree filter
  // sizes the blocks by what is actually on screen
  const blockSize = new Map<number, number>()
  for (const { color } of keyed) {
    if (color !== undefined) {
      blockSize.set(color, (blockSize.get(color) ?? 0) + 1)
    }
  }
  // -1 for a row with no feature here, so descending size puts them last
  const sizeOf = (color?: number) =>
    color === undefined ? -1 : blockSize.get(color)!
  return keyed
    .sort(
      (a, b) =>
        sizeOf(b.color) - sizeOf(a.color) ||
        (a.color ?? 0) - (b.color ?? 0) ||
        a.idx - b.idx,
    )
    .map(x => x.source)
}
