import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

/** Aligned reference bp on each strand; a row with no strand counts forward. */
export interface StrandBp {
  fwd: number
  rev: number
}

/**
 * `rowIndex -> chr -> StrandBp`, nested rather than keyed on a joined string
 * so the walk over every block × row allocates nothing per cell.
 */
export type RowChromBp = Map<number, Map<string, StrandBp>>

/**
 * Per region, so a region landing walks only itself, and keyed on the region
 * object: `placeMafRegionData` builds a fresh one per fetch and per row
 * reorder, which is when its baked `rowIndex` stops being true.
 */
const regionCache = new WeakMap<MafRegionData, RowChromBp>()

function addBp(
  totals: RowChromBp,
  rowIndex: number,
  chr: string,
  fwd: number,
  rev: number,
) {
  let byChr = totals.get(rowIndex)
  if (byChr === undefined) {
    byChr = new Map()
    totals.set(rowIndex, byChr)
  }
  const t = byChr.get(chr)
  if (t === undefined) {
    byChr.set(chr, { fwd, rev })
  } else {
    t.fwd += fwd
    t.rev += rev
  }
}

function regionRowChromBp(region: MafRegionData) {
  let totals = regionCache.get(region)
  if (totals === undefined) {
    totals = new Map()
    for (const block of region.blocks) {
      const len = block.endBp - block.startBp
      for (const row of block.rows) {
        if (row.chr !== undefined) {
          const rev = row.strand === -1
          addBp(totals, row.rowIndex, row.chr, rev ? 0 : len, rev ? len : 0)
        }
      }
    }
    regionCache.set(region, totals)
  }
  return totals
}

/**
 * Aligned bp per (display row, source chromosome) across `regions`, split by
 * the row's strand: the one walk behind both the source-chromosome ranks and
 * the inversion consensus.
 */
export function rowChromBp(regions: Iterable<MafRegionData>): RowChromBp {
  const totals: RowChromBp = new Map()
  for (const region of regions) {
    for (const [rowIndex, byChr] of regionRowChromBp(region)) {
      for (const [chr, { fwd, rev }] of byChr) {
        addBp(totals, rowIndex, chr, fwd, rev)
      }
    }
  }
  return totals
}
