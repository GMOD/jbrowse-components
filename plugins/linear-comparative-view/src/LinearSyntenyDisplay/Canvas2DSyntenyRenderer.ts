import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
} from '@jbrowse/core/util/colorBits'

import { SyntenyGeometryCache } from './syntenyGeometryCache.ts'
import {
  buildFeaturePath,
  computeTransform,
  isEdgeCulled,
  pickFeatureAtPoint,
  projectCorners,
  strokeFeatureSideEdges,
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

type Rgba = readonly [number, number, number, number]

// Shade an instance's packed color into the final displayed fill — applying
// hover darkening and the CIGAR white pre-blend — as 0..255 rgb + 0..1 alpha.
// SYNC: mirrors shadeFill() in syntenyTypes.slang — CIGAR pre-blends with white
// at the (hover-boosted) alpha so indels fade against the page; BASE darkens by
// 0.7 and boosts alpha ×5 (capped 0.35) on hover. Keep the two in lockstep.
function shadeInstanceFill(
  packed: number,
  alpha: number,
  isCigar: boolean,
  isHovered: boolean,
): Rgba {
  const r = abgrRed(packed)
  const g = abgrGreen(packed)
  const b = abgrBlue(packed)
  const a = abgrAlpha(packed) / 255
  const darken = isHovered ? 0.7 : 1
  if (isCigar) {
    const blend = isHovered ? Math.min(a * alpha * 5, 0.35) : a * alpha
    const white = 255 * (1 - blend)
    return [
      (r * darken * blend + white) | 0,
      (g * darken * blend + white) | 0,
      (b * darken * blend + white) | 0,
      a,
    ]
  }
  return [
    (r * darken) | 0,
    (g * darken) | 0,
    (b * darken) | 0,
    isHovered ? Math.min(a * alpha * 5, 0.35) : a * alpha,
  ]
}

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
  shadeCache: Map<number, Rgba>,
  yTop: number,
) {
  for (let i = 0; i < data.instanceCount; i++) {
    if (data.alignmentLengths[i]! < minAlignmentLength) {
      continue
    }
    const packed = data.colors[i]!
    if (abgrAlpha(packed) / 255 < 0.01) {
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

    // Hover recolors per-instance; everything else shares a color per packed
    // value (e.g. the many tiles of a CIGAR fill), so cache the resolved rgba.
    let rgba = isHovered ? undefined : shadeCache.get(packed)
    if (!rgba) {
      rgba = shadeInstanceFill(packed, alpha, isCigar, isHovered)
      if (!isHovered) {
        shadeCache.set(packed, rgba)
      }
    }
    const [r, g, b, fa] = rgba

    // A geometric ctx.fill() of a sub-pixel quad deposits near-zero ink, so
    // where the GPU's fillCoverage keeps a sub-pixel ribbon as a ~1px AA band
    // the canvas2d backend would render near-blank. When the ribbon is
    // sub-pixel on both ends, stroke its centerline at 1px to reproduce that
    // footprint; otherwise fill the silhouette.
    // SYNC: scale the BASE stroke alpha by the on-screen width (clamped to
    // [0,1]) to mirror fillCoverage's widthFade — a lone thin ribbon stays a
    // faint locatable line while a whole-genome tangle fades instead of stacking
    // hard full-opacity lines. CIGAR keeps full alpha (hard-cut in the shader).
    const maxW = Math.max(Math.abs(c.sx2 - c.sx1), Math.abs(c.sx4 - c.sx3))
    if (maxW < 1) {
      const xt = (c.sx1 + c.sx2) * 0.5
      const xb = (c.sx3 + c.sx4) * 0.5
      ctx.strokeStyle = `rgba(${r},${g},${b},${isCigar ? fa : fa * maxW})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(xt, yTop)
      if (drawCurves) {
        const halfH = height * 0.5
        ctx.bezierCurveTo(xt, yTop + halfH, xb, yTop + halfH, xb, yTop + height)
      } else {
        ctx.lineTo(xb, yTop + height)
      }
      ctx.stroke()
    } else {
      ctx.fillStyle = `rgba(${r},${g},${b},${fa})`
      buildFeaturePath(ctx, c, yTop, height, drawCurves)
      ctx.fill()
      if (isClicked && !isCigar) {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'
        ctx.lineWidth = 1
        strokeFeatureSideEdges(ctx, c, yTop, height, drawCurves)
      }
    }
  }
}

// Draws in logical (CSS-px) coordinates with yTop baked into the y values, so
// the caller's canvas transform only ever carries the device scale — the SVG
// raster export's pre-applied ctx.scale(dpr) and the interactive backend's
// single setTransform(dpr) both work without this function touching it.
export function drawSyntenyTrack(
  ctx: CanvasLike,
  data: SyntenyInstanceData,
  params: SyntenyTrackRenderParams,
  logicalW: number,
  overdrawPx: number,
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

  const transform = computeTransform(params)
  // Resolved color is shared by many instances of one packed value (e.g. the
  // tiles of a CIGAR fill); cache the shading so it runs once per color.
  const shadeCache = new Map<number, Rgba>()
  const leftLimit = -overdrawPx
  const rightLimit = logicalW + overdrawPx

  drawInstances(
    ctx,
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
    shadeCache,
    yTop,
  )
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

    // Single device-scale transform for the whole pass; drawSyntenyTrack draws
    // in logical coords and bakes each track's yTop into its y values.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, logicalW, logicalH)

    const { overdrawPx } = state
    for (const [key, params] of state.perTrack) {
      const data = this.cache.regions.get(key)
      if (!data || data.instanceCount === 0) {
        continue
      }
      drawSyntenyTrack(ctx, data, params, logicalW, overdrawPx)
    }
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
