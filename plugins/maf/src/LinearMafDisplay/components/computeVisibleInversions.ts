import { spanRect } from '@jbrowse/render-core/canvas2dUtils'

import { regionInvertedRows } from './mafRowEvents.ts'
import { rowChromBp } from './rowChromBp.ts'
import { eachVisibleRegion, rowViewport } from './visibleRegionGeometry.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafOverlayParams } from './visibleRegionGeometry.ts'

export interface InversionMarker {
  xLeft: number
  width: number
  /** the part of the block on screen, which is all the hatch covers */
  visibleLeft: number
  visibleWidth: number
  rowTop: number
  h: number
}

/**
 * The orientation each (display row, source chromosome) is measured against,
 * nested `rowIndex -> chr -> ±1` so the per-frame marker walk builds no joined
 * string key per cell.
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
  const consensus = new Map<number, Map<string, number>>()
  for (const [rowIndex, byChr] of rowChromBp(rpcDataMap.values())) {
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
 * A projection over `regionInvertedRows`, which decides *which* (block, row)
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

  for (const {
    data: regionData,
    bpToPx,
    overlaps,
    visibleStart,
    visibleEnd,
  } of eachVisibleRegion(view, rpcDataMap)) {
    const invertedRows = regionInvertedRows(regionData, consensus)
    const { blocks } = regionData
    const edgeA = bpToPx(visibleStart)
    const edgeB = bpToPx(visibleEnd)
    const visibleLo = Math.min(edgeA, edgeB)
    const visibleHi = Math.max(edgeA, edgeB)
    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b]!
      if (!overlaps(block.startBp, block.endBp)) {
        continue
      }
      let span: ReturnType<typeof spanRect> | undefined
      for (const row of invertedRows(b)) {
        if (row >= firstRow && row < endRow) {
          span ??= spanRect(bpToPx, block.startBp, block.endBp)
          const visibleLeft = Math.min(
            Math.max(span.left, visibleLo),
            visibleHi,
          )
          markers.push({
            xLeft: span.left,
            width: span.width,
            visibleLeft,
            visibleWidth:
              Math.max(
                visibleLeft,
                Math.min(span.left + span.width, visibleHi),
              ) - visibleLeft,
            rowTop: offset + rowHeight * row,
            h,
          })
        }
      }
    }
  }
  return markers
}
