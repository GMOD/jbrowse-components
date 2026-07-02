import { abgrAlpha } from '@jbrowse/core/util/colorBits'
import Flatbush from '@jbrowse/core/util/flatbush'

import type {
  SyntenyPickResult,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

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

export interface PickCanvasLike extends CanvasLike {
  isPointInPath(x: number, y: number): boolean
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

export interface ComputedTransform {
  bpPerPxInv0: number
  bpPerPxInv1: number
  viewBp0: number
  viewBp1: number
}

export function computeTransform(
  params: SyntenyTrackRenderParams,
): ComputedTransform {
  return {
    bpPerPxInv0: 1 / params.bpPerPx0,
    bpPerPxInv1: 1 / params.bpPerPx1,
    // SYNC: matches viewBp{0,1} computation in GpuSyntenyRenderer.writeUniforms
    // and the Uniforms struct in syntenyTypes.slang. Bp at canvas left:
    // (cumBp − viewBp)/bpPerPx → screen-X. See ADR-018.
    viewBp0: params.offsetPx0 * params.bpPerPx0,
    viewBp1: params.offsetPx1 * params.bpPerPx1,
  }
}

export interface ProjectedCorners {
  sx1: number
  sx2: number
  sx3: number
  sx4: number
}

// SYNC: matches hpCornerScreenX in syntenyTypes.slang. Canvas2D operates in
// Float64 so we don't need the hp-math hi/lo separation, but must reproduce
// the same arithmetic to keep visuals identical.
export function projectCorners(
  data: SyntenyInstanceData,
  i: number,
  t: ComputedTransform,
): ProjectedCorners {
  const bp1 = data.bp1Hi[i]! + data.bp1Lo[i]!
  const bp2 = data.bp2Hi[i]! + data.bp2Lo[i]!
  const bp3 = data.bp3Hi[i]! + data.bp3Lo[i]!
  const bp4 = data.bp4Hi[i]! + data.bp4Lo[i]!
  return {
    sx1: (bp1 - t.viewBp0) * t.bpPerPxInv0,
    sx2: (bp2 - t.viewBp0) * t.bpPerPxInv0,
    sx3: (bp3 - t.viewBp1) * t.bpPerPxInv1,
    sx4: (bp4 - t.viewBp1) * t.bpPerPxInv1,
  }
}

// Per-edge cull: drop the instance when any single edge lies entirely outside
// the draw limits. Matches isCulled() in syntenyTypes.slang. An AABB-only
// check would keep drawing trapezoids that span huge horizontal travel.
export function isEdgeCulled(
  c: ProjectedCorners,
  leftLimit: number,
  rightLimit: number,
) {
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

export interface PickIndex {
  flatbush: Flatbush
  transform: ComputedTransform
  height: number
  leftLimit: number
  rightLimit: number
}

function transformsEqual(a: ComputedTransform, b: ComputedTransform) {
  return (
    a.bpPerPxInv0 === b.bpPerPxInv0 &&
    a.bpPerPxInv1 === b.bpPerPxInv1 &&
    a.viewBp0 === b.viewBp0 &&
    a.viewBp1 === b.viewBp1
  )
}

function buildPickIndex(
  data: SyntenyInstanceData,
  transform: ComputedTransform,
  height: number,
  leftLimit: number,
  rightLimit: number,
): PickIndex {
  const flatbush = new Flatbush(data.instanceCount)
  for (let i = 0; i < data.instanceCount; i++) {
    const c = projectCorners(data, i, transform)
    if (isEdgeCulled(c, leftLimit, rightLimit)) {
      flatbush.add(0, 0, -1, -1)
      continue
    }
    // SYNC: mirrors the halfPerpW≥0.5 clamp in the fill shaders — ribbons
    // whose both edges are sub-2px wide render as non-pickable lines.
    if (Math.abs(c.sx2 - c.sx1) < 2 && Math.abs(c.sx4 - c.sx3) < 2) {
      flatbush.add(0, 0, -1, -1)
      continue
    }
    flatbush.add(
      Math.min(c.sx1, c.sx2, c.sx3, c.sx4),
      0,
      Math.max(c.sx1, c.sx2, c.sx3, c.sx4),
      height,
    )
  }
  flatbush.finish()
  return { flatbush, transform, height, leftLimit, rightLimit }
}

export interface PickContext {
  ctx: PickCanvasLike
  state: SyntenyRenderState
  regions: Map<number, SyntenyInstanceData>
  pickIndices: Map<number, PickIndex>
  canvasLogicalWidth: number
  x: number
  y: number
}

export function pickFeatureAtPoint(
  pc: PickContext,
): SyntenyPickResult | undefined {
  const { ctx, state, regions, pickIndices, canvasLogicalWidth, x, y } = pc
  const leftLimit = -state.overdrawPx
  const rightLimit = canvasLogicalWidth + state.overdrawPx

  // Iterate tracks in reverse draw order so top-most wins.
  const entries = Array.from(state.perTrack)
  for (let ei = entries.length - 1; ei >= 0; ei--) {
    const [key, params] = entries[ei]!
    const data = regions.get(key)
    if (!data || data.instanceCount === 0) {
      continue
    }
    const { yTop, height, minAlignmentLength } = params
    if (y < yTop || y > yTop + height) {
      continue
    }
    const localY = y - yTop
    const transform = computeTransform(params)

    let idx = pickIndices.get(key)
    if (
      !idx ||
      !transformsEqual(idx.transform, transform) ||
      idx.height !== height ||
      idx.leftLimit !== leftLimit ||
      idx.rightLimit !== rightLimit
    ) {
      idx = buildPickIndex(data, transform, height, leftLimit, rightLimit)
      pickIndices.set(key, idx)
    }

    // Sort descending so the highest instance index (last drawn = topmost) wins.
    const candidates = idx.flatbush
      .search(x, localY, x, localY)
      .toSorted((a, b) => b - a)
    for (let ci = 0, l = candidates.length; ci < l; ci++) {
      const i = candidates[ci]!
      if (data.alignmentLengths[i]! < minAlignmentLength) {
        continue
      }
      if (abgrAlpha(data.colors[i]!) / 255 < 0.01) {
        continue
      }

      const c = projectCorners(data, i, transform)
      // Path built in track-local space (yTop=0) to match localY below.
      buildFeaturePath(ctx, c, 0, height, params.drawCurves)

      if (ctx.isPointInPath(x, localY)) {
        return { key, featureIndex: i }
      }
    }
  }
  return undefined
}
