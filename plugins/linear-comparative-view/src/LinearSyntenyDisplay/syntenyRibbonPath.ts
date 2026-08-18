import { abgrAlpha } from '@jbrowse/core/util/colorBits'

import {
  markerTravelsTooFar,
  spanOutsideBand,
} from './shaders/syntenyTypes.js.generated.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { SyntenyTrackRenderParams } from './syntenyRenderingBackendTypes.ts'

// Ribbon geometry shared by the Canvas2D backend, the SVG export (which draws
// through the same `drawSyntenyTrack`) and the CPU pick engine. Every function
// here mirrors a counterpart in syntenyTypes.slang so the three paths trace the
// identical silhouette; the SYNC comments name the shader function.

// Subset of CanvasRenderingContext2D the draw + pick paths need. SvgCanvas
// (packages/core/src/util/SvgCanvas.ts) satisfies this for SVG export.
export interface CanvasLike {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void
  fill(): void
  stroke(): void
}

// The same cubic the curve shaders trace — syntenyTypes.slang's `sBlend` (the
// smoothstep X-blend) and `yCurve` (`1.5 t (1-t) + t³`) together form the cubic
// Bezier from (sx?, 0) to (sx?, height) with both control points at midheight
// on each anchor's x. Algebra:
//   (1-t)²(1+2t) = 1 - sBlend(t)
//   (h/2)·3t(1-t) + t³·h = h·[1.5t(1-t) + t³]
// so what the shader evaluates analytically per fragment is a single
// bezierCurveTo per edge here, with zero loss of fidelity (and perfect browser
// AA at the curve).
//
// syntenyShaderParity.test.ts evaluates the beziers these functions actually
// emit against the shader's own `sBlend`/`yCurve`, so the identity above is
// checked rather than asserted — it used to be a SYNC comment, which is a note
// to a future reader and not a mechanism. Every control point below is
// load-bearing: a midheight that drifts leaves the GPU fill and the Canvas2D /
// SVG fill tracing different paths, which shows as a sliver of background along
// a curved ribbon's edge in one backend and not the other.
//
// Corners are NOT widened here — adjacent ribbons that share a genomic
// boundary must have identical corner positions so their bezier curves
// trace the same path and meet without whitespace gaps. Canvas2D path AA
// renders thin/zero-width tips correctly without widening; the GPU keeps
// sub-pixel ribbons visible instead via perpCoverage's `expand` term (a 1px
// minimum footprint) and the `thinWidthFade` density fade, and the Canvas2D
// draw loop's own perpW<1 centerline branch is the twin of that.
export function buildFeaturePath(
  ctx: CanvasLike,
  c: ProjectedCorners,
  yTop: number,
  height: number,
  isCurve: boolean,
) {
  const yBot = yTop + height
  ctx.beginPath()
  if (isCurve) {
    const halfH = yTop + height * 0.5
    ctx.moveTo(c.sx1, yTop)
    ctx.bezierCurveTo(c.sx1, halfH, c.sx4, halfH, c.sx4, yBot)
    ctx.lineTo(c.sx3, yBot)
    ctx.bezierCurveTo(c.sx3, halfH, c.sx2, halfH, c.sx2, yTop)
  } else {
    ctx.moveTo(c.sx1, yTop)
    ctx.lineTo(c.sx4, yBot)
    ctx.lineTo(c.sx3, yBot)
    ctx.lineTo(c.sx2, yTop)
  }
  ctx.closePath()
}

// Stroke only the two side (connecting) edges — left x1→x4, right x2→x3 —
// matching the GPU edge passes (syntenyEdge{Straight,Curve}.slang), which
// outline a clicked feature's connecting edges but NOT its top/bottom
// genome-axis edges. A closed-path stroke (buildFeaturePath + ctx.stroke)
// would draw two extra horizontal lines the GPU never shows.
export function strokeFeatureSideEdges(
  ctx: CanvasLike,
  c: ProjectedCorners,
  yTop: number,
  height: number,
  isCurve: boolean,
) {
  const yBot = yTop + height
  ctx.beginPath()
  if (isCurve) {
    const halfH = yTop + height * 0.5
    ctx.moveTo(c.sx1, yTop)
    ctx.bezierCurveTo(c.sx1, halfH, c.sx4, halfH, c.sx4, yBot)
    ctx.moveTo(c.sx2, yTop)
    ctx.bezierCurveTo(c.sx2, halfH, c.sx3, halfH, c.sx3, yBot)
  } else {
    ctx.moveTo(c.sx1, yTop)
    ctx.lineTo(c.sx4, yBot)
    ctx.moveTo(c.sx2, yTop)
    ctx.lineTo(c.sx3, yBot)
  }
  ctx.stroke()
}

// The ribbon's centerline endpoints: the midpoint of its top edge and of its
// bottom edge. A KIND_MARKER tick's two edges are each a single point, so this
// returns that point unchanged for one.
function centerlineTopX(c: ProjectedCorners) {
  return (c.sx1 + c.sx2) * 0.5
}

function centerlineBottomX(c: ProjectedCorners) {
  return (c.sx3 + c.sx4) * 0.5
}

// Stroke the ribbon centerline — the centerline sibling of
// strokeFeatureSideEdges. Used for sub-pixel-thin features and zero-width
// KIND_MARKER ticks, where a 1px centerline stroke renders cleanly at any slope
// instead of ctx.fill()ing a degenerate sliver. Caller sets
// strokeStyle/lineWidth first.
//
// Takes the corners rather than the two midpoints, so the one place that knows
// how a centerline is derived from a ribbon is this file — the same place
// ribbonPerpWidth measures the slope of that centerline.
export function strokeCenterline(
  ctx: CanvasLike,
  c: ProjectedCorners,
  yTop: number,
  height: number,
  isCurve: boolean,
) {
  const xt = centerlineTopX(c)
  const xb = centerlineBottomX(c)
  const yBot = yTop + height
  ctx.beginPath()
  ctx.moveTo(xt, yTop)
  if (isCurve) {
    const halfH = yTop + height * 0.5
    ctx.bezierCurveTo(xt, halfH, xb, halfH, xb, yBot)
  } else {
    ctx.lineTo(xb, yBot)
  }
  ctx.stroke()
}

// Per-axis scale + pan for one track's geometry, in the same form the shader's
// Uniforms carry: screen X is `bpRel * bpPerPxInv + panPx`. Pan being a single
// scalar per axis is what lets the pick index survive a pan (see buildPickIndex)
// — panning shifts panPx without moving any corner relative to the others.
export interface ComputedTransform {
  bpPerPxInv0: number
  bpPerPxInv1: number
  panPx0: number
  panPx1: number
}

// The uniforms the shader consumes, computed once for the CPU paths too —
// `GpuSyntenyRenderer.writeUniforms` writes these same values into the UBO, so
// this is the producer rather than a copy of a consumer.
//
// `panPx = (base - offsetPx*bpPerPx)/bpPerPx` is how far the view has panned
// from the geometry's fetch-time base. Float64 here (the GPU narrows it to
// Float32, which is exact because the delta is bounded by the pan buffer). See
// ADR-067.
export function computeTransform(
  params: SyntenyTrackRenderParams,
  data: { base0: number; base1: number },
): ComputedTransform {
  const bpPerPxInv0 = 1 / params.bpPerPx0
  const bpPerPxInv1 = 1 / params.bpPerPx1
  return {
    bpPerPxInv0,
    bpPerPxInv1,
    panPx0: (data.base0 - params.offsetPx0 * params.bpPerPx0) * bpPerPxInv0,
    panPx1: (data.base1 - params.offsetPx1 * params.bpPerPx1) * bpPerPxInv1,
  }
}

export interface ProjectedCorners {
  sx1: number
  sx2: number
  sx3: number
  sx4: number
}

// Mutable scratch for `projectCorners`, so the per-instance loops (draw, pick,
// pick-index build) don't allocate one object per instance — at 500k instances
// that allocation dominated the pick-index rebuild. Corners never outlive the
// iteration that projected them, so every caller can hold a single scratch for
// the whole loop.
export function makeCornerScratch(): ProjectedCorners {
  return { sx1: 0, sx2: 0, sx3: 0, sx4: 0 }
}

// SYNC: matches computeCorners in syntenyTypes.slang. Corners are window-
// relative bp (cumBp - base), so screen X is `bpRel * bpPerPxInv + panPx` —
// the identical expression the shader evaluates.
export function projectCorners(
  data: SyntenyInstanceData,
  i: number,
  t: ComputedTransform,
  out: ProjectedCorners,
) {
  out.sx1 = data.bp1[i]! * t.bpPerPxInv0 + t.panPx0
  out.sx2 = data.bp2[i]! * t.bpPerPxInv0 + t.panPx0
  out.sx3 = data.bp3[i]! * t.bpPerPxInv1 + t.panPx1
  out.sx4 = data.bp4[i]! * t.bpPerPxInv1 + t.panPx1
  return out
}

// Ribbon perpendicular (visual) thickness in px. A steep diagonal can span
// several px horizontally yet be razor-thin perpendicular, so keying on
// horizontal span alone mis-measures it. Shared by the fill path (fill vs
// centerline-stroke decision in Canvas2DSyntenyRenderer.drawSyntenyTrack) and the
// pick path (pickFeatureAtPoint) so "drawn as a solid fill" and "pickable" stay
// the same boundary. Mirrors the perpFactor/perpW pair in syntenyTypes.slang's
// perpCoverage — measured from the whole ribbon's corners here, per-fragment
// from each edge's own foreshortening there.
export function ribbonPerpWidth(c: ProjectedCorners, height: number) {
  const slope = (centerlineBottomX(c) - centerlineTopX(c)) / Math.max(height, 1)
  const perpFactor = Math.sqrt(1 + slope * slope)
  return Math.max(Math.abs(c.sx2 - c.sx1), Math.abs(c.sx4 - c.sx3)) / perpFactor
}

// Slack on the hull cull below, covering the widest thing a ribbon can paint
// outside its own corners: a 1px centerline/outline stroke (±0.5px) plus the
// browser's antialiasing of it.
const HULL_CULL_PAD_PX = 1

// Drop an instance that can't paint a visible pixel, by two tests.
//
// Hull: a ribbon's horizontal extent is bounded by its four corners (the curve
// mode's bezier control points are the corners themselves, so the curve stays
// within their x-hull), so a hull entirely off the canvas paints nothing. This
// has no counterpart in syntenyTypes.slang's isCulled() and needs none — the
// GPU rasterizer discards those triangles for free, whereas the CPU path pays
// full path construction for each, and the SVG export pays serialization too
// (measured on the volvox export: ~60% of the ribbon <path> elements were
// entirely outside the level's clip rect, since overdrawPx defaults to 1000px).
//
// Per-edge: drop the instance when any single edge lies entirely outside the
// overdraw band. A hull-only check would keep drawing trapezoids that span huge
// horizontal travel.
//
// Both tests are `spanOutsideBand`, the generated twin of the comparison
// isCulled() makes in syntenyTypes.slang, so the two sides differ only in what
// they pass it: the hull here runs at a tighter pad, and the minAlignmentLength
// cull the shader folds in is applied per instance by the draw/pick callers.
//
// Travel (markers only): drop a tick that runs further horizontally between its
// two ends than the view is wide. Also the shader's own, and asked per frame on
// both sides because the distance moves with the two views' relative pan — see
// markerTravelsTooFar.
export function isRibbonCulled(
  c: ProjectedCorners,
  viewWidth: number,
  overdrawPx: number,
  // A marker is a 1px line between one point per view, so the hull IS its
  // extent and the per-edge test below would drop it whenever ONE end left the
  // band — see the marker arm of isCulled() in syntenyTypes.slang for the
  // inversion this deleted half the tick fan on.
  isMarker = false,
) {
  // Per-edge extents first — the hull is their union, so taking it from these
  // costs two more comparisons rather than two four-argument Math.min/max
  // passes over the same corners.
  const topMin = Math.min(c.sx1, c.sx2)
  const topMax = Math.max(c.sx1, c.sx2)
  const botMin = Math.min(c.sx3, c.sx4)
  const botMax = Math.max(c.sx3, c.sx4)
  // The canvas edge and the overdraw band were two separate hull tests, which
  // is one test at whichever pad is tighter: with the default 1000px overdraw
  // the canvas-edge one culled nothing the band's had not, and it only bites at
  // all when overdrawPx is under a pixel.
  const hullPad = Math.min(HULL_CULL_PAD_PX, overdrawPx)
  if (
    spanOutsideBand(
      Math.min(topMin, botMin),
      Math.max(topMax, botMax),
      viewWidth,
      hullPad,
    )
  ) {
    return true
  }
  // A marker's two corners per view coincide, so sx1 and sx3 are its two ends —
  // the same pair the shader reads as c.x and c.z.
  if (isMarker) {
    return markerTravelsTooFar(c.sx1, c.sx3, viewWidth)
  }
  return (
    spanOutsideBand(topMin, topMax, viewWidth, overdrawPx) ||
    spanOutsideBand(botMin, botMax, viewWidth, overdrawPx)
  )
}

// Alpha under 1% — the "too faint to be worth painting" floor the draw and pick
// loops have always applied. Spelled as a byte compare rather than the
// `abgrAlpha(packed) / 255 < 0.01` each used to carry: alpha is an integer, so
// `< 2.55` IS `< 3`, and the divide leaves the per-instance loops.
const MIN_VISIBLE_ALPHA_BYTE = 3

// The draw loop (Canvas2DSyntenyRenderer.drawSyntenyTrack) and the pick engine
// must answer this identically, or a ribbon too faint to paint stays hoverable
// — the same "drawn and pickable are one boundary" rule `ribbonPerpWidth`
// enforces for sub-pixel thinness. Which is why it is this function and not a
// literal in each: there is one answer, so there is nothing to keep in step.
//
// `displayAlpha` is the view's opacity slider, and it is a REQUIRED argument
// because leaving it out is precisely how the two answers came apart: the pick
// weighed the packed byte alone, so at the bottom of a slider that reaches 0
// the whole band went blank and stayed fully hoverable and clickable. It scales
// both arms of the fill — a BASE ribbon's output alpha IS `fillShade`'s
// `pa * displayAlpha`, and a CIGAR tile keeps its own alpha but blends toward
// the white background by the same factor, so one floor covers both.
//
// A location marker is the exception and its caller says so by passing 1: a
// tick is drawn at its packed alpha, deliberately bypassing the slider. Nothing
// picks one (both its edges are single points, so it never enters the index),
// so only the draw loop has to make that distinction.
export function isInstanceInvisible(packedColor: number, displayAlpha: number) {
  return abgrAlpha(packedColor) * displayAlpha < MIN_VISIBLE_ALPHA_BYTE
}
