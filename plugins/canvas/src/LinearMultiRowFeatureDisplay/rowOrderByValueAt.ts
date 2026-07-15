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

// Order rows by the value each carries at genomic (refName, pos) — the analogue
// of alignments "sort by base/tag at position". The sort key is the ABGR color
// of the feature covering pos on that row (the same categorical signal the row
// paints, e.g. B vs D ancestry), so equal-value rows group contiguously — a
// coat-color QTL painting sorted at its peak resolves into one block per allele.
// Rows with no feature at pos sort last, keeping their original relative order;
// the sort is otherwise stable.
export function rowOrderByValueAt(
  sourceNames: string[],
  regions: RowValueRegion[],
  refName: string,
  pos: number,
): string[] {
  const valueByRow = new Map<string, number>()
  for (const r of regions) {
    if (r.refName !== refName) {
      continue
    }
    for (let i = 0; i < r.featureStarts.length; i++) {
      if (r.featureStarts[i]! <= pos && pos < r.featureEnds[i]!) {
        // last covering feature wins, matching paint order
        valueByRow.set(
          r.partitionValues[r.featurePartitionIndex[i]!]!,
          r.featureColors[i]!,
        )
      }
    }
  }
  return sourceNames
    .map((name, idx) => ({ name, idx, v: valueByRow.get(name) }))
    .sort((a, b) => {
      const av = a.v ?? Infinity
      const bv = b.v ?? Infinity
      return av !== bv ? av - bv : a.idx - b.idx
    })
    .map(x => x.name)
}
