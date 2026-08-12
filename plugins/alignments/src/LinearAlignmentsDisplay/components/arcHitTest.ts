import { clampBlockScissor } from '@jbrowse/render-core/canvas2dUtils'

import { arcLineWidth } from '../../features/arcs/arcLineWidth.ts'
import {
  arcLineScreenPath,
  arcScreenPath,
} from '../../features/arcs/arcPath.ts'
import { arcAvailH, arcYScale } from '../../features/arcs/arcYScale.ts'
import { hitTestArcBand } from '../../features/arcs/hitTest.ts'
import { arcPlacement } from '../../features/arcs/placement.ts'
import { hasArcBandInk } from '../../features/arcs/types.ts'
import { ARC_APEX_FRACTION } from '../../shaders/slang/arc.iface.generated.ts'
import { arcRadiiPx } from '../../shaders/slang/arc.js.generated.ts'
import { bandScreenTop, makeBpToPx } from './sectionScreen.ts'

import type {
  ArcBandHitResult,
  ArcHitOptions,
} from '../../features/arcs/hitTest.ts'
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

// Everything an arc hover produces: the arc, and the ink to draw over it.
//
// `hit` feeds the tooltip and `highlight` feeds the overlay — one field each,
// both off one projection, so the mark cannot land anywhere but on the arc the
// tooltip is describing.
export interface ArcBandHover {
  hit: ArcBandHitResult
  highlight: ArcHighlight
}

// Flat on purpose: an SVG path, the rect to clip it to, and a stroke width. The
// overlay strokes it and nothing else reads it, so there is nothing here to
// destructure twice.
//
// The clip rect is BOTH axes, because the arc pass is scissored on both: the GPU
// takes `scissorX`/`scissorW` and Canvas2D takes
// `ctx.rect(scissorX, arcBand.top, scissorW, arcBand.height)`. The vertical half
// was carried from the start, for the reason `resolveArcBandHover` gives — a far
// pair's semicircle rises hundreds of px above a band tens of px tall. The
// horizontal half is the same argument turned sideways and it was missing: that
// same semicircle also runs `rx` px SIDEWAYS from its midpoint, `rx` being half
// the pair's on-screen span, so an off-screen-mate or cross-region arc traced a
// highlight straight out of the block the renderer had cut it at — across the
// neighbouring region's arcs, marking pixels no arc was painted on. Invisible in
// the single full-width-block view and only there.
export interface ArcHighlight {
  d: string
  clipLeft: number
  clipWidth: number
  clipTop: number
  clipHeight: number
  lineWidth: number
}

// The block's own clamped screen span, carried alongside the hit-test frame
// because every consumer that draws over the band has to clip to it. Its WIDTH
// is already `ArcHitOptions.screenWidthPx` — the two are one number, the
// renderers' `scissorW` — so only the left edge is new.
interface ArcBandScale extends ArcHitOptions {
  clipLeft: number
}

// The screen-space frame one section's arc band draws in: the bp→x projection,
// the Y scale, the band rect, the far/near width and the block's scissor.
// Private, because computing it twice is the whole class of bug this file exists
// to avoid — the hit, the highlight and the debug geometry below are all taken
// from one call.
function arcBandScreenScale(opts: ArcHitBandOptions): ArcBandScale | undefined {
  const { region, band, scroll, lineWidth, arcsYDomainBp, canvasWidthPx } = opts
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
  return {
    bpToScreenX: makeBpToPx(region, bpPerPx),
    arcsYDomainBp: domainBp,
    arcsYLog: log,
    arcsTop: bandScreenTop(band.arcBandTop, scroll),
    arcsH,
    pairedArcsDown: band.arcDown,
    lineWidth,
    screenWidthPx: scissor.scissorW,
    clipLeft: scissor.scissorX,
  }
}

// One arc's geometry, spelled out for the debug overlay.
export interface ArcDebugShape {
  d: string
  // A read-cloud bar rather than a dome. The radii below then describe the
  // ellipse this arc WOULD have drawn in arc mode, which is worth saying out
  // loud next to them rather than letting them read as the mark on screen.
  isFlat: boolean
  rx: number
  ry: number
  // `arcRadiiPx` returns an equal pair only on the far branch, so this reads the
  // branch off the radii rather than re-asking `arcIsFar` — the same rule
  // `curveDistance` follows, and the reason the predicate is js-skipped.
  far: boolean
  x1: number
  x2: number
  yBp: number
  support: number
}

// Every arc in one band, with the numbers behind its shape — the debug
// visualization's whole content.
//
// It goes through `arcScreenPath`, NOT a second placement, because the question
// a debug overlay has to answer is "what does the renderer think this arc is",
// and a lookalike traced beside it would answer a different one. If these paths
// do not sit on the painted arcs, that disagreement IS the finding.
export interface ArcDebugGeometry {
  shapes: ArcDebugShape[]
  arcsTop: number
  arcsH: number
  // Where a dome's apex used to be pinned before the clamp came off. Drawn as a
  // reference line: ink lying along it is the clamped-plateau signature, so the
  // overlay can tell "this arc is genuinely flat here" from "something is still
  // clamping".
  legacyCeilingY: number
  // The block's scissor — left edge, and the width that is also the shader's
  // `canvasW`. The overlay draws its band rect AT these and clips its traced
  // paths to them, which matters more here than anywhere: this overlay's whole
  // contract is that a path not sitting on its painted arc IS the finding, so a
  // full-width trace over a block-clipped paint manufactures one. It also drew
  // every region's band as the same full-width rect, which in the multi-region
  // view the region loop was added to serve stacked them into one.
  clipLeft: number
  screenWidthPx: number
}

export function resolveArcBandDebug(
  arcs: ArcsUploadData | undefined,
  opts: ArcHitBandOptions,
): ArcDebugGeometry | undefined {
  // `numArcs`, NOT `hasArcBandInk` — and the difference from `resolveArcBandHover`
  // below is deliberate. This overlay answers "why is this arc THIS SHAPE", and a
  // connector tick has no shape question: it is a vertical at a bp. A feed of
  // ticks alone has nothing here to draw, so widening the gate would paint a band
  // rect and an apex ceiling over a band with no shapes under either.
  if (!arcs || arcs.numArcs === 0 || opts.band.arcBandHeight === 0) {
    return undefined
  }
  const scale = arcBandScreenScale(opts)
  if (!scale) {
    return undefined
  }
  const { arcsTop, arcsH, pairedArcsDown, screenWidthPx, clipLeft } = scale
  const shapes: ArcDebugShape[] = []
  for (let i = 0; i < arcs.numArcs; i++) {
    // `arcPlacement`, not a second reading of the Y scale beside it. The
    // overlay's whole job is to say what the RENDERER thinks an arc is, and it
    // was answering from its own projection — which is how it came to spell the
    // Y rule twice and had to be edited again when `arcDomeDestY` was reverted
    // away. `arcScreenPath` below already goes through the placement, so the
    // numbers and the ink now come from one call rather than two agreeing ones.
    const { sx1, sx2, destY, isFlat } = arcPlacement(arcs, i, scale)
    const [rx, ry] = arcRadiiPx(Math.abs(sx2 - sx1) / 2, destY, screenWidthPx)
    shapes.push({
      d: arcScreenPath(arcs, i, scale),
      isFlat,
      rx,
      ry,
      far: rx === ry,
      x1: arcs.arcX1[i]!,
      x2: arcs.arcX2[i]!,
      yBp: arcs.arcYBp[i]!,
      support: arcs.arcSupport[i]!,
    })
  }
  const ceiling = ARC_APEX_FRACTION * arcAvailH(arcsH)
  return {
    shapes,
    arcsTop,
    arcsH,
    legacyCeilingY: pairedArcsDown
      ? arcsTop + ceiling
      : arcsTop + arcsH - ceiling,
    clipLeft,
    screenWidthPx,
  }
}

// Resolve a hover over one section's arc band: project the band once, ask what
// is under the cursor, ask where that mark's ink is. Undefined when the section
// reserves no band (`arcBandHeight` 0 — arcs off, or a lane whose reads produced
// none), which is also the gate the renderers use to skip the pass.
//
// The emptiness test is `anyArcsDrawn`'s, not `numArcs === 0`: a lane can carry
// nothing but interchromosomal ticks — a translocation at the edge of a region
// with no intra-chromosomal pair in view is exactly that — and gating on the arc
// count alone made those the one band that reserved space, painted ink, and
// answered no hover at all.
export function resolveArcBandHover(
  canvasX: number,
  canvasY: number,
  arcs: ArcsUploadData | undefined,
  opts: ArcHitBandOptions,
): ArcBandHover | undefined {
  if (!arcs || !hasArcBandInk(arcs) || opts.band.arcBandHeight === 0) {
    return undefined
  }
  const scale = arcBandScreenScale(opts)
  const hit = scale && hitTestArcBand(canvasX, canvasY, arcs, scale)
  return scale && hit
    ? {
        hit,
        highlight: {
          d:
            hit.kind === 'tick'
              ? arcLineScreenPath(arcs, hit.index, scale)
              : arcScreenPath(arcs, hit.index, scale),
          // The arc pass's own clip, on BOTH axes — see `ArcHighlight`. Not
          // decoration: a far pair's semicircle rises hundreds of px above a
          // band tens of px tall and runs as far again to either side, and the
          // renderers cut it at the band and at the block, so an unclipped
          // highlight traces a curve across the coverage histogram and across
          // the next region that no arc was ever painted on.
          clipLeft: scale.clipLeft,
          clipWidth: scale.screenWidthPx,
          clipTop: scale.arcsTop,
          clipHeight: scale.arcsH,
          // Never thinner than the mark's own ink, so the highlight reads as it
          // lighting up rather than as a second, finer curve laid beside a
          // heavy one. One `arcLineWidth` call for both families, since ticks
          // take their width from support on the same curve the arcs do.
          lineWidth: arcLineWidth(hit.support, scale.lineWidth),
        },
      }
    : undefined
}
