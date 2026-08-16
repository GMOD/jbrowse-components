import { orderRowsByValueAt } from '@jbrowse/tree-sidebar'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// Just the arrays the sort reads, off the region the caller already resolved as
// the one covering the column (`loadedRegionIndexAt`). A `Pick` rather than a
// re-declaration, so a rename on the wire shape reaches this instead of leaving
// a structurally-compatible copy behind.
export type RowValueRegion = Pick<
  MultiRowRegionData,
  | 'featureStarts'
  | 'featureEnds'
  | 'featureColors'
  | 'partitionValues'
  | 'featurePartitionIndex'
>

// The ABGR color painted at `pos` on each row, for the rows that have one. The
// last covering feature wins, matching paint order — the same rule the hit test
// follows for overlapping features.
function colorsPaintedAt(region: RowValueRegion, pos: number) {
  const byRow = new Map<string, number>()
  for (let i = 0; i < region.featureStarts.length; i++) {
    if (region.featureStarts[i]! <= pos && pos < region.featureEnds[i]!) {
      byRow.set(
        region.partitionValues[region.featurePartitionIndex[i]!]!,
        region.featureColors[i]!,
      )
    }
  }
  return byRow
}

// Order rows by the value each carries at one genomic column — the analogue of
// alignments "sort by base/tag at position". The value is the ABGR color of the
// feature covering pos on that row (the same categorical signal the row paints,
// e.g. B vs D ancestry), so equal-value rows group contiguously: a coat-color
// QTL painting sorted at its peak resolves into one block per allele.
//
// **Blocks are ordered largest first**, not by their color's numeric value.
// Grouping is what the sort is for and either ordering delivers it, but the
// packed ABGR integer is an artifact of how a color is stored — so the same
// rows over the same locus rearranged whenever the track was recolored, and no
// caption could say why one allele was on top. Commonest first is a statement a
// reader can check. Equal-sized blocks fall back to the color value purely so
// the result is deterministic.
//
// Sinking the rows with no feature at pos, and staying stable otherwise, is
// `orderRowsByValueAt`'s — shared with multi-wiggle's `sortSourcesByScoreAt`,
// which asks the same question of a score.
export function rowOrderByValueAt<T extends { name: string }>(
  sources: T[],
  region: RowValueRegion,
  pos: number,
): T[] {
  const colorByRow = colorsPaintedAt(region, pos)
  // counted over the rows being ordered, not over the data, so a subtree filter
  // sizes the blocks by what is actually on screen
  const blockSize = new Map<number, number>()
  for (const { name } of sources) {
    const color = colorByRow.get(name)
    if (color !== undefined) {
      blockSize.set(color, (blockSize.get(color) ?? 0) + 1)
    }
  }
  return orderRowsByValueAt(
    sources,
    colorByRow,
    (a, b) => blockSize.get(b)! - blockSize.get(a)! || a - b,
  )
}
