import { regionInversionEvents } from './mafRowEvents.ts'
import {
  bpSpanPx,
  eachVisibleRegion,
  rowViewport,
} from './visibleRegionGeometry.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafOverlayParams, PxSpan } from './visibleRegionGeometry.ts'

export interface InversionMarker {
  xLeft: number
  width: number
  rowTop: number
  h: number
}

/**
 * The orientation each (display row, source chromosome) is measured against.
 * Nested `rowIndex -> chr -> ±1` rather than one map under a `${row}\t${chr}`
 * key, which is what this used to be, because both halves of the pair are
 * per-cell: the consensus walk visits every block × row the display holds and
 * the marker walk visits every block × row on screen, so a joined key built one
 * throwaway string per cell — over a million per pass on the UCSC ce11 26-way,
 * and on the marker side once per frame. The nested form is two integer/string
 * hashes and allocates nothing. Same shape, for the same reason, as
 * `perRowChromRanks`'s ranks.
 */
export type StrandConsensus = ReadonlyMap<number, ReadonlyMap<string, number>>

interface ComputeVisibleInversionsParams extends MafOverlayParams {
  /**
   * From `consensusStrandByRowChr` over *all* loaded regions. Passed in rather
   * than derived here: that walk covers every block × row the display holds —
   * the buffered region, so far more than is on screen — while this runs on
   * every pan and zoom. The model memoizes it (`inversionConsensus`), the same
   * move `sourceChromRanks` made for color-by-source-chromosome.
   */
  consensus: StrandConsensus
}

/**
 * Length-weighted consensus strand for each (row, source chromosome) across all
 * loaded blocks, so the consensus is stable as the user scrolls within loaded
 * data — hence a real map of every loaded region rather than the structural
 * `RegionDataMap` the visible-region walks take. `+1` when forward bases are at
 * least as many as reverse, else `−1`.
 *
 * Scored per (row, source chromosome) because a scaffold's overall alignment
 * orientation is arbitrary: an inversion is a block whose strand differs from
 * the consensus of its *own* scaffold's alignment, not simply any `−`-strand
 * block.
 */
export function consensusStrandByRowChr(
  rpcDataMap: ReadonlyMap<number, MafRegionData>,
): Map<number, Map<string, number>> {
  const totals = new Map<number, Map<string, { fwd: number; rev: number }>>()
  for (const region of rpcDataMap.values()) {
    for (const block of region.blocks) {
      const len = block.endBp - block.startBp
      for (const row of block.rows) {
        if (row.strand !== undefined && row.chr !== undefined) {
          let byChr = totals.get(row.rowIndex)
          if (byChr === undefined) {
            byChr = new Map()
            totals.set(row.rowIndex, byChr)
          }
          let t = byChr.get(row.chr)
          if (t === undefined) {
            t = { fwd: 0, rev: 0 }
            byChr.set(row.chr, t)
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
  const consensus = new Map<number, Map<string, number>>()
  for (const [rowIndex, byChr] of totals) {
    consensus.set(
      rowIndex,
      new Map([...byChr].map(([chr, t]) => [chr, t.fwd >= t.rev ? 1 : -1])),
    )
  }
  return consensus
}

/**
 * Positioned markers for blocks that align inverted relative to their own
 * scaffold's consensus orientation — the strand-flip SV indicator. Drawn as an
 * overlay on top of whatever the rows show (bases/codon/identity), so an
 * inversion is visible without switching rendering mode.
 *
 * A projection over `regionInversionEvents`, which decides *which* (block, row)
 * pairs are inverted once per (region, consensus) rather than on every frame.
 * The test it replaces was two map hits per block × row of every visible region
 * — over a million per frame on the ce11 26-way shape — to reach a verdict that
 * only two map hits per *pan* could ever change, and by construction almost all
 * of them say "not inverted".
 */
export function computeVisibleInversions(
  params: ComputeVisibleInversionsParams,
): InversionMarker[] {
  const { view, rpcDataMap, rowHeight, consensus } = params
  const markers: InversionMarker[] = []
  const { h, offset, firstRow, endRow } = rowViewport(params)

  for (const { data: regionData, bpToPx, bpLo, bpHi } of eachVisibleRegion(
    view,
    rpcDataMap,
  )) {
    const events = regionInversionEvents(regionData, consensus)
    const { blocks } = regionData
    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b]!
      if (block.endBp <= bpLo || block.startBp >= bpHi) {
        continue
      }
      const { from, to } = events.ensure(b)
      const { positionBp, rowIndex, length } = events
      // Resolved once per block, not per inverted row: every row of a block
      // spans the same reference extent.
      let span: PxSpan | undefined
      for (let e = from; e < to; e++) {
        const row = rowIndex[e]!
        if (row >= firstRow && row < endRow) {
          span ??= bpSpanPx(bpToPx, positionBp[e]!, positionBp[e]! + length[e]!)
          markers.push({
            xLeft: span.xLeft,
            width: span.width,
            rowTop: offset + rowHeight * row,
            h,
          })
        }
      }
    }
  }
  return markers
}
