import { orderRowsByValueAt } from '@jbrowse/tree-sidebar'

import { featureSpanContainsBp } from '../shared/featureSpanBp.ts'

import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
} from './rendering/multiRowRenderingBackendTypes.ts'

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

// `drawnRowAt`'s rule, asked by row name rather than by drawn row index: a
// feature in a legend category the user toggled off paints nothing, unless its
// row carries a per-row color override — that row paints the override, which
// the legend never lists, so a baked color coinciding with a hidden category
// must not hide it.
function paintsAt(
  name: string,
  color: number,
  paint: MultiRowFeaturePaintInputs,
) {
  const rowIndex = paint.rowIndexByValue.get(name)
  return (
    (rowIndex !== undefined &&
      paint.rowColorsByIndex[rowIndex] !== undefined) ||
    !paint.hiddenColors.has(color)
  )
}

// The ABGR color painted at `pos` on each row, for the rows that have one. The
// last covering feature that actually paints wins, matching paint order — the
// same rule the hit test follows for overlapping features.
function colorsPaintedAt(
  region: RowValueRegion,
  pos: number,
  paint: MultiRowFeaturePaintInputs,
) {
  const byRow = new Map<string, number>()
  for (let i = 0; i < region.featureStarts.length; i++) {
    if (
      featureSpanContainsBp(
        region.featureStarts[i]!,
        region.featureEnds[i]!,
        pos,
      )
    ) {
      const name = region.partitionValues[region.featurePartitionIndex[i]!]!
      const color = region.featureColors[i]!
      if (paintsAt(name, color, paint)) {
        byRow.set(name, color)
      }
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
// which asks the same question of a score. A row whose only feature at pos is
// in a hidden legend category sinks with them: it paints nothing there, so it
// carries no value there either.
export function rowOrderByValueAt<T extends { name: string }>(
  sources: T[],
  region: RowValueRegion,
  pos: number,
  paint: MultiRowFeaturePaintInputs,
): T[] {
  const colorByRow = colorsPaintedAt(region, pos, paint)
  // Counted over the rows ON SCREEN rather than over the list being ordered:
  // `sortRowsAtColumn` hands `sources` the unfiltered `editableSources`, so
  // that a hidden row keeps its place and its overrides, and sizing the blocks
  // off it would rank them by rows the reader cannot see. `rowIndexByValue` is
  // built from the drawn `sources`, so the screen set is already here.
  //
  // Seeded at zero for every color the column carries, so a block whose rows
  // are all filtered away still compares as a number.
  const blockSize = new Map<number, number>(
    [...colorByRow.values()].map(color => [color, 0]),
  )
  for (const { name } of sources) {
    const color = colorByRow.get(name)
    if (color !== undefined && paint.rowIndexByValue.has(name)) {
      blockSize.set(color, blockSize.get(color)! + 1)
    }
  }
  return orderRowsByValueAt(
    sources,
    colorByRow,
    (a, b) => blockSize.get(b)! - blockSize.get(a)! || a - b,
  )
}
