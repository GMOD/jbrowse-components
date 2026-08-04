import {
  bpSpanPx,
  eachVisibleRegion,
  rowBandGeometry,
  visibleRowRange,
} from './visibleRegionGeometry.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafOverlayParams, PxSpan } from './visibleRegionGeometry.ts'

export interface InversionMarker {
  xLeft: number
  width: number
  rowTop: number
  h: number
}

interface ComputeVisibleInversionsParams extends MafOverlayParams {
  /**
   * The orientation each (row, source chromosome) is measured against, from
   * `consensusStrandByRowChr` over *all* loaded regions. Passed in rather than
   * derived here: that walk covers every block × row the display holds — the
   * buffered region, so far more than is on screen — while this runs on every
   * pan and zoom. The model memoizes it (`inversionConsensus`), the same move
   * `sourceChromRanks` made for color-by-source-chromosome.
   */
  consensus: ReadonlyMap<string, number>
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
 * data — hence a real map of every loaded region rather than the structural
 * `RegionDataMap` the visible-region walks take. `+1` when forward bases are at
 * least as many as reverse, else `−1`.
 */
export function consensusStrandByRowChr(
  rpcDataMap: ReadonlyMap<number, MafRegionData>,
): Map<string, number> {
  const totals = new Map<string, { fwd: number; rev: number }>()
  for (const region of rpcDataMap.values()) {
    for (const block of region.blocks) {
      const len = block.endBp - block.startBp
      for (const row of block.rows) {
        if (row.strand !== undefined && row.chr !== undefined) {
          const key = rowChrKey(row.rowIndex, row.chr)
          let t = totals.get(key)
          if (t === undefined) {
            t = { fwd: 0, rev: 0 }
            totals.set(key, t)
          }
          if (row.strand === -1) {
            t.rev += len
          } else {
            t.fwd += len
          }
        }
      }
    }
  }
  return new Map([...totals].map(([key, t]) => [key, t.fwd >= t.rev ? 1 : -1]))
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
  const { view, rpcDataMap, rowHeight, rowProportion, scrollTop, consensus } =
    params
  const markers: InversionMarker[] = []
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion, scrollTop)
  const { firstRow, endRow } = visibleRowRange(
    rowHeight,
    scrollTop,
    params.viewportHeight,
  )

  for (const { data: regionData, bpToPx, bpLo, bpHi } of eachVisibleRegion(
    view,
    rpcDataMap,
  )) {
    for (const block of regionData.blocks) {
      if (block.endBp <= bpLo || block.startBp >= bpHi) {
        continue
      }
      // Resolved once per block, not per inverted row: every row of a block
      // spans the same reference extent.
      let span: PxSpan | undefined
      for (const row of block.rows) {
        // The row test comes first: it is two comparisons, while the inversion
        // test builds a key string and hits a map, and with a pinned row height
        // most rows of a deep alignment are scrolled off screen.
        if (
          row.rowIndex >= firstRow &&
          row.rowIndex < endRow &&
          row.strand !== undefined &&
          row.chr !== undefined &&
          row.strand !== consensus.get(rowChrKey(row.rowIndex, row.chr))
        ) {
          span ??= bpSpanPx(bpToPx, block.startBp, block.endBp)
          markers.push({
            xLeft: span.xLeft,
            width: span.width,
            rowTop: offset + rowHeight * row.rowIndex,
            h,
          })
        }
      }
    }
  }
  return markers
}
