import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { syriColors } from './drawSyntenyUtils.ts'

import type {
  SyntenyBackend,
  SyntenyPickResult,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

const PACKED_SYN = cssColorToABGR(syriColors.SYN)

const CURVE_SEGMENTS = 16

function hermiteY(t: number, height: number) {
  return height * (1.5 * t * (1 - t) + t * t * t)
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

function buildFeaturePath(
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
    for (let s = 1; s <= CURVE_SEGMENTS; s++) {
      const t = s / CURVE_SEGMENTS
      const st = smoothstep(t)
      ctx.lineTo(sx1 + (sx4 - sx1) * st, hermiteY(t, height))
    }
    for (let s = CURVE_SEGMENTS; s >= 0; s--) {
      const t = s / CURVE_SEGMENTS
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

interface ComputedTransform {
  scale0: number
  scale1: number
  adjOff0: number
  adjOff1: number
  scaleDiff0: number
  scaleDiff1: number
}

function computeTransform(
  data: SyntenyInstanceData,
  params: SyntenyTrackRenderParams,
): ComputedTransform {
  const scale0 = data.geometryBpPerPx0 / params.bpPerPx0
  const scale1 = data.geometryBpPerPx1 / params.bpPerPx1
  return {
    scale0,
    scale1,
    adjOff0: params.offset0 / scale0 - data.refOffset0,
    adjOff1: params.offset1 / scale1 - data.refOffset1,
    scaleDiff0: scale0 - 1,
    scaleDiff1: scale1 - 1,
  }
}

interface ProjectedCorners {
  sx1: number
  sx2: number
  sx3: number
  sx4: number
}

function projectCorners(
  data: SyntenyInstanceData,
  i: number,
  t: ComputedTransform,
): ProjectedCorners {
  const padTop = data.padTops[i]!
  const padBottom = data.padBottoms[i]!
  return {
    sx1: (data.x1[i]! - t.adjOff0) * t.scale0 - padTop * t.scaleDiff0,
    sx2: (data.x2[i]! - t.adjOff0) * t.scale0 - padTop * t.scaleDiff0,
    sx3: (data.x3[i]! - t.adjOff1) * t.scale1 - padBottom * t.scaleDiff1,
    sx4: (data.x4[i]! - t.adjOff1) * t.scale1 - padBottom * t.scaleDiff1,
  }
}

// SYNC: matches the minW computation in syntenyFill.slang's vs_main. Both
// backends widen sub-pixel trapezoids the same way so on-screen visual
// density (and SVG export) stay consistent. If you change the formula here,
// change it there too — there's no shared source.
function widenCorners(c: ProjectedCorners, height: number): ProjectedCorners {
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

// Per-edge cull (not combined AABB): drop the instance when EITHER the top
// edge OR the bottom edge is fully off-screen. Matches isCulled() in
// syntenyTypes.slang so Canvas2D and GPU honor the maxOffScreenPx slider
// the same way; an AABB-only check would keep drawing trapezoids spanning
// huge horizontal travel into off-screen space.
function isEdgeCulled(
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

// Subset of the 2D canvas surface the draw loop needs. Both
// CanvasRenderingContext2D and SvgCanvas (packages/core/src/util/SvgCanvas.ts)
// satisfy this, so renderSvg.tsx reuses this exact draw path.
export interface CanvasLike {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  globalAlpha: number
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

function drawInstances(
  ctx: CanvasLike,
  data: SyntenyInstanceData,
  transform: ReturnType<typeof computeTransform>,
  alpha: number,
  height: number,
  minAlignmentLength: number,
  hoveredFeatureId: number,
  clickedFeatureId: number,
  drawCurves: boolean,
  leftLimit: number,
  rightLimit: number,
  fillStyleCache: Map<number, string>,
  synOnly: boolean | undefined,
) {
  for (let i = 0; i < data.instanceCount; i++) {
    if (data.queryTotalLengths[i]! < minAlignmentLength) {
      continue
    }
    const packed = data.colors[i]!
    const isSyn = packed === PACKED_SYN
    if (synOnly !== undefined && isSyn !== synOnly) {
      continue
    }
    const a = ((packed >>> 24) & 0xff) / 255
    if (a < 0.01) {
      continue
    }

    const c = projectCorners(data, i, transform)
    if (isEdgeCulled(c, leftLimit, rightLimit)) {
      continue
    }

    const featureId = data.featureIds[i]
    const isHovered = featureId === hoveredFeatureId
    const isClicked = featureId === clickedFeatureId

    let fillStyle = fillStyleCache.get(packed)
    if (isHovered) {
      // SYNC: 0.7 darkening + 5x alpha boost capped at 0.35 must match
      // syntenyFill.slang's hover branch so the highlight looks identical
      // across all backends.
      const r = ((packed & 0xff) * 0.7) | 0
      const g = (((packed >> 8) & 0xff) * 0.7) | 0
      const b = (((packed >> 16) & 0xff) * 0.7) | 0
      const effectiveAlpha = Math.min(a * alpha * 5, 0.35)
      fillStyle = `rgba(${r},${g},${b},${effectiveAlpha})`
    } else if (fillStyle === undefined) {
      const r = packed & 0xff
      const g = (packed >> 8) & 0xff
      const b = (packed >> 16) & 0xff
      fillStyle = `rgba(${r},${g},${b},${a * alpha})`
      fillStyleCache.set(packed, fillStyle)
    }

    ctx.fillStyle = fillStyle
    const w = widenCorners(c, height)
    buildFeaturePath(ctx, w.sx1, w.sx2, w.sx3, w.sx4, height, drawCurves)
    ctx.fill()

    if (isClicked) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

export function drawSyntenyTrack(
  ctx: CanvasLike,
  data: SyntenyInstanceData,
  params: SyntenyTrackRenderParams,
  logicalW: number,
  maxOffScreenPx: number,
  dpr = 1,
) {
  const {
    yTop,
    height,
    alpha,
    minAlignmentLength,
    hoveredFeatureId,
    clickedFeatureId,
    drawCurves,
    isSyriMode,
  } = params

  ctx.setTransform(dpr, 0, 0, dpr, 0, yTop * dpr)
  ctx.globalAlpha = 1

  const transform = computeTransform(data, params)
  // Canvas2D parses fillStyle on every assignment, so reuse the rgba string
  // for the common case of many instances sharing a color (CIGAR fills).
  const fillStyleCache = new Map<number, string>()
  const leftLimit = -maxOffScreenPx
  const rightLimit = logicalW + maxOffScreenPx
  const args = [
    data,
    transform,
    alpha,
    height,
    minAlignmentLength,
    hoveredFeatureId,
    clickedFeatureId,
    drawCurves,
    leftLimit,
    rightLimit,
    fillStyleCache,
  ] as const

  if (isSyriMode) {
    // plotsr draws SYN first so that INV/TRANS/DUP ribbons appear on top
    drawInstances(ctx, ...args, true)
    drawInstances(ctx, ...args, false)
  } else {
    drawInstances(ctx, ...args, undefined)
  }
}

export class Canvas2DSyntenyRenderer implements SyntenyBackend {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions = new Map<number, SyntenyInstanceData>()
  private lastState: SyntenyRenderState | undefined

  private get dpr() {
    return typeof window !== 'undefined' ? window.devicePixelRatio : 1
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  resize(width: number, height: number) {
    const dpr = this.dpr
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
    }
  }

  uploadGeometry(key: number, data: SyntenyInstanceData) {
    this.regions.set(key, data)
  }

  deleteGeometry(key: number) {
    this.regions.delete(key)
  }

  render(state: SyntenyRenderState) {
    this.lastState = state

    const dpr = this.dpr
    const ctx = this.ctx
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, logicalW, logicalH)

    const { maxOffScreenPx } = state
    for (const [key, params] of state.perTrack) {
      const data = this.regions.get(key)
      if (!data || data.instanceCount === 0) {
        continue
      }
      drawSyntenyTrack(ctx, data, params, logicalW, maxOffScreenPx, dpr)
    }

    ctx.globalAlpha = 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  pick(
    x: number,
    y: number,
    onResult?: (result: SyntenyPickResult | undefined) => void,
  ): SyntenyPickResult | undefined {
    const state = this.lastState
    if (!state) {
      onResult?.(undefined)
      return undefined
    }

    const ctx = this.ctx
    const leftLimit = -state.maxOffScreenPx
    const rightLimit = this.canvas.width / this.dpr + state.maxOffScreenPx

    // Iterate tracks in reverse draw order so top-most wins.
    let topHit: SyntenyPickResult | undefined
    const entries = Array.from(state.perTrack)
    for (let ei = entries.length - 1; ei >= 0; ei--) {
      const [key, params] = entries[ei]!
      const data = this.regions.get(key)
      if (!data || data.instanceCount === 0) {
        continue
      }
      const { yTop, height, minAlignmentLength } = params
      if (y < yTop || y > yTop + height) {
        continue
      }
      const localY = y - yTop
      const transform = computeTransform(data, params)

      for (let i = data.instanceCount - 1; i >= 0; i--) {
        if (data.queryTotalLengths[i]! < minAlignmentLength) {
          continue
        }
        if (((data.colors[i]! >>> 24) & 0xff) / 255 < 0.01) {
          continue
        }

        const c = projectCorners(data, i, transform)
        if (isEdgeCulled(c, leftLimit, rightLimit)) {
          continue
        }

        const w = widenCorners(c, height)
        const minX = Math.min(w.sx1, w.sx2, w.sx3, w.sx4)
        const maxX = Math.max(w.sx1, w.sx2, w.sx3, w.sx4)
        if (x < minX || x > maxX) {
          continue
        }

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
          topHit = { key, featureIndex: i }
          break
        }
      }
      if (topHit) {
        break
      }
    }

    onResult?.(topHit)
    return topHit
  }

  dispose() {
    this.regions.clear()
    this.lastState = undefined
  }
}
