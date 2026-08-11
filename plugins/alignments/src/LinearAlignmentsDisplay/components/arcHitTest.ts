import { clampBlockScissor } from '@jbrowse/render-core'

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
  // The whole canvas, `renderState.canvasWidth`. NOT the shader's `canvasW`:
  // both renderers upload the BLOCK's clamped width there (`scissorW`), and
  // this is the input that clamp is taken against — see `clampBlockScissor`
  // below for why the difference is the whole bug.
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
  // The shader's `canvasW`, and it is the BLOCK's clamped width, not the
  // canvas's. Both renderers upload `scissorW` there — GPU `f[U.canvasW] =
  // scissorW`, Canvas2D `drawArcs(…, scissorW)` — and `arcIsFar` is
  // `2 * halfWidth > canvasW`, the test that decides whether a pair draws as a
  // dome or degenerates to a semicircle showing two near-vertical legs.
  //
  // Handing the full track width here instead put the hit test on a different
  // side of that test from the paint whenever a block is narrower than the
  // canvas — every multi-region view, and any region partly scrolled off. The
  // draw flipped to the semicircle first, and until the hit test caught up it
  // was measuring an ellipse dome (`ry = 0.75 * arcH`, inside the band) against
  // a painted circle of radius `halfWidth` (apex far above it): not a near
  // miss, a different curve, so the hover went dead across that whole zoom
  // window rather than drifting by a pixel.
  //
  // `clampBlockScissor` is the renderers' own helper rather than a third
  // spelling of floor/ceil/clamp, because that is the shape this bug already
  // took once.
  const scissor = clampBlockScissor(
    region.screenStartPx,
    region.screenEndPx,
    canvasWidthPx,
  )
  if (!scissor) {
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
    screenWidthPx: scissor.scissorW,
  })
}
