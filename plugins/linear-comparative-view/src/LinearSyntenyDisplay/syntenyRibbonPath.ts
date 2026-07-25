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

// SYNC: matches hermiteEdges in syntenyTypes.slang exactly. The smoothstep
// X-blend and the `1.5 t (1-t) + t³` Y curve together form the cubic Bezier
// from (sx?, 0) to (sx?, height) with both control points at midheight on
// each anchor's x. Algebra:
//   (1-t)²(1+2t) = 1 - smoothstep(t)
//   (h/2)·3t(1-t) + t³·h = h·[1.5t(1-t) + t³]
// so the tessellation loop is replaceable by a single bezierCurveTo per edge
// with zero loss of fidelity (and perfect browser AA at the curve).
//
// Corners are NOT widened here — adjacent ribbons that share a genomic
// boundary must have identical corner positions so their bezier curves
// trace the same path and meet without whitespace gaps. Canvas2D path AA
// renders thin/zero-width tips correctly without widening; the GPU shader
// uses its line-mode branch (perpWidth < LINE_PERP_THRESHOLD) to keep
// sub-pixel ribbons visible.
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

// Stroke the ribbon centerline (xt at top → xb at bottom) — the centerline
// sibling of strokeFeatureSideEdges. Used for sub-pixel-thin features and
// zero-width KIND_MARKER ticks, where a 1px centerline stroke renders cleanly
// at any slope instead of ctx.fill()ing a degenerate sliver. Caller sets
// strokeStyle/lineWidth first.
export function strokeCenterline(
  ctx: CanvasLike,
  xt: number,
  xb: number,
  yTop: number,
  height: number,
  isCurve: boolean,
) {
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

// SYNC: matches GpuSyntenyRenderer.writeUniforms and computeCorners in
// syntenyTypes.slang. `panPx = (base - offsetPx*bpPerPx)/bpPerPx` is how far
// the view has panned from the geometry's fetch-time base. Float64 here (the
// GPU narrows it to Float32, which is exact because the delta is bounded by the
// pan buffer). See ADR-018.
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
// the same boundary. Mirrors perpFactor/halfPerpW in syntenyTypes.slang's
// fillCoverage.
export function ribbonPerpWidth(c: ProjectedCorners, height: number) {
  const xt = (c.sx1 + c.sx2) * 0.5
  const xb = (c.sx3 + c.sx4) * 0.5
  const slope = (xb - xt) / Math.max(height, 1)
  const perpFactor = Math.sqrt(1 + slope * slope)
  return Math.max(Math.abs(c.sx2 - c.sx1), Math.abs(c.sx4 - c.sx3)) / perpFactor
}

// Slack on the hull cull below, covering the widest thing a ribbon can paint
// outside its own corners: a 1px centerline/outline stroke (±0.5px) plus the
// browser's antialiasing of it.
const HULL_CULL_PAD_PX = 1

// Drop an instance that can't paint a visible pixel, by two independent tests.
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
// overdraw band. Mirrors the viewport half of isCulled() in
// syntenyTypes.slang — the shader also folds in the minAlignmentLength cull,
// which here the draw/pick callers apply separately per instance. A hull-only
// check would keep drawing trapezoids that span huge horizontal travel.
export function isRibbonCulled(
  c: ProjectedCorners,
  viewWidth: number,
  overdrawPx: number,
) {
  const hullMin = Math.min(c.sx1, c.sx2, c.sx3, c.sx4)
  const hullMax = Math.max(c.sx1, c.sx2, c.sx3, c.sx4)
  if (hullMax < -HULL_CULL_PAD_PX || hullMin > viewWidth + HULL_CULL_PAD_PX) {
    return true
  }
  const leftLimit = -overdrawPx
  const rightLimit = viewWidth + overdrawPx
  const topMin = Math.min(c.sx1, c.sx2)
  const topMax = Math.max(c.sx1, c.sx2)
  const botMin = Math.min(c.sx3, c.sx4)
  const botMax = Math.max(c.sx3, c.sx4)
  return (
    topMax < leftLimit ||
    topMin > rightLimit ||
    botMax < leftLimit ||
    botMin > rightLimit
  )
}
