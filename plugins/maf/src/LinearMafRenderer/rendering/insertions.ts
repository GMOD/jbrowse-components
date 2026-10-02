import { EMPTY_INSERTIONS } from '@jbrowse/alignments-core'

import { blockHasRefGap, forEachInsertion } from './forEachInsertion.ts'

import type { MafRegionData } from '../mafRenderingBackendTypes.ts'
import type { InsertionChannels } from '@jbrowse/alignments-core'

type Placed = Omit<InsertionChannels, 'color'>

const placedCache = new WeakMap<MafRegionData, Placed>()

/**
 * Every insertion in a region, as `(anchorBp, rowIndex, length)`: a run of
 * reference-gap columns where a sample carries bases, anchored at the
 * reference base after the run. `blockHasRefGap` answers for every row of a
 * block at once, and most real MAF blocks have no gap. Keyed on the region
 * object, which `placeMafRegionData` replaces per fetch and per row reorder,
 * so a re-encode for a theme or zoom change walks nothing.
 */
function placedInsertions(region: MafRegionData): Placed {
  let placed = placedCache.get(region)
  if (placed === undefined) {
    const x: number[] = []
    const row: number[] = []
    const length: number[] = []
    for (const block of region.blocks) {
      if (blockHasRefGap(block)) {
        for (const r of block.rows) {
          forEachInsertion(
            block.refSeqBytes,
            r.alignmentBytes,
            block.startBp,
            (anchorBp, len) => {
              x.push(anchorBp)
              row.push(r.rowIndex)
              length.push(len)
            },
          )
        }
      }
    }
    const xs = Uint32Array.from(x)
    placed = {
      x: xs,
      x2: xs,
      row: Uint32Array.from(row),
      length: Uint32Array.from(length),
      count: xs.length,
    }
    placedCache.set(region, placed)
  }
  return placed
}

/**
 * The insertion mark's channels for one region: each insertion interbase at
 * its anchor, on its species row, in `insertionAbgr`.
 */
export function mafInsertionChannels(
  region: MafRegionData,
  insertionAbgr: number,
): InsertionChannels {
  const placed = placedInsertions(region)
  return placed.count === 0
    ? EMPTY_INSERTIONS
    : { ...placed, color: new Uint32Array(placed.count).fill(insertionAbgr) }
}
