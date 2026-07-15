import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
} from '@jbrowse/core/util/colorBits'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'

import { SyntenyGeometryCache } from './syntenyGeometryCache.ts'
import {
  buildFeaturePath,
  computeTransform,
  isEdgeCulled,
  pickFeatureAtPoint,
  projectCorners,
  ribbonPerpWidth,
  strokeCenterline,
  strokeFeatureSideEdges,
} from './syntenyPickEngine.ts'
import {
  KIND_CIGAR_MATCH,
  KIND_MARKER,
} from '../LinearSyntenyRPC/syntenyColors.ts'

import type { CanvasLike, ComputedTransform } from './syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyRenderingBackend,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

export type { CanvasLike } from './syntenyPickEngine.ts'

// SYNC: mirrors WIDTH_FADE_FLOOR in syntenyTypes.slang — keeps a lone
// sub-pixel ribbon faintly locatable instead of fading all the way to
// invisible on a whole-genome view with no minAlignmentLength filter.
const WIDTH_FADE_FLOOR = 0.15

const rgba = (r: number, g: number, b: number, a: number) =>
  `rgba(${r},${g},${b},${a})`

interface ResolvedFill {
  r: number
  g: number
  b: number
  a: number
}

// Displayed fill for one instance, from its packed color + hover state. A few
// arithmetic ops rather than a per-color Map lookup — the draw loop runs this
// once per on-screen instance. `shade` doubles as the CIGAR white-blend factor
// and the BASE output alpha (identical expression in both branches).
// SYNC: mirrors shadeFill() in syntenyTypes.slang — CIGAR pre-blends with white
// at the (hover-boosted) alpha so indels fade against the page; BASE darkens by
// 0.7 and boosts alpha ×5 (capped 0.35) on hover.
function resolveInstanceFill(
  packed: number,
  isCigar: boolean,
  isHovered: boolean,
  alpha: number,
): ResolvedFill {
  const pa = abgrAlpha(packed) / 255
  const darken = isHovered ? 0.7 : 1
  const shade = isHovered ? Math.min(pa * alpha * 5, 0.35) : pa * alpha
  const r = abgrRed(packed) * darken
  const g = abgrGreen(packed) * darken
  const b = abgrBlue(packed) * darken
  const white = 255 * (1 - shade)
  return isCigar
    ? {
        r: (r * shade + white) | 0,
        g: (g * shade + white) | 0,
        b: (b * shade + white) | 0,
        a: pa,
      }
    : { r: r | 0, g: g | 0, b: b | 0, a: shade }
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
  yTop: number,
  fadeThinAlignments: boolean,
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

    // Location markers: zero-width context ticks. Drawn as a fixed 1px line at
    // the packed color's own alpha (~0.25), bypassing hover/global-alpha and
    // the sub-pixel width fade that would zero a zero-width quad.
    // SYNC: mirrors the isMarker path in syntenyTypes.slang's fillCoverage/
    // shadeFill.
    const kind = data.kinds[i]!
    if (kind === KIND_MARKER) {
      const xt = (c.sx1 + c.sx2) * 0.5
      const xb = (c.sx3 + c.sx4) * 0.5
      ctx.strokeStyle = rgba(
        abgrRed(packed),
        abgrGreen(packed),
        abgrBlue(packed),
        abgrAlpha(packed) / 255,
      )
      ctx.lineWidth = 1
      strokeCenterline(ctx, xt, xb, yTop, height, drawCurves)
      continue
    }

    const featureId = data.instanceFeatureIdx[i]! + 1
    const isHovered = featureId === hoveredFeatureId
    const isClicked = featureId === clickedFeatureId
    const isCigar = kind >= KIND_CIGAR_MATCH
    const {
      r,
      g,
      b,
      a: fa,
    } = resolveInstanceFill(packed, isCigar, isHovered, alpha)

    // Sub-pixel handling keys on the ribbon's PERPENDICULAR (visual) thickness,
    // not horizontal span: a steep diagonal can be several px wide horizontally
    // yet razor-thin perpendicular, and ctx.fill() of such a degenerate sliver
    // antialiases poorly (ragged diagonals in SVG export). Below 1px thick we
    // instead stroke the centerline at 1px, which canvas renders cleanly at any
    // slope; above it we fill the silhouette. The same perpW<1 boundary gates
    // pickability (syntenyPickEngine.buildPickIndex via ribbonPerpWidth), so a
    // ribbon is clickable exactly when it's drawn as a solid fill.
    // SYNC: perpFactor and the BASE alpha fade (×widthFade, floored at
    // WIDTH_FADE_FLOOR, gated by fadeThinAlignments) mirror fillCoverage's
    // perpFactor/widthFade — a lone thin ribbon stays a faint locatable line
    // while a whole-genome tangle fades instead of stacking hard
    // full-opacity lines. CIGAR keeps full alpha (indel detail stays solid; the
    // shader likewise skips the density fade for CIGAR in fillCoverage).
    const perpW = ribbonPerpWidth(c, height)
    if (perpW < 1) {
      const xt = (c.sx1 + c.sx2) * 0.5
      const xb = (c.sx3 + c.sx4) * 0.5
      const widthFade = fadeThinAlignments
        ? Math.max(perpW, WIDTH_FADE_FLOOR)
        : 1
      ctx.strokeStyle = rgba(r, g, b, isCigar ? fa : fa * widthFade)
      ctx.lineWidth = 1
      strokeCenterline(ctx, xt, xb, yTop, height, drawCurves)
    } else {
      ctx.fillStyle = rgba(r, g, b, fa)
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
    fadeThinAlignments,
  } = params

  const transform = computeTransform(params)
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
    yTop,
    fadeThinAlignments,
  )
}

export class Canvas2DSyntenyRenderer implements SyntenyRenderingBackend {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cache = new SyntenyGeometryCache()

  private get dpr() {
    return getDpr()
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
