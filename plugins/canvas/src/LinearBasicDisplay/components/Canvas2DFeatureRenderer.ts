import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
  abgrToCssRgba,
} from '@jbrowse/core/util/colorBits'
import {
  forEachClippedBlock,
  makeBpMapper,
  spanLeft,
  strokeRectInside,
} from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import {
  snapBoxCenterYPx,
  snapBoxHeightPx,
} from '@jbrowse/render-core/shaders/hpmath'

import { arrowDraws } from '../passes/shaders/arrow.js.generated.ts'
import {
  chevronCount,
  chevronFirstVisible,
  chevronLastVisible,
  chevronOffset,
  showChevrons,
} from '../passes/shaders/chevron.js.generated.ts'
import {
  markerDirection,
  markerHalfHeight,
  markerIsDark,
  runsOffEdge,
  strandMatchesEdge,
} from '../passes/shaders/continuation.js.generated.ts'
import {
  rectDrawsOutline,
  rectSpanPx,
} from '../passes/shaders/rect.js.generated.ts'
import { GLYPH_LAYERS } from './glyphLayers.ts'
import { computeOverlayRect, overlayItemRect } from './highlightUtils.ts'
import { computeLabelExtraWidth } from './labelPositioning.ts'
import {
  CHEVRON_H_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
  CONT_EDGE_MARGIN_PX,
  CONT_MARK_ALPHA,
  CONT_MIN_OVERHANG_PX,
  CONT_TRI_GAP_PX,
  CONT_TRI_W_PX,
  HEAD_HALF_H_PX,
  MIN_DENSITY_ALPHA,
  STEM_HALF_H_PX,
  STEM_LENGTH_PX,
  canvasEdgeFlags,
} from './sharedRendererConstants.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
  HitItemBase,
  RegionRenderData,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  FeatureRenderBlock,
  RenderState,
} from './canvasFeatureRenderingBackendTypes.ts'
import type { GlyphLayerId } from './glyphLayers.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { BlockClip } from '@jbrowse/render-core/canvas2dUtils'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

const CHEVRON_HALF_W = CHEVRON_W_PX * 0.5
const CHEVRON_HALF_H = CHEVRON_H_PX * 0.5

type BpToScreen = (bp: number) => number

// `snapBoxHeightPx` (the pixel height a box is drawn at, nudging a THIN box with
// an even height up to the next odd one so it has a true center row for the 1px
// glyphs riding on it) and `snapBoxCenterYPx` (the crisp x.5 screen-y of that
// row) are generated from hpmath.slang by `pnpm gen:shaders` — this file runs
// the shader's own math rather than a hand-written twin of it. Both were
// hand-ported here until adr-051; `hpmathParity.test.ts` pins the generated
// pair against the implementations they replaced.

// The furthest a glyph reaches outside the box it rides on: chevrons half of
// CHEVRON_H_PX around the center row, arrowheads HEAD_HALF_H_PX, continuation
// triangles `markerHalfHeight`, plus the ≤1px snapBoxCenterYPx snap. 8 clears
// every one of them, and being generous costs nothing — the test below is only
// ever decisive for primitives already well off-screen.
const GLYPH_Y_SLACK_PX = 8

// Whether a primitive occupying `[topY, topY + heightPx]` in absolute track
// coordinates can put ink on the canvas.
//
// It cannot change a pixel: `forEachClippedBlock` clips every block to
// `[0, canvasHeight]`, so anything this rejects was already invisible. It is
// worth asking because a fixed-height display scrolls over content many times
// its own height — on screen that is thousands of no-op `fillRect`s a frame,
// and on the SVG export path each one is an element serialized into the file
// and then clipped away. `drawLines`' on-screen chevron window is the same
// argument on the other axis.
function rowVisible(state: RenderState, topY: number, heightPx: number) {
  const y = topY - state.scrollY
  return (
    y + heightPx >= -GLYPH_Y_SLACK_PX &&
    y <= state.canvasHeight + GLYPH_Y_SLACK_PX
  )
}

// `lineYs` and `arrowYs` are the box's CENTER (that is what `snapBoxCenterYPx`
// takes), while `rectYs` is its top — so the two families measure their extent
// differently and only this pair of helpers has to know which is which.
function centeredRowVisible(
  state: RenderState,
  centerY: number,
  heightPx: number,
) {
  return rowVisible(state, centerY - heightPx * 0.5, heightPx)
}

function drawLines(
  ctx: Ctx2D,
  region: RegionRenderData,
  block: BpRegionBounds,
  toX: BpToScreen,
  state: RenderState,
) {
  const { scrollY, canvasWidth } = state
  for (let i = 0; i < region.lineYs.length; i++) {
    if (!centeredRowVisible(state, region.lineYs[i]!, region.lineHeights[i]!)) {
      continue
    }
    const startBp = region.linePositions[i * 2]!
    const endBp = region.linePositions[i * 2 + 1]!
    const x1 = toX(startBp)
    const x2 = toX(endBp)
    const y = snapBoxCenterYPx(
      region.lineYs[i]!,
      region.lineHeights[i]!,
      scrollY,
    )
    ctx.strokeStyle = abgrToCssRgba(region.lineColors[i]!)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()

    // On reversed blocks the render axis flips, so strand-direction glyphs
    // (chevrons, arrows) flip too — matches the GPU shader's
    // `lerp(dir, -dir, u.reversed)`.
    const rawDir = region.lineDirections[i]!
    const dir = block.reversed ? -rawDir : rawDir
    if (dir !== 0) {
      ctx.lineWidth = CHEVRON_THICKNESS_PX
      const lineWidthPx = Math.abs(x2 - x1)
      // How many chevrons a line gets and where each one sits are
      // chevron.slang's decisions, generated into TS (adr-051) — this loop used
      // to restate both, including the N-chevrons-in-N+1-gaps rule that decides
      // whether the marks look evenly spaced or crowd one end.
      if (showChevrons(lineWidthPx)) {
        const totalChevrons = chevronCount(lineWidthPx)
        const spacing = chevronOffset(lineWidthPx, totalChevrons, 0)
        const minX = Math.min(x1, x2)
        // Only iterate chevrons that put ink on screen. A long intron zoomed in
        // spans millions of px with almost all chevrons off-screen; without this
        // window the loop issues thousands of clipped-away strokes.
        //
        // The shader's own window (adr-051), which is why the viewport is
        // expressed the way it is: `chevronFirstVisible` measures from the LINE'S
        // start, and the canvas here starts at `-minX` from it. Unit-agnostic
        // like `chevronOffset` above — bp on the GPU, px here — so `reach` is the
        // arm half-width in px.
        const firstC = chevronFirstVisible(-minX, spacing, CHEVRON_HALF_W)
        const lastC = chevronLastVisible(
          canvasWidth - minX,
          spacing,
          totalChevrons,
          CHEVRON_HALF_W,
        )
        for (let c = firstC; c <= lastC; c++) {
          const cx = minX + chevronOffset(lineWidthPx, totalChevrons, c)
          // Three-segment "<" or ">" centred on (cx, y). The two outer
          // points share an x offset on the side opposite to `dir`, so
          // flipping dir flips the chevron's apex.
          ctx.beginPath()
          ctx.moveTo(cx - CHEVRON_HALF_W * dir, y - CHEVRON_HALF_H)
          ctx.lineTo(cx + CHEVRON_HALF_W * dir, y)
          ctx.lineTo(cx - CHEVRON_HALF_W * dir, y + CHEVRON_HALF_H)
          ctx.stroke()
        }
      }
    }
  }
}

// Dense pileups paint thousands of rects from a handful of distinct colors, so
// the per-rect `rgba(...)` is built once per color and reused. The bigger win is
// the `!==` guard on the assignment itself: setting fillStyle re-parses the CSS
// string every time, and a pileup's rects mostly arrive in same-color runs, so
// the parse collapses to roughly once per run instead of once per rect. Keyed by
// color and fade together, since the fade scales the color's alpha.
function rectFillStyle(
  styles: Map<number, string>,
  c: number,
  fade: number | undefined,
) {
  const key = fade ? c + 0x1_0000_0000 : c
  let style = styles.get(key)
  if (style === undefined) {
    // Where collapsed row-0 marks pile PILEUP_FADE_DEPTH deep, boxes draw
    // semi-transparent so src-over accumulation makes the pileup read as a density
    // texture instead of a flat block (mirrors rect.slang's densityAlpha); gene
    // subfeature rects, stacked boxes, and marks with room around them stay
    // fully opaque.
    // rectDensityFade is that decision, so it alone gates the fade. Fold the
    // factor into the fill color's alpha so it also applies on the SVG-export
    // path (SvgCanvas has no globalAlpha).
    const a = (abgrAlpha(c) / 255) * (fade ? MIN_DENSITY_ALPHA : 1)
    style = `rgba(${abgrRed(c)},${abgrGreen(c)},${abgrBlue(c)},${a})`
    styles.set(key, style)
  }
  return style
}

// The horizontal extent a rect actually paints: its left edge and width, both in
// whole pixels.
//
// Both edges come from `rectSpanPx`, generated from rect.slang's own vertex
// stage (adr-051) — the point-vs-span rule, the pixel snap and the min-width
// widening are all the shader's, and were hand-written here until
// `rectSpanParity.test.ts` retired them. That test also pins the part that is
// easy to lose on a later edit: the point branch does not widen, and does not
// need to.
//
// What stays this side is the conversion from the shader's signed edge pair to
// a fill-x, because that is the pivot Canvas2D needs and the GPU does not: the
// vertex stage lerps between the two edges, so it never has to know which one
// is leftmost. `spanLeft` owns it.
function paintedRectSpan(
  startBp: number,
  endBp: number,
  toX: BpToScreen,
): [xLeft: number, width: number] {
  const [sx1, sx2] = rectSpanPx(toX(startBp), toX(endBp), startBp === endBp)
  const width = Math.abs(sx2 - sx1)
  return [spanLeft(sx1, sx2, width), width]
}

function drawRects(
  ctx: Ctx2D,
  region: RegionRenderData,
  _block: BpRegionBounds,
  toX: BpToScreen,
  state: RenderState,
) {
  const { scrollY } = state
  const styles = new Map<number, string>()
  let lastStyle: string | undefined
  // outlineColor is per-region, so the stroke state is hoisted out of the loop
  // rather than re-assigned (and re-parsed) on every outlined rect.
  const outlineStyle = region.outlineColor
    ? abgrToCssRgba(region.outlineColor)
    : undefined
  if (outlineStyle !== undefined) {
    ctx.strokeStyle = outlineStyle
    ctx.lineWidth = 1
  }
  for (let i = 0; i < region.rectYs.length; i++) {
    if (!rowVisible(state, region.rectYs[i]!, region.rectHeights[i]!)) {
      continue
    }
    const y = Math.floor(region.rectYs[i]! - scrollY + 0.5)
    const h = snapBoxHeightPx(region.rectHeights[i]!)
    const [xLeft, w] = paintedRectSpan(
      region.rectPositions[i * 2]!,
      region.rectPositions[i * 2 + 1]!,
      toX,
    )

    const style = rectFillStyle(
      styles,
      region.rectColors[i]!,
      region.rectDensityFade[i],
    )
    if (style !== lastStyle) {
      ctx.fillStyle = style
      lastStyle = style
    }
    ctx.fillRect(xLeft, y, w, h)
    if (outlineStyle !== undefined && rectDrawsOutline(w, h)) {
      // This file had the inset spelling open-coded and was the only painter
      // that did; the rule is `strokeRectInside` now, so the alignments read
      // painter gets it too rather than rediscovering the `+0.5`.
      strokeRectInside(ctx, xLeft, y, w, h)
    }
  }
}

function drawArrows(
  ctx: Ctx2D,
  region: RegionRenderData,
  block: BpRegionBounds,
  toX: BpToScreen,
  state: RenderState,
) {
  const { scrollY } = state
  for (let i = 0; i < region.arrowYs.length; i++) {
    if (
      !centeredRowVisible(state, region.arrowYs[i]!, region.arrowHeights[i]!)
    ) {
      continue
    }
    const xBp = region.arrowXs[i]!
    const rawDir = region.arrowDirections[i]!
    // `xBp` is whichever end the arrow points off of, so the feature's other end
    // is a widthBp step back along its strand. Measured through `toX` like
    // drawLines' chevron gate rather than off a bpPerPx of our own.
    const otherEndBp =
      rawDir === 1
        ? xBp - region.arrowWidthsBp[i]!
        : xBp + region.arrowWidthsBp[i]!
    const cx = toX(xBp)
    // arrow.slang's own gate: a feature too narrow to be worth a direction
    // marker gets none, so a dense repeat run doesn't drown in overlapping
    // arrowheads. Same predicate `strandArrowPadding` reserves packing room by.
    if (!arrowDraws(Math.abs(toX(otherEndBp) - cx))) {
      continue
    }
    const y = snapBoxCenterYPx(
      region.arrowYs[i]!,
      region.arrowHeights[i]!,
      scrollY,
    )
    const dir = block.reversed ? -rawDir : rawDir
    ctx.fillStyle = abgrToCssRgba(region.arrowColors[i]!)

    const stemEndX = cx + STEM_LENGTH_PX * 0.5 * dir
    ctx.fillRect(
      Math.min(cx, stemEndX),
      y - STEM_HALF_H_PX,
      Math.abs(stemEndX - cx),
      STEM_HALF_H_PX * 2,
    )

    const headTipX = cx + STEM_LENGTH_PX * dir
    ctx.beginPath()
    ctx.moveTo(stemEndX, y - HEAD_HALF_H_PX)
    ctx.lineTo(stemEndX, y + HEAD_HALF_H_PX)
    ctx.lineTo(headTipX, y)
    ctx.closePath()
    ctx.fill()
  }
}

// One open chevron (">"/"<") pointing toward `dir` (+1 right, -1 left), apex at
// apexX. Two base corners join at the apex with no back edge, so it reads as a
// ">" not a filled triangle.
function strokeChevron(
  ctx: Ctx2D,
  apexX: number,
  dir: number,
  cy: number,
  halfH: number,
) {
  const baseX = apexX - dir * CONT_TRI_W_PX
  ctx.beginPath()
  ctx.moveTo(baseX, cy - halfH)
  ctx.lineTo(apexX, cy)
  ctx.lineTo(baseX, cy + halfH)
  ctx.stroke()
}

// The "»"/"«" pinned just inside ONE canvas edge for a rect that runs past it.
//
// `edgeSide` (+1 = right edge, -1 = left) is the only thing that differs between
// the two edges: every direction below is expressed as `edgeSide × …`, so the
// pair is one piece of arithmetic instead of two hand-mirrored copies whose signs
// have to be kept in agreement by eye. The two decisions that arithmetic turns
// on — which way the marker points, and whether that is out of this edge — are
// continuation.slang's own, generated into TS (adr-051), so the shader and this
// are not two such copies either.
function drawEdgeMarker(
  ctx: Ctx2D,
  args: {
    // scissor edge the markers are pinned inside
    edgeX: number
    edgeSide: 1 | -1
    // screen-axis strand of the rect (already flipped for a reversed block)
    strand: number
    cy: number
    halfH: number
  },
) {
  const { edgeX, edgeSide, strand, cy, halfH } = args
  const dir = markerDirection(strand, edgeSide)
  // A chevron pointing OUT of this edge sits with its apex on the anchor. One
  // pointing back inward is shifted a triangle-width inward, so its apex rather
  // than its base lands there and the whole glyph stays inside the scissor.
  const apexInset = CONT_TRI_W_PX * (1 - strandMatchesEdge(strand, edgeSide))
  for (let p = 0; p < 2; p++) {
    const anchorX =
      edgeX - edgeSide * (CONT_EDGE_MARGIN_PX + CONT_TRI_GAP_PX * p)
    strokeChevron(ctx, anchorX - edgeSide * apexInset, dir, cy, halfH)
  }
}

// "Feature keeps going" double-chevron (»/«) pinned at a screen edge for any rect
// that runs past the visible block region. Mirrors continuation.slang.
function drawContinuation(
  ctx: Ctx2D,
  region: RegionRenderData,
  block: BpRegionBounds,
  toX: BpToScreen,
  state: RenderState,
  clip: BlockClip,
) {
  const { scrollY, canvasWidth } = state
  const { scissorX, scissorW } = clip
  const scissorLeft = scissorX
  const scissorRight = scissorX + scissorW
  // Only the true canvas edges get markers, never an internal seam between two
  // on-screen displayedRegions.
  const { leftIsCanvasEdge, rightIsCanvasEdge } = canvasEdgeFlags(
    scissorX,
    scissorW,
    canvasWidth,
  )
  // An interior block in a multi-region view touches neither canvas edge, so no
  // rect of it can qualify — skip the per-rect scan entirely rather than testing
  // thousands of rects against two flags that are already false. (The GPU pays
  // this per instance; here it's one branch.)
  if (!leftIsCanvasEdge && !rightIsCanvasEdge) {
    return
  }
  for (let i = 0; i < region.rectYs.length; i++) {
    if (!rowVisible(state, region.rectYs[i]!, region.rectHeights[i]!)) {
      continue
    }
    const x1 = toX(region.rectPositions[i * 2]!)
    const x2 = toX(region.rectPositions[i * 2 + 1]!)
    const left = Math.min(x1, x2)
    const right = Math.max(x1, x2)
    // Only mark once a meaningful amount of the feature is hidden (overhang past
    // the edge > threshold); a few px clipped off a short repeat stays unmarked.
    // `runsOffEdge` is the shader's own three comparisons, in px here and in clip
    // there; the canvas-edge flags stay outside it, being a per-block fact each
    // backend holds under its own name.
    const offLeft =
      leftIsCanvasEdge &&
      runsOffEdge(left, right, scissorLeft, -1, CONT_MIN_OVERHANG_PX)
    const offRight =
      rightIsCanvasEdge &&
      runsOffEdge(right, left, scissorRight, 1, CONT_MIN_OVERHANG_PX)
    if (offLeft || offRight) {
      const c = region.rectColors[i]!
      // 0..1 channels, which is the unit `markerIsDark` weighs them in — the
      // unpack is this backend's half of the split (see the shader).
      ctx.strokeStyle = markerIsDark(
        abgrRed(c) / 255,
        abgrGreen(c) / 255,
        abgrBlue(c) / 255,
      )
        ? `rgba(0,0,0,${CONT_MARK_ALPHA})`
        : `rgba(255,255,255,${CONT_MARK_ALPHA})`
      ctx.lineWidth = 1
      const cy = snapBoxCenterYPx(
        region.rectYs[i]! + region.rectHeights[i]! * 0.5,
        region.rectHeights[i]!,
        scrollY,
      )
      const halfH = markerHalfHeight(region.rectHeights[i]!)
      // Genomic strand → screen direction, so a reversed block's markers point
      // the way its glyphs run — same flip drawLines/drawArrows apply, and
      // continuation.slang's `flipX(inst.strand, u)`.
      const rawStrand = region.rectStrands[i]!
      const strand = block.reversed ? -rawStrand : rawStrand
      if (offRight) {
        drawEdgeMarker(ctx, {
          edgeX: scissorRight,
          edgeSide: 1,
          strand,
          cy,
          halfH,
        })
      }
      if (offLeft) {
        drawEdgeMarker(ctx, {
          edgeX: scissorLeft,
          edgeSide: -1,
          strand,
          cy,
          halfH,
        })
      }
    }
  }
}

type GlyphDrawFn = (
  ctx: Ctx2D,
  region: RegionRenderData,
  block: BpRegionBounds,
  toX: BpToScreen,
  state: RenderState,
  clip: BlockClip,
) => void

// Each glyph layer's Canvas2D painter. The set and the paint order live in the
// shared `GLYPH_LAYERS` list (also driving the GPU renderer); this map resolves
// each id to the call that paints it, and is typed `Record<GlyphLayerId, …>` so
// a glyph can't be added to that list without being painted here — or on the SVG
// export path, which reaches these same painters through `drawFeatureBlocks`.
//
// Every painter takes `GlyphDrawFn` whole and ignores what it doesn't need, so
// the entries are bare references and this reads as the table it is. Wrappers
// that only reorder arguments would put a second, silent statement of which
// painter each id means between the id and its painter.
//
// Chevrons have no entry: `drawLines` paints them per line, where the GPU draws
// them as a separate pass off the line buffer. Same marks, same slot.
export const CANVAS_GLYPH_DRAW: Record<GlyphLayerId, GlyphDrawFn> = {
  line: drawLines,
  rect: drawRects,
  arrow: drawArrows,
  continuation: drawContinuation,
}

/**
 * Pure draw entry point. Paints lines, rects, and arrows for the laid-out
 * feature data into any 2D-canvas-like context. Per-block scissor clips so
 * partial blocks don't bleed across boundaries. No `this`, no DOM, no DPR
 * scaling — the on-screen `Canvas2DFeatureRenderer` wraps this with
 * `prepareCanvas`; SVG export calls it directly with an `SvgCanvas`.
 */
export function drawFeatureBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, RegionRenderData>,
  blocks: FeatureRenderBlock[],
  state: RenderState,
) {
  const { canvasWidth, canvasHeight } = state
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (region, block, clip) => {
      const toX = makeBpMapper(block)
      for (const id of GLYPH_LAYERS) {
        CANVAS_GLYPH_DRAW[id](ctx, region, block, toX, state, clip)
      }
    },
  )
}

interface HighlightLabelContext {
  showLabels: boolean
  showDescriptions: boolean
  // resolved label size for the display mode, so the reserved label width matches
  // the text the export actually paints (baked widths are at the base size)
  fontSize: number
}

function drawHighlightBox(
  ctx: Ctx2D,
  item: HitItemBase,
  block: BpRegionBounds,
  toX: BpToScreen,
  scrollY: number,
  colors: { border: string; fill: string },
  labelData: FeatureLabelData | undefined,
  labelContext: HighlightLabelContext,
) {
  // Region-clamped rect, same helper the on-screen overlay uses
  // (overlayElements/addOverlay). Clamping matters even though the block
  // scissor is up: a feature that merely TOUCHES this region's edge (the normal
  // shape at a displayed-region boundary, drawn entirely in the neighbour)
  // clamps to nothing here, and the reserved label width below would otherwise
  // inflate it into a phantom stripe inside the scissor.
  const rect = overlayItemRect(item, block)
  if (rect) {
    // Reserve the floating-label width for a top-level feature so the box wraps
    // the glyph AND its label, exactly as the on-screen searchHighlightBox does
    // (overlayElements addFeatureBox/computeExtraWidth). Measured off the
    // feature's full width, not the clamped rect, matching computeExtraWidth.
    // Subfeatures pass no labelData and get 0, mirroring on-screen where
    // kind !== 'feature' reserves nothing.
    const extraWidth = labelData
      ? computeLabelExtraWidth(
          labelData,
          Math.abs(toX(item.endBp) - toX(item.startBp)),
          labelContext.showLabels,
          labelContext.showDescriptions,
          labelContext.fontSize,
        )
      : 0
    // Mirror the on-screen overlay box (overlayElements/computeOverlayRect):
    // 2px outset, top clamped into the content edge; then apply the scroll
    // offset the on-screen ScrollLockedOverlay applies via its -scrollTop
    // transform.
    const box = computeOverlayRect(rect, extraWidth, 2, 2)
    const top = box.top - scrollY
    ctx.fillStyle = colors.fill
    ctx.fillRect(box.left, top, box.width, box.height)
    ctx.strokeStyle = colors.border
    ctx.lineWidth = 1
    ctx.strokeRect(box.left, top, box.width, box.height)
  }
}

// Vector post-pass for SVG export: box the resolved highlighted features the way
// the on-screen DOM overlay does (the app canvas doesn't paint these). The
// resolved id set already picks a top-level feature OR its subfeature, so
// scanning both arrays and filtering by membership can't double-box.
//
// Deliberately the ONLY one of the four on-screen overlay kinds
// (HighlightLayer) that exports. Hover, the in-progress solo collection,
// and the selection box are all live-session UI: a figure should show the data,
// not what the user last moused over or clicked, and a feature left selected
// from opening its details widget would otherwise border every export until the
// user thought to click empty space. The search highlight is the exception
// because it is a declarative "point at this feature" request. Don't add the
// others back without that being an explicit product decision.
export function drawHighlightBoxes(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, FeatureDataResult>,
  blocks: FeatureRenderBlock[],
  highlightedIds: ReadonlySet<string>,
  state: RenderState,
  colors: { border: string; fill: string },
  labelContext: HighlightLabelContext,
) {
  const { canvasWidth, canvasHeight, scrollY } = state
  if (highlightedIds.size === 0) {
    return
  }
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (region, block) => {
      const toX = makeBpMapper(block)
      for (const item of region.flatbushItems) {
        if (highlightedIds.has(item.featureId)) {
          drawHighlightBox(
            ctx,
            item,
            block,
            toX,
            scrollY,
            colors,
            region.floatingLabelsData.get(item.featureId),
            labelContext,
          )
        }
      }
      // Subfeatures deliberately pass no labelData — see drawHighlightBox.
      for (const item of region.subfeatureInfos) {
        if (highlightedIds.has(item.featureId)) {
          drawHighlightBox(
            ctx,
            item,
            block,
            toX,
            scrollY,
            colors,
            undefined,
            labelContext,
          )
        }
      }
    },
  )
}

export class Canvas2DFeatureRenderer extends Canvas2DPerRegionRenderingBackend<
  RegionRenderData,
  RenderState
> {
  protected draw(
    blocks: FeatureRenderBlock[],
    regions: ReadonlyMap<number, RegionRenderData>,
    state: RenderState,
  ) {
    drawFeatureBlocks(this.ctx, regions, blocks, state)
  }
}
