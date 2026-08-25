import { orderRowsByValueAt } from '@jbrowse/tree-sidebar'

import { blockIndexAtBp } from '../LinearMafRenderer/blockAtBp.ts'
import { DASH, LOWER_BIT, SPACE } from '../util/asciiBytes.ts'
import { alignedColumnAt } from './components/findRowHover.ts'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

// The row's own gap in the reference column, which is a value of its own: a
// deletion shared by half the rows is as much a grouping as a base is.
const GAP = '-'

/**
 * Rows ordered by the base each species carries in the reference column at
 * `bp` — the MAF analogue of the multi-row painting's "sort rows by color here"
 * and of alignments' "sort by base at position". Rows sharing a base become one
 * contiguous block, so a SNP that splits a cohort reads as a split.
 *
 * Blocks are ordered largest first, then by base, with the rows deleting the
 * column after every base and the rows with no aligned block at the column
 * after those (`orderRowsByValueAt`'s missing-last rule). Commonest first is a
 * statement a reader can check; ordering by the base's own letter would put
 * the same rows in a different order over an A/T site than over a C/G one.
 *
 * `drawnRows` are the rows the region's `rowIndex` numbering names (the
 * display's `sources`), and `rows` are what gets ordered (`editableSources`,
 * unfiltered by the subtree so a focused clade does not persist itself as the
 * whole order). Case is folded: a soft-masked base is the same base.
 */
export function orderMafRowsByBaseAt<T extends { name: string }>(
  rows: T[],
  drawnRows: readonly { name: string }[],
  region: MafRegionData,
  bp: number,
): T[] {
  const baseByName = new Map<string, string>()
  const blockIdx = blockIndexAtBp(region.blocks, bp)
  if (blockIdx !== -1) {
    const block = region.blocks[blockIdx]!
    for (const row of block.rows) {
      const name = drawnRows[row.rowIndex]?.name
      const column =
        name === undefined ? undefined : alignedColumnAt(block, row, bp)
      if (name !== undefined && column) {
        baseByName.set(
          name,
          column.code === DASH || column.code === SPACE
            ? GAP
            : String.fromCharCode(column.code & ~LOWER_BIT),
        )
      }
    }
  }
  const blockSize = new Map<string, number>()
  for (const { name } of rows) {
    const base = baseByName.get(name)
    if (base !== undefined) {
      blockSize.set(base, (blockSize.get(base) ?? 0) + 1)
    }
  }
  return orderRowsByValueAt(
    rows,
    baseByName,
    (a, b) =>
      Number(a === GAP) - Number(b === GAP) ||
      blockSize.get(b)! - blockSize.get(a)! ||
      a.localeCompare(b),
  )
}
