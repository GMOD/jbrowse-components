import { spanRect } from '@jbrowse/render-core/canvas2dUtils'

import { frameColorIndex } from '../../LinearMafRenderer/util.ts'
import { eachVisibleRegion, rowViewport } from './visibleRegionGeometry.ts'

import type { MafFrameRecord } from '../../types.ts'
import type {
  MafRowGeometryParams,
  RegionDataMap,
  VisibleRegionsView,
} from './visibleRegionGeometry.ts'

export interface FrameMarker {
  /** screen px of the left edge of the CDS segment */
  xLeft: number
  /** screen px width of the CDS segment */
  width: number
  rowTop: number
  h: number
  /**
   * Plain index into `getFrameColors`, resolved once by `frameColorIndex` so
   * the painter is a lookup and the legend keys itself from the same function.
   */
  colorIndex: number
}

interface ComputeVisibleFramesParams extends MafRowGeometryParams {
  view: VisibleRegionsView
  framesDataMap: RegionDataMap<MafFrameRecord[]>
  /**
   * Resolves a frame row's `src` (species) to its display row index. Rows whose
   * `src` isn't in the current source set are dropped — the frames file can
   * carry species the track doesn't list (mirrors the summary-bar mapping).
   */
  rowIndexBySrc: Map<string, number>
}

/**
 * The CDS frame record covering reference position `pos` (0-based, half-open)
 * on display `rowIndex`, matched to its species via `rowIndexBySrc`. Returns
 * the first match; powers the tooltip's gene readout.
 */
export function findFrameAt(
  records: MafFrameRecord[] | undefined,
  pos: number,
  rowIndex: number,
  rowIndexBySrc: Map<string, number>,
): MafFrameRecord | undefined {
  return records?.find(
    r => pos >= r.start && pos < r.end && rowIndexBySrc.get(r.src) === rowIndex,
  )
}

/**
 * Positioned per-species CDS frame markers for the frames strip: one
 * frame-colored strip per `mafFrames` row, on its `src` species' row. The strip
 * is a thin band at the bottom of the row so it does not hide the base coloring
 * beneath.
 */
export function computeVisibleFrames(
  params: ComputeVisibleFramesParams,
): FrameMarker[] {
  const { view, framesDataMap, rowIndexBySrc, rowHeight } = params
  const markers: FrameMarker[] = []
  const { h, offset, firstRow, endRow } = rowViewport(params)
  // A quarter of the drawn band, floored at 2px and capped at half of it, so
  // the strip stays a band on the row instead of replacing its coloring.
  const stripH = Math.min(h / 2, Math.max(2, Math.round(h * 0.25)))
  const stripOffset = offset + h - stripH

  for (const { data: records, bpToPx, overlaps } of eachVisibleRegion(
    view,
    framesDataMap,
  )) {
    for (const r of records) {
      // Culled before the `src` lookup: the buffered region holds a record per
      // CDS exon per species, about half off screen.
      if (!overlaps(r.start, r.end)) {
        continue
      }
      const rowIndex = rowIndexBySrc.get(r.src)
      if (rowIndex !== undefined && rowIndex >= firstRow && rowIndex < endRow) {
        // >=1px so a single-base CDS segment still reads
        const { left: xLeft, width } = spanRect(bpToPx, r.start, r.end, 1)
        markers.push({
          xLeft,
          width,
          rowTop: stripOffset + rowHeight * rowIndex,
          h: stripH,
          colorIndex: frameColorIndex(r.frame, r.strand),
        })
      }
    }
  }
  return markers
}
