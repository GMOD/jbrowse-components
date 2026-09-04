import { frameColorIndex } from '../../LinearMafRenderer/util.ts'
import {
  bpSpanPx,
  eachVisibleRegion,
  rowViewport,
} from './visibleRegionGeometry.ts'

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
   * the painter is a lookup and the legend can key itself from the same
   * function. Was the frame number with a sign for strand, decoded by the
   * painter through `Array.at`'s negative wrap — correct, and impossible to
   * check without the palette table in front of you.
   */
  colorIndex: number
}

interface ComputeVisibleAnnotationsParams extends MafRowGeometryParams {
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
 * The CDS frame record covering reference position `pos` (0-based, half-open
 * `[start, end)`) on display `rowIndex`, matched to its species via
 * `rowIndexBySrc` — the same projection the overlay draws with. Returns the
 * first match (per-species CDS frames for one gene don't overlap). Powers the
 * tooltip's gene/reading-frame readout.
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
 * Positioned per-species CDS frame markers for the annotation overlay: one
 * frame-colored strip per `mafFrames` row, on the row of its `src` species,
 * spanning the row's reference extent. The strip is a thin band at the bottom
 * of each row rather than the full band, so it annotates the CDS structure
 * without hiding the base/SNP coloring drawn underneath at base level. Mirrors
 * `computeVisibleSummaryBars`' `src`→row mapping and compositing.
 */
export function computeVisibleAnnotations(
  params: ComputeVisibleAnnotationsParams,
): FrameMarker[] {
  const { view, framesDataMap, rowIndexBySrc, rowHeight } = params
  const markers: FrameMarker[] = []
  const { h, offset, firstRow, endRow } = rowViewport(params)
  // A quarter of the drawn band, floored at 2px but never more than half of it:
  // `h` itself floors at the shader's MIN_DRAWN_ROW_PX, so on a deep alignment
  // the 2px minimum alone was taller than the band and spanned the rows either
  // side, and capping at `h` merely replaced the row's own colouring with the
  // frame colour. Half is what keeps this a band ON the row rather than instead
  // of it.
  const stripH = Math.min(h / 2, Math.max(2, Math.round(h * 0.25)))
  const stripOffset = offset + h - stripH

  for (const { data: records, bpToPx, overlaps } of eachVisibleRegion(
    view,
    framesDataMap,
  )) {
    for (const r of records) {
      // One record per CDS exon per species over the *buffered* region, so a
      // gene-dense window across a deep alignment is a lot of them and about
      // half are off screen. Culled before the `src` lookup it skips.
      if (!overlaps(r.start, r.end)) {
        continue
      }
      const rowIndex = rowIndexBySrc.get(r.src)
      if (rowIndex !== undefined && rowIndex >= firstRow && rowIndex < endRow) {
        // >=1px so a single-base CDS segment still reads
        const { xLeft, width } = bpSpanPx(bpToPx, r.start, r.end, 1)
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
