import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
} from '@jbrowse/core/util/colorBits'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'

import {
  fillShade,
  hoverDarken,
  isCigarKind,
  isMarkerKind,
  thinWidthFade,
} from './shaders/syntenyTypes.js.generated.ts'
import { SyntenyGeometryCache } from './syntenyGeometryCache.ts'
import { makePickCtx, pickFeatureAtPoint } from './syntenyPickEngine.ts'
import {
  buildFeaturePath,
  computeTransform,
  isInstanceInvisible,
  isRibbonCulled,
  makeCornerScratch,
  projectCorners,
  ribbonPerpWidth,
  strokeCenterline,
  strokeFeatureSideEdges,
} from './syntenyRibbonPath.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PickCanvasLike } from './syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyRenderingBackend,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'
import type { CanvasLike } from './syntenyRibbonPath.ts'

export type { CanvasLike } from './syntenyRibbonPath.ts'

// Memoized `rgba()` text plus last-assigned tracking for one draw pass.
// Building the strings is the dominant per-instance cost in the draw loop — a
// 500k-instance pass spends >100ms on nothing but `rgba()` construction, before
// the engine's per-assignment color parse — while the number of distinct colors
// is tiny: the identity/MAPQ ramps are 256-entry LUTs and the chromosome palette
// is 9 colors.
//
// Keyed on the resolved 8-bit RGB plus the alpha rounded to a byte, so it needs
// no knowledge of how a color was derived. Colors whose alpha comes from a
// packed byte (every fill and marker) round-trip exactly. Only the sub-pixel
// stroke's continuous width-fade can collide, and then it reuses a string within
// 1/510 alpha of the exact one — below the 8-bit grid the canvas composites to.
// Scoped per pass rather than kept on the renderer: no unbounded growth, and the
// hit rate within one pass is what matters.
class StyleCache {
  private strings = new Map<number, string>()
  private lastFill: string | undefined
  private lastStroke: string | undefined

  private text(r: number, g: number, b: number, a: number) {
    const key = ((r << 24) | (g << 16) | (b << 8) | Math.round(a * 255)) >>> 0
    let s = this.strings.get(key)
    if (s === undefined) {
      s = `rgba(${r},${g},${b},${a})`
      this.strings.set(key, s)
    }
    return s
  }

  fill(ctx: CanvasLike, r: number, g: number, b: number, a: number) {
    const s = this.text(r, g, b, a)
    if (s !== this.lastFill) {
      ctx.fillStyle = s
      this.lastFill = s
    }
  }

  stroke(ctx: CanvasLike, r: number, g: number, b: number, a: number) {
    const s = this.text(r, g, b, a)
    if (s !== this.lastStroke) {
      ctx.strokeStyle = s
      this.lastStroke = s
    }
  }

  // The clicked-feature outline is a literal, so it bypasses the memo but still
  // needs to participate in the last-assigned tracking.
  strokeLiteral(ctx: CanvasLike, s: string) {
    if (s !== this.lastStroke) {
      ctx.strokeStyle = s
      this.lastStroke = s
    }
  }
}

interface ResolvedFill {
  r: number
  g: number
  b: number
  a: number
}

// Displayed fill for one instance, from its packed color + hover state. A few
// arithmetic ops rather than a per-color Map lookup — the draw loop runs this
// once per on-screen instance.
//
// `fillShade` and `hoverDarken` are the shader's own — generated from
// syntenyTypes.slang, where they were factored out of shadeFill() precisely so
// this function could call them (adr-051). What is left here is the conversion
// the two backends genuinely do differently: the shader blends 0-1 floats and
// lets the rasterizer quantize, this builds the 0-255 bytes an `rgba()` string
// needs. `shade` doubles as the CIGAR white-blend factor and the BASE output
// alpha, the same way it does in the shader.
//
// Rounding, not truncating: quantizing to 8 bits is what the GPU does at the
// end of the fragment stage, and `| 0` biased every channel down by up to a
// full unit. It also keeps the float32 constants the generator emits (0.35
// arrives as 0.34999999403953552) from tipping a product that lands on an exact
// integer — 255 * 0.35 — down a whole step.
function resolveInstanceFill(
  packed: number,
  isCigar: boolean,
  isHovered: boolean,
  alpha: number,
): ResolvedFill {
  const pa = abgrAlpha(packed) / 255
  const darken = hoverDarken(isHovered)
  const shade = fillShade(pa, alpha, isHovered)
  const r = abgrRed(packed) * darken
  const g = abgrGreen(packed) * darken
  const b = abgrBlue(packed) * darken
  const white = 255 * (1 - shade)
  return isCigar
    ? {
        r: Math.round(r * shade + white),
        g: Math.round(g * shade + white),
        b: Math.round(b * shade + white),
        a: pa,
      }
    : { r: Math.round(r), g: Math.round(g), b: Math.round(b), a: shade }
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
  const transform = computeTransform(params, data)
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
  const style = new StyleCache()
  const scratch = makeCornerScratch()
  // Every stroke this function makes is 1px (centerlines, marker ticks, the
  // clicked outline), so the width is set once for the pass.
  ctx.lineWidth = 1
  for (let i = 0; i < data.instanceCount; i++) {
    if (data.alignmentLengths[i]! < minAlignmentLength) {
      continue
    }
    const packed = data.colors[i]!
    if (isInstanceInvisible(packed)) {
      continue
    }

    // Read before the cull, which needs it: a marker is culled by its hull
    // where a ribbon is culled per edge (see isRibbonCulled).
    const kind = data.kinds[i]!
    const isMarker = isMarkerKind(kind)

    const c = projectCorners(data, i, transform, scratch)
    if (isRibbonCulled(c, logicalW, overdrawPx, isMarker)) {
      continue
    }

    // Location markers: zero-width context ticks. Drawn as a fixed 1px line at
    // the packed color's own alpha (~0.25), bypassing hover/global-alpha and
    // the sub-pixel width fade that would zero a zero-width quad. Mirrors the
    // isMarker path in syntenyTypes.slang's fillFs/shadeFill — and the
    // predicate itself is now the shader's, generated (adr-051), so the
    // threshold can't drift even though the shading below still can.
    if (isMarker) {
      style.stroke(
        ctx,
        abgrRed(packed),
        abgrGreen(packed),
        abgrBlue(packed),
        abgrAlpha(packed) / 255,
      )
      strokeCenterline(ctx, c, yTop, height, drawCurves)
      continue
    }

    const featureId = data.instanceFeatureIdx[i]! + 1
    const isHovered = featureId === hoveredFeatureId
    const isClicked = featureId === clickedFeatureId
    const isCigar = isCigarKind(kind)
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
    // pickability (syntenyPickEngine.pickFeatureAtPoint via ribbonPerpWidth), so a
    // ribbon is clickable exactly when it's drawn as a solid fill.
    // The BASE alpha fade is the shader's own `thinWidthFade` — a lone thin
    // ribbon stays a faint locatable line while a whole-genome tangle fades
    // instead of stacking hard full-opacity lines. CIGAR keeps full alpha
    // (indel detail stays solid), as it does in fillFs. What is NOT
    // shared is `perpW` itself: perpCoverage measures a per-fragment width from
    // the two edges' own foreshortenings, this measures the whole ribbon's from
    // its corners, and each is right for the decision it feeds.
    // Deliberate divergence: the clicked outline is drawn only on the fill
    // branch. The GPU edge pass has no thinness gate, but a sub-pixel ribbon's
    // two side edges coincide, so outlining one here would just overstrike the
    // centerline darker — and a sub-pixel ribbon isn't pickable in the first
    // place, so it can only be the clicked one after a zoom-out.
    const perpW = ribbonPerpWidth(c, height)
    if (perpW < 1) {
      const widthFade = thinWidthFade(perpW, fadeThinAlignments && !isCigar)
      style.stroke(ctx, r, g, b, fa * widthFade)
      strokeCenterline(ctx, c, yTop, height, drawCurves)
    } else {
      style.fill(ctx, r, g, b, fa)
      buildFeaturePath(ctx, c, yTop, height, drawCurves)
      ctx.fill()
      if (isClicked && !isCigar) {
        style.strokeLiteral(ctx, 'rgba(0,0,0,0.4)')
        strokeFeatureSideEdges(ctx, c, yTop, height, drawCurves)
      }
    }
  }
}

export class Canvas2DSyntenyRenderer
  extends Canvas2DRenderingBackendBase
  implements SyntenyRenderingBackend
{
  private cache = new SyntenyGeometryCache()
  // Its own, NOT `this.ctx` — see makePickCtx. This backend is the one that
  // carries a device-scale transform on its render context, so it is the one
  // the distinction was invisible in.
  private pickCtx: PickCanvasLike | undefined

  private get dpr() {
    return getDpr()
  }

  constructor(canvas: HTMLCanvasElement) {
    // The base owns `canvas`, the acquired 2D context, and the no-op
    // `setErrorHandler` (no GPU resources, so no OOM channel to forward).
    super(canvas)
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

  // Background wipe, and the start of every render pass. Sets the one
  // device-scale transform the pass runs under — drawSyntenyTrack draws in
  // logical coords and bakes each track's yTop into its y values.
  private clear() {
    const dpr = this.dpr
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr)
  }

  render(state: SyntenyRenderState) {
    const ctx = this.ctx
    const logicalW = this.canvas.width / this.dpr

    this.clear()

    const { overdrawPx } = state
    for (const [key, params] of state.perTrack) {
      const data = this.cache.regions.get(key)
      if (!data || data.instanceCount === 0) {
        continue
      }
      drawSyntenyTrack(ctx, data, params, logicalW, overdrawPx)
    }
  }

  pick(x: number, y: number, state: SyntenyRenderState) {
    this.pickCtx ??= makePickCtx()
    const ctx = this.pickCtx
    if (!ctx) {
      return undefined
    }
    return pickFeatureAtPoint({
      ctx,
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
