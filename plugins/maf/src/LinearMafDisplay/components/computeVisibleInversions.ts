import { eachVisibleRegion, rowBandGeometry } from './visibleRegionGeometry.ts'

import type { VisibleRegionsView } from './visibleRegionGeometry.ts'
import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

export interface InversionMarker {
  xLeft: number
  width: number
  rowTop: number
  h: number
}

// Inversions are scored per (display row, source chromosome): a scaffold's
// overall alignment orientation is arbitrary, so an inversion is a block whose
// strand differs from the *consensus* orientation of its own scaffold's
// alignment — not simply any `−`-strand block. This key groups blocks by that
// pair so the consensus is computed within each scaffold.
function rowChrKey(rowIndex: number, chr: string) {
  return `${rowIndex}\t${chr}`
}

/**
 * Length-weighted consensus strand for each (row, source chromosome) across all
 * loaded blocks, so the consensus is stable as the user scrolls within loaded
 * data. `+1` when forward bases are at least as many as reverse, else `−1`.
 */
function consensusStrandByRowChr(
  rpcDataMap: ReadonlyMap<number, MafRegionData>,
): Map<string, number> {
  const totals = new Map<string, { fwd: number; rev: number }>()
  for (const region of rpcDataMap.values()) {
    for (const block of region.blocks) {
      const len = block.endBp - block.startBp
      for (const row of block.rows) {
        if (row.strand !== undefined && row.chr !== undefined) {
          const key = rowChrKey(row.rowIndex, row.chr)
          const t = totals.get(key) ?? { fwd: 0, rev: 0 }
          if (row.strand === -1) {
            t.rev += len
          } else {
            t.fwd += len
          }
          totals.set(key, t)
        }
      }
    }
  }
  return new Map([...totals].map(([key, t]) => [key, t.fwd >= t.rev ? 1 : -1]))
}

interface ComputeVisibleInversionsParams {
  view: VisibleRegionsView
  rpcDataMap: ReadonlyMap<number, MafRegionData>
  rowHeight: number
  rowProportion: number
}

/**
 * Positioned markers for blocks that align inverted relative to their own
 * scaffold's consensus orientation — the strand-flip SV indicator. Drawn as an
 * overlay on top of whatever the rows show (bases/codon/identity), so an
 * inversion is visible without switching rendering mode.
 */
export function computeVisibleInversions(
  params: ComputeVisibleInversionsParams,
): InversionMarker[] {
  const { view, rpcDataMap, rowHeight, rowProportion } = params
  const consensus = consensusStrandByRowChr(rpcDataMap)
  const markers: InversionMarker[] = []
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion)

  for (const { data: regionData, bpToPx } of eachVisibleRegion(
    view,
    rpcDataMap,
  )) {
    for (const block of regionData.blocks) {
      for (const row of block.rows) {
        const inverted =
          row.strand !== undefined &&
          row.chr !== undefined &&
          row.strand !== consensus.get(rowChrKey(row.rowIndex, row.chr))
        if (inverted) {
          const xa = bpToPx(block.startBp)
          const xb = bpToPx(block.endBp)
          markers.push({
            xLeft: Math.min(xa, xb),
            width: Math.abs(xb - xa),
            rowTop: offset + rowHeight * row.rowIndex,
            h,
          })
        }
      }
    }
  }
  return markers
}
