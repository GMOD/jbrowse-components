import { eachVisibleRegion, rowBandGeometry } from './visibleRegionGeometry.ts'

import type { VisibleRegionsView } from './visibleRegionGeometry.ts'
import type { MafFrameRecord } from '../../types.ts'

export interface FrameMarker {
  /** screen px of the left edge of the CDS segment */
  xLeft: number
  /** screen px width of the CDS segment */
  width: number
  rowTop: number
  h: number
  /**
   * Index into the theme `framesCDS` palette (via `Array.at`): `+`-strand
   * frames are `1..3`, `−`-strand frames `−1..−3` (mirrored), so the same
   * reference reading frame reads as the same color across species rows.
   */
  frameIndex: number
  /** gene that defined the frame, for tooltip/SVG title */
  name: string
}

interface ComputeVisibleAnnotationsParams {
  view: VisibleRegionsView
  framesDataMap: { get(idx: number): MafFrameRecord[] | undefined }
  /**
   * Resolves a frame row's `src` (species) to its display row index. Rows whose
   * `src` isn't in the current source set are dropped — the frames file can
   * carry species the track doesn't list (mirrors the summary-bar mapping).
   */
  rowIndexBySrc: Map<string, number>
  rowHeight: number
  rowProportion: number
}

/**
 * Positioned per-species CDS frame markers for the annotation overlay: one
 * frame-colored strip per `mafFrames` row, on the row of its `src` species,
 * spanning the row's reference extent. The strip is a thin band at the bottom
 * of each row rather than the full band, so it annotates the CDS structure
 * without hiding the base/SNP coloring drawn underneath at base level. Mirrors
 * `computeVisibleSummaryBars`' `src`→row mapping and compositing.
 */
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
    r =>
      pos >= r.start &&
      pos < r.end &&
      rowIndexBySrc.get(r.src) === rowIndex,
  )
}

export function computeVisibleAnnotations(
  params: ComputeVisibleAnnotationsParams,
): FrameMarker[] {
  const { view, framesDataMap, rowIndexBySrc, rowHeight, rowProportion } =
    params
  const markers: FrameMarker[] = []
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion)
  // Thin CDS strip pinned to the bottom of the row band.
  const stripH = Math.max(2, Math.round(h * 0.25))
  const stripOffset = offset + h - stripH

  for (const { data: records, bpToPx } of eachVisibleRegion(
    view,
    framesDataMap,
  )) {
    for (const r of records) {
      const rowIndex = rowIndexBySrc.get(r.src)
      if (rowIndex === undefined) {
        continue
      }
      const x0 = bpToPx(r.start)
      const x1 = bpToPx(r.end)
      const base = (r.frame % 3) + 1
      markers.push({
        xLeft: Math.min(x0, x1),
        width: Math.max(1, Math.abs(x1 - x0)),
        rowTop: stripOffset + rowHeight * rowIndex,
        h: stripH,
        frameIndex: r.strand === -1 ? -base : base,
        name: r.name,
      })
    }
  }
  return markers
}
