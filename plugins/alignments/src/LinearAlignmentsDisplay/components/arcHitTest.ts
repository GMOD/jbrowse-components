import { clampBlockScissor } from '@jbrowse/render-core/canvas2dUtils'

import { arcLineWidth } from '../../features/arcs/arcLineWidth.ts'
import {
  arcLineScreenPath,
  arcScreenPath,
} from '../../features/arcs/arcPath.ts'
import { arcAvailH, arcYScale } from '../../features/arcs/arcYScale.ts'
import { hitTestArcBand } from '../../features/arcs/hitTest.ts'
import { arcMark } from '../../features/arcs/mark.ts'
import { hasArcBandInk } from '../../features/arcs/types.ts'
import { ARC_APEX_FRACTION } from '../../shaders/slang/arc.consts.generated.ts'
import { bandScreenTop, makeBpToPx } from './sectionScreen.ts'

import type {
  ArcBandHitResult,
  ArcHitOptions,
} from '../../features/arcs/hitTest.ts'
import type { ArcMark } from '../../features/arcs/mark.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ScrollModel } from './sectionScreen.ts'
import type { TooltipPayload } from './tooltipUtils.ts'

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

// The rect the arc pass is scissored to, in screen px, spelled as the four SVG
// `<rect>` attributes so an overlay is `<rect {...clip} />` and cannot transpose
// them. BOTH axes, because the pass is cut on both: the GPU takes
// `scissorX`/`scissorW` and Canvas2D takes
// `ctx.rect(scissorX, arcBand.top, scissorW, arcBand.height)`.
//
// The vertical half was carried from the start, for the reason
// `resolveArcBandHover` gives — a far pair's semicircle rises hundreds of px
// above a band tens of px tall. The horizontal half is the same argument turned
// sideways and it was missing: that same semicircle also runs `rx` px SIDEWAYS
// from its midpoint, `rx` being half the pair's on-screen span, so an
// off-screen-mate or cross-region arc traced a highlight straight out of the
// block the renderer had cut it at — across the neighbouring region's arcs,
// marking pixels no arc was painted on. Invisible in the single full-width-block
// view and only there.
export interface ArcBandClip {
  x: number
  y: number
  width: number
  height: number
}

// The band's own screen rect, which IS the clip — named once because the hover
// and the debug overlay both draw it and both used to carry it as four loose
// fields under two different sets of names.
function arcBandClip(scale: ArcBandScale): ArcBandClip {
  return {
    x: scale.clipLeft,
    y: scale.arcsTop,
    width: scale.screenWidthPx,
    height: scale.arcsH,
  }
}

// The arc band's answer, in the shape a GESTURE consumes — a variant of the
// same union the pileup's hit test answers with, so that "an arc is here" and
// "a read/coverage/interbase mark is here" are one value with one discriminant.
//
// That is the whole point of it being a variant rather than a second return
// field. Every gesture has to decline to act through an arc, and when each
// asked separately one of them forgot: `93af1f54f0` guarded the click and left
// the right-click building the interbase menu for whatever the arc crossed.
// As a variant, `hoverStateForResult`'s switch does not compile without a case
// for it, so the next gesture is told at build time rather than in a bug report.
//
// `tooltip` and `highlight` come from one `resolveArcBandHover`, so the mark is
// on the arc the tooltip describes by construction rather than by agreement.
export interface ArcMarkHit {
  type: 'arc'
  tooltip: TooltipPayload
  highlight: ArcHighlight
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
export interface ArcHighlight {
  d: string
  clip: ArcBandClip
  lineWidth: number
  // `stroke-dasharray`, matching the mark's own. Only a split connector is
  // dashed; ticks and arcs are solid.
  dash?: string
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
  // THE resolved mark — a bar or a dome, carrying exactly the numbers that kind
  // is described by. It used to carry an `isFlat` flag beside an rx/ry pair that,
  // for a bar, described the ellipse the arc WOULD have drawn in arc mode: two
  // numbers about a mark not on screen, in an overlay whose entire contract is
  // that what it draws is what the renderer thinks.
  mark: ArcMark
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
  // Where a dome's apex used to be pinned before the clamp came off. Drawn as a
  // reference line: ink lying along it is the clamped-plateau signature, so the
  // overlay can tell "this arc is genuinely flat here" from "something is still
  // clamping".
  legacyCeilingY: number
  // The band rect AND the scissor, which are the same rect. The overlay draws
  // its band outline at it and clips its traced paths to it, which matters more
  // here than anywhere: this overlay's whole contract is that a path not sitting
  // on its painted arc IS the finding, so a full-width trace over a
  // block-clipped paint manufactures one. It also drew every region's band as
  // the same full-width rect, which in the multi-region view the region loop was
  // added to serve stacked them into one.
  clip: ArcBandClip
}

// Where a dome's apex was pinned before the clamp came off, as a screen y —
// drawn as a reference line, so ink lying along it is the clamped-plateau
// signature. Shared with the cross-region half below, which annotates the same
// band and must put the line in the same place.
export function arcApexCeilingY(
  arcsTop: number,
  arcsH: number,
  pairedArcsDown: boolean,
) {
  const ceiling = ARC_APEX_FRACTION * arcAvailH(arcsH)
  return pairedArcsDown ? arcsTop + ceiling : arcsTop + arcsH - ceiling
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
  const { arcsTop, arcsH, pairedArcsDown } = scale
  const shapes: ArcDebugShape[] = []
  for (let i = 0; i < arcs.numArcs; i++) {
    // `arcMark`, not a second reading of the Y scale and the near/far branch
    // beside it. The overlay's whole job is to say what the RENDERER thinks an
    // arc is, and it was answering from its own projection — which is how it
    // came to spell the Y rule twice and had to be edited again when
    // `arcDomeDestY` was reverted away. `arcScreenPath` below resolves the same
    // mark, so the numbers and the ink come from one derivation.
    shapes.push({
      d: arcScreenPath(arcs, i, scale),
      mark: arcMark(arcs, i, scale),
      x1: arcs.arcX1[i]!,
      x2: arcs.arcX2[i]!,
      yBp: arcs.arcYBp[i]!,
      support: arcs.arcSupport[i]!,
    })
  }
  return {
    shapes,
    legacyCeilingY: arcApexCeilingY(arcsTop, arcsH, pairedArcsDown),
    clip: arcBandClip(scale),
  }
}

// Resolve a hover over one section's arc band: project the band once, ask what
// is under the cursor, ask where that mark's ink is. Undefined when the section
// reserves no band (`arcBandHeight` 0 — arcs off, or a lane whose reads produced
// none), which is also the gate the renderers use to skip the pass.
//
// The emptiness test is `hasArcBandInk`'s, not `numArcs === 0`: a lane can carry
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
  if (!scale) {
    return undefined
  }
  const hit = hitTestArcBand(canvasX, canvasY, arcs, scale)
  if (!hit) {
    return undefined
  }
  return {
    hit,
    highlight: {
      d:
        hit.kind === 'tick'
          ? arcLineScreenPath(arcs, hit.index, scale)
          : arcScreenPath(arcs, hit.index, scale),
      // The arc pass's own clip, on BOTH axes — see `ArcBandClip`. Not
      // decoration: a far pair's semicircle rises hundreds of px above a band
      // tens of px tall and runs as far again to either side, and the renderers
      // cut it at the band and at the block, so an unclipped highlight traces a
      // curve across the coverage histogram and across the next region that no
      // arc was ever painted on.
      clip: arcBandClip(scale),
      // Never thinner than the mark's own ink, so the highlight reads as it
      // lighting up rather than as a second, finer curve laid beside a heavy
      // one. One `arcLineWidth` call for both families, since ticks take their
      // width from support on the same curve the arcs do.
      lineWidth: arcLineWidth(hit.support, scale.lineWidth),
    },
  }
}
