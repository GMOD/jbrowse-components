import Flatbush from '@jbrowse/core/util/flatbush'

import { BEZIER_SEGMENTS } from './shaders/syntenyTypes.generated.ts'

import type {
  SyntenyPickResult,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

function hermiteY(t: number, height: number) {
  return height * (1.5 * t * (1 - t) + t * t * t)
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

// Subset of CanvasRenderingContext2D the draw + pick paths need. SvgCanvas
// (packages/core/src/util/SvgCanvas.ts) satisfies this for SVG export.
export interface CanvasLike {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  fill(): void
  stroke(): void
}

export interface PickCanvasLike extends CanvasLike {
  isPointInPath(x: number, y: number): boolean
}

export function buildFeaturePath(
  ctx: CanvasLike,
  sx1: number,
  sx2: number,
  sx3: number,
  sx4: number,
  height: number,
  isCurve: boolean,
) {
  ctx.beginPath()
  if (isCurve) {
    ctx.moveTo(sx1, 0)
    for (let s = 1; s <= BEZIER_SEGMENTS; s++) {
      const t = s / BEZIER_SEGMENTS
      const st = smoothstep(t)
      ctx.lineTo(sx1 + (sx4 - sx1) * st, hermiteY(t, height))
    }
    for (let s = BEZIER_SEGMENTS; s >= 0; s--) {
      const t = s / BEZIER_SEGMENTS
      const st = smoothstep(t)
      ctx.lineTo(sx2 + (sx3 - sx2) * st, hermiteY(t, height))
    }
  } else {
    ctx.moveTo(sx1, 0)
    ctx.lineTo(sx4, height)
    ctx.lineTo(sx3, height)
    ctx.lineTo(sx2, 0)
  }
  ctx.closePath()
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
    // and the Uniforms struct in syntenyTypes.slang. Padded-bp at canvas left:
    // (cumBp − viewBp)/bpPerPx + pad → screen-X. See ADR-018.
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
  const padTop = data.padTops[i]!
  const padBottom = data.padBottoms[i]!
  const bp1 = data.bp1Hi[i]! + data.bp1Lo[i]!
  const bp2 = data.bp2Hi[i]! + data.bp2Lo[i]!
  const bp3 = data.bp3Hi[i]! + data.bp3Lo[i]!
  const bp4 = data.bp4Hi[i]! + data.bp4Lo[i]!
  return {
    sx1: (bp1 - t.viewBp0) * t.bpPerPxInv0 + padTop,
    sx2: (bp2 - t.viewBp0) * t.bpPerPxInv0 + padTop,
    sx3: (bp3 - t.viewBp1) * t.bpPerPxInv1 + padBottom,
    sx4: (bp4 - t.viewBp1) * t.bpPerPxInv1 + padBottom,
  }
}

// SYNC: matches the minW computation in syntenyFill.slang's vs_main. Both
// backends widen sub-pixel trapezoids the same way so on-screen visual
// density (and SVG export) stay consistent. If you change the formula here,
// change it there too — there's no shared source.
export function widenCorners(
  c: ProjectedCorners,
  height: number,
): ProjectedCorners {
  const xTopMid = (c.sx1 + c.sx2) * 0.5
  const xBotMid = (c.sx3 + c.sx4) * 0.5
  const slope = Math.abs(xBotMid - xTopMid) / Math.max(height, 1)
  const minW = Math.min(1 + Math.max(0, slope - 1) * 0.25, 3)
  let { sx1, sx2, sx3, sx4 } = c
  if (Math.abs(sx2 - sx1) < minW) {
    const half = (sx1 < sx2 ? minW : -minW) * 0.5
    sx1 = xTopMid - half
    sx2 = xTopMid + half
  }
  if (Math.abs(sx4 - sx3) < minW) {
    const half = (sx3 < sx4 ? minW : -minW) * 0.5
    sx3 = xBotMid - half
    sx4 = xBotMid + half
  }
  return { sx1, sx2, sx3, sx4 }
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
      // Inverted box never matches any search
      flatbush.add(0, 0, -1, -1)
      continue
    }
    const w = widenCorners(c, height)
    flatbush.add(
      Math.min(w.sx1, w.sx2, w.sx3, w.sx4),
      0,
      Math.max(w.sx1, w.sx2, w.sx3, w.sx4),
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
      if (data.queryTotalLengths[i]! < minAlignmentLength) {
        continue
      }
      if (((data.colors[i]! >>> 24) & 0xff) / 255 < 0.01) {
        continue
      }

      const c = projectCorners(data, i, transform)
      const w = widenCorners(c, height)
      buildFeaturePath(
        ctx,
        w.sx1,
        w.sx2,
        w.sx3,
        w.sx4,
        height,
        params.drawCurves,
      )

      if (ctx.isPointInPath(x, localY)) {
        return { key, featureIndex: i }
      }
    }
  }
  return undefined
}
