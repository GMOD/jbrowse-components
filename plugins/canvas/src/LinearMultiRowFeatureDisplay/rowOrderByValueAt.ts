import { orderRowsByValueAt } from '@jbrowse/tree-sidebar'

import { featureSpanContainsBp } from '../shared/featureSpanBp.ts'

import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
} from './rendering/multiRowRenderingBackendTypes.ts'

export type RowValueRegion = Pick<
  MultiRowRegionData,
  | 'featureStarts'
  | 'featureEnds'
  | 'featureColors'
  | 'partitionValues'
  | 'featurePartitionIndex'
>

// A feature in a legend category the user toggled off paints nothing, unless
// its row carries a per-row color override — the legend never lists that
// color, so a baked color coinciding with a hidden category must not hide it.
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

// Where features overlap the last one that paints wins, matching paint order.
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

// Order rows by the ABGR color each paints at one genomic column, grouping
// equal-valued rows contiguously. Blocks come largest first rather than by
// color value, so recoloring the track does not rearrange the same rows over
// the same locus; equal-sized blocks fall back to the color for determinism.
export function rowOrderByValueAt<T extends { name: string }>(
  sources: T[],
  region: RowValueRegion,
  pos: number,
  paint: MultiRowFeaturePaintInputs,
): T[] {
  const colorByRow = colorsPaintedAt(region, pos, paint)
  // Sized over the rows on screen, not over `sources`, which arrives unfiltered
  // so that hidden rows keep their place and overrides. Every color the column
  // carries is seeded at zero, so a block whose rows are all filtered away
  // still compares as a number.
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
