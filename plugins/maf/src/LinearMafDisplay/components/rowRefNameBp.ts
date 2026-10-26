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
export type RowRefNameBp = Map<number, Map<string, StrandBp>>

/**
 * Per region, keyed on the region object, since `placeMafRegionData` builds a
 * fresh one per fetch and reorder, when its baked `rowIndex` stops being true.
 */
const regionCache = new WeakMap<MafRegionData, RowRefNameBp>()

function addBp(
  totals: RowRefNameBp,
  rowIndex: number,
  srcRefName: string,
  fwd: number,
  rev: number,
) {
  let byRefName = totals.get(rowIndex)
  if (byRefName === undefined) {
    byRefName = new Map()
    totals.set(rowIndex, byRefName)
  }
  const t = byRefName.get(srcRefName)
  if (t === undefined) {
    byRefName.set(srcRefName, { fwd, rev })
  } else {
    t.fwd += fwd
    t.rev += rev
  }
}

function regionRowRefNameBp(region: MafRegionData) {
  let totals = regionCache.get(region)
  if (totals === undefined) {
    totals = new Map()
    for (const block of region.blocks) {
      const len = block.endBp - block.startBp
      for (const row of block.rows) {
        if (row.srcRefName !== undefined) {
          const rev = row.strand === -1
          addBp(
            totals,
            row.rowIndex,
            row.srcRefName,
            rev ? 0 : len,
            rev ? len : 0,
          )
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
export function rowRefNameBp(regions: Iterable<MafRegionData>): RowRefNameBp {
  const totals: RowRefNameBp = new Map()
  for (const region of regions) {
    for (const [rowIndex, byRefName] of regionRowRefNameBp(region)) {
      for (const [srcRefName, { fwd, rev }] of byRefName) {
        addBp(totals, rowIndex, srcRefName, fwd, rev)
      }
    }
  }
  return totals
}
