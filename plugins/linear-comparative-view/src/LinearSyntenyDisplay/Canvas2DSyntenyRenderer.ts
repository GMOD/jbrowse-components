import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { syriColors } from './drawSyntenyUtils.ts'
import {
  buildFeaturePath,
  computeTransform,
  isEdgeCulled,
  pickFeatureAtPoint,
  projectCorners,
  widenCorners,
} from './syntenyPickEngine.ts'

import type {
  SyntenyBackend,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
import type {
  CanvasLike,
  ComputedTransform,
  PickIndex,
} from './syntenyPickEngine.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

export type { CanvasLike } from './syntenyPickEngine.ts'

const PACKED_SYN = cssColorToABGR(syriColors.SYN)

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

    const featureId = data.instanceFeatureIdx[i]! + 1
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

  const transform = computeTransform(params)
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
  private pickIndices = new Map<number, PickIndex>()

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
    this.pickIndices.delete(key)
  }

  deleteGeometry(key: number) {
    this.regions.delete(key)
    this.pickIndices.delete(key)
  }

  render(state: SyntenyRenderState) {
    this.lastState = state
    if (this.regions.size === 0) {
      return false
    }

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

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return true
  }

  pick(x: number, y: number) {
    const state = this.lastState
    if (!state) {
      return undefined
    }
    return pickFeatureAtPoint({
      ctx: this.ctx,
      state,
      regions: this.regions,
      pickIndices: this.pickIndices,
      canvasLogicalWidth: this.canvas.width / this.dpr,
      x,
      y,
    })
  }

  dispose() {
    this.regions.clear()
    this.pickIndices.clear()
    this.lastState = undefined
  }
}
