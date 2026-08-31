import { alpha as withAlpha, getContrastText } from '@jbrowse/core/ui/palette'
import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
  cssColorToRgb,
} from '@jbrowse/core/util/colorBits'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'

import { STROKE_ALPHA } from './shaders/syntenyTypes.generated.ts'
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
  ribbonMaxPerpWidth,
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
//
// `ground` is the 0-255 twin of the shader's `u.ground` — the colour the band
// was just cleared to, which the CIGAR branch bakes in rather than composites
// against. Passed in resolved rather than parsed here: the draw loop runs this
// once per on-screen instance.
function resolveInstanceFill(
  packed: number,
  isCigar: boolean,
  isHovered: boolean,
  alpha: number,
  ground: [number, number, number],
): ResolvedFill {
  const pa = abgrAlpha(packed) / 255
  const darken = hoverDarken(isHovered)
  const shade = fillShade(pa, alpha, isHovered)
  const r = abgrRed(packed) * darken
  const g = abgrGreen(packed) * darken
  const b = abgrBlue(packed) * darken
  const rest = 1 - shade
  return isCigar
    ? {
        r: Math.round(r * shade + ground[0] * rest),
        g: Math.round(g * shade + ground[1] * rest),
        b: Math.round(b * shade + ground[2] * rest),
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
  groundColor: string,
) {
  const ground = cssColorToRgb(groundColor)
  const outlineInk = withAlpha(getContrastText(groundColor), STROKE_ALPHA)
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
    // Read before both tests below, which each need it: a marker keeps its own
    // alpha through the opacity slider (see isInstanceInvisible), and is culled
    // by its hull where a ribbon is culled per edge (see isRibbonCulled).
    const kind = data.kinds[i]!
    const isMarker = isMarkerKind(kind)

    const packed = data.colors[i]!
    if (isInstanceInvisible(packed, isMarker ? 1 : alpha)) {
      continue
    }

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
    } = resolveInstanceFill(packed, isCigar, isHovered, alpha, ground)

    // Sub-pixel handling keys on the ribbon's PERPENDICULAR (visual) thickness,
    // not horizontal span: a steep diagonal can be several px wide horizontally
    // yet razor-thin perpendicular, and ctx.fill() of such a degenerate sliver
    // antialiases poorly (ragged diagonals in SVG export). Below 1px thick we
    // instead stroke the centerline at 1px, which canvas renders cleanly at any
    // slope; above it we fill the silhouette. The same boundary gates pickability
    // (syntenyPickEngine.pickFeatureAtPoint calls the same function), so a ribbon
    // is clickable exactly when it's drawn as a solid fill.
    //
    // TWO measures, because a curved ribbon has no single width: the branch asks
    // the WIDEST it ever gets, since a shape that clears a pixel anywhere is one
    // ctx.fill() traces better than a 1px line replaces; the fade then describes
    // the shape that branch settled on. Identical in straight mode, where the
    // ribbon is the same width all the way down. See ribbonMaxPerpWidth.
    //
    // NOT TIMED, and worth saying so where the branch is rather than in a commit
    // message: this moved some curved ribbons from the stroke arm to the fill
    // arm, and a fill is a path plus a rasterize where a stroke is one 1px line.
    // The correctness case for it was measured (cross-backend drift 1.59% ->
    // 0.57%) and the cost was not. It is bounded — a ribbon only moves when it
    // is genuinely a pixel wide somewhere, so a whole-genome hairball, which is
    // where this loop is hot, has almost none that qualify — and this is the
    // fallback backend besides. But if a Canvas2D-only view ever measures slow
    // in curve mode, start here.
    //
    // The alpha fade is the shader's own `thinWidthFade`, handed the same kind
    // the fragment stage reads — a lone thin ribbon stays a faint locatable
    // line while a whole-genome tangle fades instead of stacking hard
    // full-opacity lines, CIGAR keeps full alpha, and a match tile fades by its
    // own width so a tiled feature's stack of 1px strokes adds up to the
    // feature. What is NOT shared is `perpW` itself: perpCoverage measures a
    // per-fragment width from the two edges' own foreshortenings, this measures
    // the whole ribbon's from its corners, and each is right for the decision
    // it feeds.
    // Deliberate divergence: the clicked outline is drawn only on the fill
    // branch. The GPU edge pass has no thinness gate, but a sub-pixel ribbon's
    // two side edges coincide, so outlining one here would just overstrike the
    // centerline darker — and a sub-pixel ribbon isn't pickable in the first
    // place, so it can only be the clicked one after a zoom-out.
    if (ribbonMaxPerpWidth(c, height, drawCurves) < 1) {
      const perpW = ribbonPerpWidth(c, height)
      const widthFade = thinWidthFade(perpW, kind, fadeThinAlignments)
      style.stroke(ctx, r, g, b, fa * widthFade)
      strokeCenterline(ctx, c, yTop, height, drawCurves)
    } else {
      style.fill(ctx, r, g, b, fa)
      buildFeaturePath(ctx, c, yTop, height, drawCurves)
      ctx.fill()
      if (isClicked && !isCigar) {
        style.strokeLiteral(ctx, outlineInk)
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

  upload(key: number, data: SyntenyInstanceData) {
    this.cache.set(key, data)
  }

  release(key: number) {
    this.cache.delete(key)
  }

  // Background wipe, and the start of every render pass. Sets the one
  // device-scale transform the pass runs under — drawSyntenyTrack draws in
  // logical coords and bakes each track's yTop into its y values.
  //
  // OPAQUE AND KNOWN, NOT TRANSPARENT, and it is load-bearing for what the band
  // looks like rather than for what it costs. Every other backend in the tree
  // clears to (0,0,0,0); this one and its GPU twin (`beginFrame`) do not,
  // because the two fill branches only agree over a ground they both know.
  // `resolveInstanceFill` above is the arithmetic: a BASE ribbon comes out
  // `rgb*darken` at alpha `shade`, while a CIGAR indel comes out
  // `rgb*darken*shade + ground*(1 - shade)` FULLY OPAQUE — the indel palette is
  // opaque literals (`colorUtils.ts` warns against a non-opaque one). Those land
  // on the same pixel only when the destination IS `ground`, since
  // base-over-ground is `rgb*shade + ground*(1 - shade)`, the pre-blend byte for
  // byte. Over any other backdrop the indel stays blended toward a colour that
  // is not there while the base beside it composites over the real one, so every
  // indel wedge reads as a hole punched in the band. `shadeFill` in
  // syntenyTypes.slang is the GPU spelling of the same thing, and
  // `blendOverGround` a third for the legend chips.
  //
  // NOT A PERFORMANCE CHOICE, which is worth saying because it looks like one:
  // a clear costs the same whatever the value (`gl.clearColor` + `gl.clear`),
  // and both HALs configure the context with alpha on (`premultipliedAlpha`,
  // `alphaMode: 'premultiplied'`), so no opaque-layer compositor path is being
  // bought either.
  //
  // SO INK DRAWN ONTO THE BAND IS DERIVED FROM THE SAME VALUE, never read off
  // the theme independently: `getContrastText(groundColor)` is the one source,
  // and `markerColor`, `drawOffscreenMates`' `offscreenMateColors`, its label
  // halo and the clicked outline all come off it. Reading `theme.palette.text.secondary`
  // beside a ground that did not move with it is the bug that shipped the
  // off-screen-mate strip invisible: near-white marks at 0.35 alpha on white.
  //
  // What is STILL a light-ground assumption is the ribbon palettes themselves —
  // `defaultCigarColors` and the categorical ramps are fixed colours picked for
  // a white band, and at the 0.2 default alpha they are near invisible on a dark
  // one. Threading the ground is what makes a dark band expressible; tuning
  // those is the separate follow-up, in the `colorPairLRDark` mould.
  private clear(groundColor: string) {
    const dpr = this.dpr
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = groundColor
    ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr)
  }

  render(state: SyntenyRenderState) {
    const ctx = this.ctx
    const logicalW = this.canvas.width / this.dpr
    const { overdrawPx, groundColor } = state

    this.clear(groundColor)

    for (const [key, params] of state.perTrack) {
      const data = this.cache.regions.get(key)
      if (!data || data.instanceCount === 0) {
        continue
      }
      drawSyntenyTrack(ctx, data, params, logicalW, overdrawPx, groundColor)
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
