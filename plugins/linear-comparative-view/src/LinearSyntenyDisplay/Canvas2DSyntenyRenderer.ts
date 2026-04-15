import type {
  SyntenyBackend,
  SyntenyPickResult,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

const CURVE_SEGMENTS = 16

function hermiteY(t: number, height: number) {
  return height * (1.5 * t * (1 - t) + t * t * t)
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

function buildFeaturePath(
  ctx: CanvasRenderingContext2D,
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
      this.renderOne(data, params, logicalW, maxOffScreenPx)
    }

    ctx.globalAlpha = 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private renderOne(
    data: SyntenyInstanceData,
    params: SyntenyTrackRenderParams,
    logicalW: number,
    maxOffScreenPx: number,
  ) {
    const ctx = this.ctx
    const dpr = this.dpr
    const {
      yTop,
      height,
      alpha,
      minAlignmentLength,
      hoveredFeatureId,
      clickedFeatureId,
    } = params

    ctx.setTransform(dpr, 0, 0, dpr, 0, yTop * dpr)
    const { scale0, scale1, adjOff0, adjOff1, scaleDiff0, scaleDiff1 } =
      computeTransform(data, params)

    for (let i = 0; i < data.instanceCount; i++) {
      if (data.queryTotalLengths[i]! < minAlignmentLength) {
        continue
      }

      const packed = data.colors[i]!
      const a = ((packed >>> 24) & 0xff) / 255
      if (a < 0.01) {
        continue
      }
      let r = (packed & 0xff) / 255
      let g = ((packed >> 8) & 0xff) / 255
      let b = ((packed >> 16) & 0xff) / 255

      const padTop = data.padTops[i]!
      const padBottom = data.padBottoms[i]!

      const sx1 = (data.x1[i]! - adjOff0) * scale0 - padTop * scaleDiff0
      const sx2 = (data.x2[i]! - adjOff0) * scale0 - padTop * scaleDiff0
      const sx3 = (data.x3[i]! - adjOff1) * scale1 - padBottom * scaleDiff1
      const sx4 = (data.x4[i]! - adjOff1) * scale1 - padBottom * scaleDiff1

      const minX = Math.min(sx1, sx2, sx3, sx4)
      const maxX = Math.max(sx1, sx2, sx3, sx4)
      if (maxX < -maxOffScreenPx || minX > logicalW + maxOffScreenPx) {
        continue
      }

      const isHovered = data.featureIds[i] === hoveredFeatureId
      const isClicked = data.featureIds[i] === clickedFeatureId

      let effectiveAlpha: number
      if (isHovered) {
        r *= 0.7
        g *= 0.7
        b *= 0.7
        effectiveAlpha = Math.min(a * alpha * 5, 0.35)
      } else {
        effectiveAlpha = a * alpha
      }

      const ri = Math.round(r * 255)
      const gi = Math.round(g * 255)
      const bi = Math.round(b * 255)

      ctx.globalAlpha = 1
      ctx.fillStyle = `rgba(${ri},${gi},${bi},${effectiveAlpha})`

      buildFeaturePath(ctx, sx1, sx2, sx3, sx4, height, data.isCurves[i]! > 0.5)
      ctx.fill()

      if (isClicked) {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
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
    // Iterate tracks in reverse draw order so top-most wins.
    const entries = Array.from(state.perTrack.entries()).reverse()
    for (const [key, params] of entries) {
      const data = this.regions.get(key)
      if (!data || data.instanceCount === 0) {
        continue
      }
      const { yTop, height, minAlignmentLength } = params
      if (y < yTop || y > yTop + height) {
        continue
      }
      const localY = y - yTop
      const { scale0, scale1, adjOff0, adjOff1, scaleDiff0, scaleDiff1 } =
        computeTransform(data, params)

      for (let i = data.instanceCount - 1; i >= 0; i--) {
        if (data.queryTotalLengths[i]! < minAlignmentLength) {
          continue
        }
        if (((data.colors[i]! >>> 24) & 0xff) / 255 < 0.01) {
          continue
        }

        const padTop = data.padTops[i]!
        const padBottom = data.padBottoms[i]!
        const sx1 = (data.x1[i]! - adjOff0) * scale0 - padTop * scaleDiff0
        const sx2 = (data.x2[i]! - adjOff0) * scale0 - padTop * scaleDiff0
        const sx3 = (data.x3[i]! - adjOff1) * scale1 - padBottom * scaleDiff1
        const sx4 = (data.x4[i]! - adjOff1) * scale1 - padBottom * scaleDiff1

        buildFeaturePath(
          ctx,
          sx1,
          sx2,
          sx3,
          sx4,
          height,
          data.isCurves[i]! > 0.5,
        )

        if (ctx.isPointInPath(x, localY)) {
          const result = { key, featureIndex: i }
          onResult?.(result)
          return result
        }
      }
    }

    onResult?.(undefined)
    return undefined
  }

  dispose() {
    this.regions.clear()
    this.lastState = undefined
  }
}
