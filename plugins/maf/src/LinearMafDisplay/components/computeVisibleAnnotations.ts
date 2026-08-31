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
  // Thin CDS strip pinned to the bottom of the row band.
  const stripH = Math.max(2, Math.round(h * 0.25))
  const stripOffset = offset + h - stripH

  for (const { data: records, bpToPx, bpLo, bpHi } of eachVisibleRegion(
    view,
    framesDataMap,
  )) {
    for (const r of records) {
      // One record per CDS exon per species over the *buffered* region, so a
      // gene-dense window across a deep alignment is a lot of them and about
      // half are off screen. Same `[bpLo, bpHi)` cull as the block overlays,
      // tested before the `src` lookup it skips.
      if (r.end <= bpLo || r.start >= bpHi) {
        continue
      }
      const rowIndex = rowIndexBySrc.get(r.src)
      if (rowIndex !== undefined && rowIndex >= firstRow && rowIndex < endRow) {
        const { xLeft, width } = bpSpanPx(bpToPx, r.start, r.end)
        markers.push({
          xLeft,
          // >=1px so a single-base CDS segment still reads
          width: Math.max(1, width),
          rowTop: stripOffset + rowHeight * rowIndex,
          h: stripH,
          colorIndex: frameColorIndex(r.frame, r.strand),
        })
      }
    }
  }
  return markers
}
