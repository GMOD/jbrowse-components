import { keySlot } from '@jbrowse/render-core/marks'
import { orderRowsByValueAt } from '@jbrowse/tree-sidebar'

import { featureSpanContainsBp } from '../shared/featureSpanBp.ts'

import type { MultiRowEncoded } from './rendering/multiRowChannels.ts'
import type { RowKeys, RowTable } from '@jbrowse/render-core/marks'

export type RowValueChannels = Pick<
  MultiRowEncoded,
  'x' | 'x2' | 'row' | 'color' | 'count'
>

// Read off the encode, which has already dropped what a hidden legend category
// hides. Where features overlap the last one wins, matching paint order.
function colorsPaintedAt(
  encoded: RowValueChannels,
  rowKeys: RowKeys,
  pos: number,
) {
  const byRow = new Map<string, number>()
  for (let c = 0; c < encoded.count; c++) {
    if (featureSpanContainsBp(encoded.x[c]!, encoded.x2[c]!, pos)) {
      byRow.set(rowKeys.names[encoded.row[c]!]!, encoded.color[c]!)
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
  encoded: RowValueChannels,
  pos: number,
  rowKeys: RowKeys,
  rowTable: RowTable,
): T[] {
  const colorByRow = colorsPaintedAt(encoded, rowKeys, pos)
  // Sized over the rows on screen, not over `sources`, which arrives unfiltered
  // so that hidden rows keep their place and overrides. Every color the column
  // carries is seeded at zero, so a block whose rows are all filtered away
  // still compares as a number.
  const blockSize = new Map<number, number>(
    [...colorByRow.values()].map(color => [color, 0]),
  )
  for (const { name } of sources) {
    const color = colorByRow.get(name)
    const key = rowKeys.lookup(name)
    if (
      color !== undefined &&
      key !== undefined &&
      keySlot(key, rowTable) !== undefined
    ) {
      blockSize.set(color, blockSize.get(color)! + 1)
    }
  }
  return orderRowsByValueAt(
    sources,
    colorByRow,
    (a, b) => blockSize.get(b)! - blockSize.get(a)! || a - b,
  )
}
