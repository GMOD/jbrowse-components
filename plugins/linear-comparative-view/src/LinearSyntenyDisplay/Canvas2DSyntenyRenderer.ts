import { SyntenyGeometryCache } from './syntenyGeometryCache.ts'
import {
  buildFeaturePath,
  computeTransform,
  isEdgeCulled,
  pickFeatureAtPoint,
  projectCorners,
} from './syntenyPickEngine.ts'

import type {
  SyntenyBackend,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
import type { CanvasLike, ComputedTransform } from './syntenyPickEngine.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

export type { CanvasLike } from './syntenyPickEngine.ts'

function drawInstances(
  ctx: CanvasLike,
  data: SyntenyInstanceData,
  transform: ComputedTransform,
  alpha: number,
  height: number,
  minAlignmentLength: number,
  hoveredFeatureId: number,
  clickedFeatureId: number,
  drawCurves: boolean,
  leftLimit: number,
  rightLimit: number,
  fillStyleCache: Map<number, string>,
) {
  for (let i = 0; i < data.instanceCount; i++) {
    if (data.alignmentLengths[i]! < minAlignmentLength) {
      continue
    }
    const packed = data.colors[i]!
    const a = ((packed >>> 24) & 0xff) / 255
    if (a < 0.01) {
      continue
    }

    const c = projectCorners(data, i, transform)
    if (isEdgeCulled(c, leftLimit, rightLimit)) {
      continue
    }

    const featureId = data.instanceFeatureIdx[i]! + 1
    const isHovered = featureId === hoveredFeatureId
    const isClicked = featureId === clickedFeatureId

    let fillStyle = fillStyleCache.get(packed)
    if (isHovered) {
      // SYNC: 0.7 darkening + 5x alpha boost capped at 0.35 must match
      // the fill shaders' hover branch so the highlight looks identical
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

    // SYNC: matches origin/main drawRef.ts thin-feature handling and the
    // minimum-half-width clamp in the fill shaders. Features whose top and
    // bottom screen widths are both ≤ 1px are drawn as a 1px stroke down
    // the centerline at full alpha; fill alone gives partial-coverage AA
    // that renders sub-pixel ribbons too faintly.
    const l1 = Math.abs(c.sx2 - c.sx1)
    const l2 = Math.abs(c.sx4 - c.sx3)
    if (l1 <= 1 && l2 <= 1) {
      ctx.strokeStyle = fillStyle
      ctx.lineWidth = 1
      ctx.beginPath()
      const topX = (c.sx1 + c.sx2) * 0.5
      const botX = (c.sx3 + c.sx4) * 0.5
      ctx.moveTo(topX, 0)
      if (drawCurves) {
        const halfH = height * 0.5
        ctx.bezierCurveTo(topX, halfH, botX, halfH, botX, height)
      } else {
        ctx.lineTo(botX, height)
      }
      ctx.stroke()
    } else {
      ctx.fillStyle = fillStyle
      buildFeaturePath(ctx, c, height, drawCurves)
      ctx.fill()
      if (isClicked) {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }
}

export function drawSyntenyTrack(
  ctx: CanvasLike,
  data: SyntenyInstanceData,
  params: SyntenyTrackRenderParams,
  logicalW: number,
  overdrawPx: number,
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
  } = params

  ctx.setTransform(dpr, 0, 0, dpr, 0, yTop * dpr)

  const transform = computeTransform(params)
  // Canvas2D parses fillStyle on every assignment, so reuse the rgba string
  // for the common case of many instances sharing a color (CIGAR fills).
  const fillStyleCache = new Map<number, string>()
  const leftLimit = -overdrawPx
  const rightLimit = logicalW + overdrawPx
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

  drawInstances(ctx, ...args)
}

export class Canvas2DSyntenyRenderer implements SyntenyBackend {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cache = new SyntenyGeometryCache()

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
    this.cache.set(key, data)
  }

  deleteGeometry(key: number) {
    this.cache.delete(key)
  }

  render(state: SyntenyRenderState) {
    if (this.cache.regions.size === 0) {
      return false
    }

    const dpr = this.dpr
    const ctx = this.ctx
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, logicalW, logicalH)

    const { overdrawPx } = state
    for (const [key, params] of state.perTrack) {
      const data = this.cache.regions.get(key)
      if (!data || data.instanceCount === 0) {
        continue
      }
      drawSyntenyTrack(ctx, data, params, logicalW, overdrawPx, dpr)
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return true
  }

  pick(x: number, y: number, state: SyntenyRenderState) {
    return pickFeatureAtPoint({
      ctx: this.ctx,
      state,
      regions: this.cache.regions,
      pickIndices: this.cache.pickIndices,
      canvasLogicalWidth: this.canvas.width / this.dpr,
      x,
      y,
    })
  }

  dispose() {
    this.cache.clear()
  }
}
