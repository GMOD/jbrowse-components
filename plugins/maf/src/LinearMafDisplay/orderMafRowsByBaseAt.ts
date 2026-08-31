import { cmpStr } from '@jbrowse/core/util'
import { orderRowsByValueAt } from '@jbrowse/tree-sidebar'

import { blockIndexAtBp } from '../LinearMafRenderer/blockAtBp.ts'
import { DASH, LOWER_BIT, SPACE } from '../util/asciiBytes.ts'
import { refColumnAt } from './components/findRowHover.ts'

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
 * the same rows in a different order over an A/T site than over a C/G one. The
 * last tiebreak is `cmpStr`, not `localeCompare`: this order reaches screenshot
 * renders and worker output, where it has to be reproducible rather than
 * locale-dependent.
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
    // Resolved once for the block, not once per row: which column holds `bp` is
    // a fact about the reference, and this runs over every drawn row of a
    // deep alignment.
    const column = refColumnAt(block, bp)
    if (column !== -1) {
      for (const row of block.rows) {
        const name = drawnRows[row.rowIndex]?.name
        // A malformed file can ship a row shorter than the reference, which has
        // no byte at the column and so no base to group on.
        const code = row.alignmentBytes[column]
        if (name !== undefined && code !== undefined) {
          baseByName.set(
            name,
            code === DASH || code === SPACE
              ? GAP
              : String.fromCharCode(code & ~LOWER_BIT),
          )
        }
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
      cmpStr(a, b),
  )
}
