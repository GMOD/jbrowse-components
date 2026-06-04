import { SyntenyGeometryCache } from './syntenyGeometryCache.ts'
import {
  buildFeaturePath,
  computeTransform,
  isEdgeCulled,
  pickFeatureAtPoint,
  projectCorners,
} from './syntenyPickEngine.ts'
import { KIND_CIGAR_MATCH } from '../LinearSyntenyRPC/syntenyColors.ts'

import type { CanvasLike, ComputedTransform } from './syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyRenderingBackend,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'
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

    const isCigar = data.kinds[i]! >= KIND_CIGAR_MATCH
    let fillStyle = fillStyleCache.get(packed)
    if (isHovered) {
      // SYNC: hover branch must match the fill shaders.
      // CIGAR indels: darken the pre-blended color (same opaque path as normal).
      // BASE blocks: standard 0.7 darkening + 5x alpha boost capped at 0.35.
      const r = packed & 0xff
      const g = (packed >> 8) & 0xff
      const b = (packed >> 16) & 0xff
      if (isCigar) {
        // Apply 0.7 darkening inside the blend — same order as origin/main
        // (darken first, then blend with white) so hover color matches exactly.
        const blendAlpha = Math.min(a * alpha * 5, 0.35)
        const pr = (r * 0.7 * blendAlpha + 255 * (1 - blendAlpha)) | 0
        const pg = (g * 0.7 * blendAlpha + 255 * (1 - blendAlpha)) | 0
        const pb = (b * 0.7 * blendAlpha + 255 * (1 - blendAlpha)) | 0
        fillStyle = `rgba(${pr},${pg},${pb},${a})`
      } else {
        const dr = (r * 0.7) | 0
        const dg = (g * 0.7) | 0
        const db = (b * 0.7) | 0
        const effectiveAlpha = Math.min(a * alpha * 5, 0.35)
        fillStyle = `rgba(${dr},${dg},${db},${effectiveAlpha})`
      }
    } else if (fillStyle === undefined) {
      const r = packed & 0xff
      const g = (packed >> 8) & 0xff
      const b = (packed >> 16) & 0xff
      if (isCigar) {
        // Pre-blend with white so indel quads visually fade against the page
        // background rather than compositing semi-transparently over the base
        // block (which would mix the indel color with the match/base color).
        const pr = (r * alpha + 255 * (1 - alpha)) | 0
        const pg = (g * alpha + 255 * (1 - alpha)) | 0
        const pb = (b * alpha + 255 * (1 - alpha)) | 0
        fillStyle = `rgba(${pr},${pg},${pb},${a})`
      } else {
        fillStyle = `rgba(${r},${g},${b},${a * alpha})`
      }
      fillStyleCache.set(packed, fillStyle)
    }

    // The fill shaders' fillCoverage gives a sub-pixel base ribbon a ~1px-wide
    // AA footprint (smoothstep over fwidth floors the band at one pixel), so it
    // keeps a ~0.5-coverage centerline and stays visible at whole-genome zoom.
    // A geometric ctx.fill() of a sub-pixel quad instead deposits near-zero ink,
    // so without this the canvas2d backend renders near-blank where the GPU
    // shows dense ribbons. When the ribbon is sub-pixel on both ends, stroke its
    // centerline at 1px to match that floor; otherwise fill the silhouette.
    const topW = Math.abs(c.sx2 - c.sx1)
    const botW = Math.abs(c.sx4 - c.sx3)
    if (Math.max(topW, botW) < 1) {
      const xt = (c.sx1 + c.sx2) * 0.5
      const xb = (c.sx3 + c.sx4) * 0.5
      ctx.strokeStyle = fillStyle
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(xt, 0)
      if (drawCurves) {
        const halfH = height * 0.5
        ctx.bezierCurveTo(xt, halfH, xb, halfH, xb, height)
      } else {
        ctx.lineTo(xb, height)
      }
      ctx.stroke()
    } else {
      ctx.fillStyle = fillStyle
      buildFeaturePath(ctx, c, height, drawCurves)
      ctx.fill()
      if (isClicked && !isCigar) {
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

export class Canvas2DSyntenyRenderer implements SyntenyRenderingBackend {
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
