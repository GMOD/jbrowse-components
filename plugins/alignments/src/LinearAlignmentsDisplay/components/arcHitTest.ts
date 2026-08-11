import { arcAvailH, arcYScale } from '../../features/arcs/arcYScale.ts'
import { hitTestArcs } from '../../features/arcs/hitTest.ts'
import { bandScreenTop, makeBpToPx } from './sectionScreen.ts'

import type { ArcHitResult } from '../../features/arcs/hitTest.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ScrollModel } from './sectionScreen.ts'

// One visible region's screen extent — the slice `view.visibleRegions` reports.
// The renderer maps bp through the whole (possibly off-screen) block instead,
// but both describe the same line, so a bp outside the slice still projects to
// the same x. That is what lets an arc whose mate is off screen be hit-tested
// from the slice the cursor is in.
export interface ArcHitRegion {
  start: number
  end: number
  reversed?: boolean
  screenStartPx: number
  screenEndPx: number
}

// The section's arc band, in CONTENT space — `renderSections` carries it
// straight off the layout, and the projection to screen is `bandScreenTop`,
// which is the same two-tier rule `buildSectionRenders` applies for the draw.
export interface ArcHitBand {
  arcBandTop: number
  arcBandHeight: number
  arcDown: boolean
}

export interface ArcHitBandOptions {
  region: ArcHitRegion
  band: ArcHitBand
  scroll: ScrollModel
  lineWidth: number
  // The read cloud's autoscaled |tlen| domain; undefined in arc mode, where the
  // Y scale falls back to the bp span that fits the band at this zoom. Passed
  // through `arcYScale` so the hover reads the axis the draw plotted onto.
  arcsYDomainBp: number | undefined
  // Mirrors the shader's `canvasW`, which is what decides whether a pair is far
  // enough that its dome degenerates to two legs.
  canvasWidthPx: number
}

// Resolve a hover over one section's arc band. Undefined when the section
// reserves no band (`arcBandHeight` 0 — arcs off, or a lane whose reads produced
// none), which is also the gate the renderers use to skip the pass.
export function hitTestArcBand(
  canvasX: number,
  canvasY: number,
  arcs: ArcsUploadData | undefined,
  opts: ArcHitBandOptions,
): ArcHitResult | undefined {
  const { region, band, scroll, lineWidth, arcsYDomainBp, canvasWidthPx } = opts
  if (!arcs || arcs.numArcs === 0 || band.arcBandHeight === 0) {
    return undefined
  }
  const bpPerPx =
    (region.end - region.start) / (region.screenEndPx - region.screenStartPx)
  if (!(bpPerPx > 0)) {
    return undefined
  }
  const arcsH = band.arcBandHeight
  // Same domain rule `drawArcs` applies, off the same `arcAvailH` — a mismatch
  // would measure against arcs plotted to a different height than they drew at.
  const { domainBp, log } = arcYScale(
    arcsYDomainBp,
    arcAvailH(arcsH),
    1 / bpPerPx,
  )
  return hitTestArcs(canvasX, canvasY, arcs, {
    bpToScreenX: makeBpToPx(region, bpPerPx),
    arcsYDomainBp: domainBp,
    arcsYLog: log,
    arcsTop: bandScreenTop(band.arcBandTop, scroll),
    arcsH,
    pairedArcsDown: band.arcDown,
    lineWidth,
    screenWidthPx: canvasWidthPx,
  })
}
