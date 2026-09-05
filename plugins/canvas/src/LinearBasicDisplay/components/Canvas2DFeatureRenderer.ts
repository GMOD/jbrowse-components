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
  snapBoxTopPx,
} from '@jbrowse/render-core/shaders/hpmath'

import {
  arrowDraws,
  arrowHeadHalfHeightPx,
} from '../passes/shaders/arrow.js.generated.ts'
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

// The furthest a glyph reaches outside the box it rides on: a chevron arm, an
// arrowhead, a continuation triangle, plus the ≤1px center-row snap.
const GLYPH_Y_SLACK_PX = 8

// Changes no pixel — the block scissor already hides what this rejects. It pays
// for itself because a fixed-height display scrolls over content many times its
// height: thousands of no-op `fillRect`s a frame, and on the export path an
// element serialized into the file and then clipped away.
function rowVisible(state: RenderState, topY: number, heightPx: number) {
  const y = topY - state.scrollY
  return (
    y + heightPx >= -GLYPH_Y_SLACK_PX &&
    y <= state.canvasHeight + GLYPH_Y_SLACK_PX
  )
}

// `lineYs` and `arrowYs` are the box's center while `rectYs` is its top, and
// only this pair of helpers has to know which is which.
function centeredRowVisible(
  state: RenderState,
  centerY: number,
  heightPx: number,
) {
  return rowVisible(state, centerY - heightPx * 0.5, heightPx)
}

// One CSS string per packed color per region: a gene track's intron lines arrive
// thousands to a frame.
function cssRgbaStyle(styles: Map<number, string>, c: number) {
  let style = styles.get(c)
  if (style === undefined) {
    style = abgrToCssRgba(c)
    styles.set(c, style)
  }
  return style
}

function drawLines(
  ctx: Ctx2D,
  region: RegionRenderData,
  block: BpRegionBounds,
  toX: BpToScreen,
  state: RenderState,
) {
  const { scrollY, canvasWidth } = state
  const styles = new Map<number, string>()
  let lastStyle: string | undefined
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
    const style = cssRgbaStyle(styles, region.lineColors[i]!)
    if (style !== lastStyle) {
      ctx.strokeStyle = style
      lastStyle = style
    }
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()

    // A reversed block flips the render axis, so strand-direction glyphs flip
    // with it.
    const rawDir = region.lineDirections[i]!
    const dir = block.reversed ? -rawDir : rawDir
    if (dir !== 0) {
      ctx.lineWidth = CHEVRON_THICKNESS_PX
      const lineWidthPx = Math.abs(x2 - x1)
      if (showChevrons(lineWidthPx)) {
        const totalChevrons = chevronCount(lineWidthPx)
        const spacing = chevronOffset(lineWidthPx, totalChevrons, 0)
        const minX = Math.min(x1, x2)
        // A long intron zoomed in spans millions of px with almost every chevron
        // off-screen. The window measures from the LINE'S start, which is why the
        // canvas enters it as `-minX`.
        const firstC = chevronFirstVisible(-minX, spacing, CHEVRON_HALF_W)
        const lastC = chevronLastVisible(
          canvasWidth - minX,
          spacing,
          totalChevrons,
          CHEVRON_HALF_W,
        )
        for (let c = firstC; c <= lastC; c++) {
          const cx = minX + chevronOffset(lineWidthPx, totalChevrons, c)
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

// Setting fillStyle re-parses the CSS string, and a pileup's rects arrive in
// same-color runs, so this cache and the `!==` guard beside it collapse the parse
// to once per run. Keyed by color and fade together, since the fade scales the
// color's alpha.
function rectFillStyle(
  styles: Map<number, string>,
  c: number,
  fade: number | undefined,
) {
  const key = fade ? c + 0x1_0000_0000 : c
  let style = styles.get(key)
  if (style === undefined) {
    // The fade folds into the color's alpha rather than globalAlpha, which
    // SvgCanvas does not have, so the export path fades too.
    const a = (abgrAlpha(c) / 255) * (fade ? MIN_DENSITY_ALPHA : 1)
    style = `rgba(${abgrRed(c)},${abgrGreen(c)},${abgrBlue(c)},${a})`
    styles.set(key, style)
  }
  return style
}

// `rectSpanPx` returns the shader's signed edge pair, which the GPU lerps between
// and never has to order; Canvas2D needs the leftmost, so `spanLeft` picks it.
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
  // outlineColor is per-region, so the stroke state hoists out of the loop
  // instead of being re-parsed on every outlined rect.
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
    const y = snapBoxTopPx(region.rectYs[i]!, region.rectHeights[i]!, scrollY)
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
  const styles = new Map<number, string>()
  let lastStyle: string | undefined
  for (let i = 0; i < region.arrowYs.length; i++) {
    if (
      !centeredRowVisible(state, region.arrowYs[i]!, region.arrowHeights[i]!)
    ) {
      continue
    }
    const xBp = region.arrowXs[i]!
    const rawDir = region.arrowDirections[i]!
    // `xBp` is whichever end the arrow points off, so the feature's other end is
    // a widthBp step back along its strand.
    const otherEndBp =
      rawDir === 1
        ? xBp - region.arrowWidthsBp[i]!
        : xBp + region.arrowWidthsBp[i]!
    const cx = toX(xBp)
    // A feature too narrow to be worth a direction marker gets none, so a dense
    // repeat run does not drown in overlapping arrowheads.
    if (!arrowDraws(Math.abs(toX(otherEndBp) - cx))) {
      continue
    }
    const y = snapBoxCenterYPx(
      region.arrowYs[i]!,
      region.arrowHeights[i]!,
      scrollY,
    )
    const dir = block.reversed ? -rawDir : rawDir
    const style = cssRgbaStyle(styles, region.arrowColors[i]!)
    if (style !== lastStyle) {
      ctx.fillStyle = style
      lastStyle = style
    }

    const stemEndX = cx + STEM_LENGTH_PX * 0.5 * dir
    ctx.fillRect(
      Math.min(cx, stemEndX),
      y - STEM_HALF_H_PX,
      Math.abs(stemEndX - cx),
      STEM_HALF_H_PX * 2,
    )

    const headTipX = cx + STEM_LENGTH_PX * dir
    const headHalf = arrowHeadHalfHeightPx(region.arrowHeights[i]!)
    ctx.beginPath()
    ctx.moveTo(stemEndX, y - headHalf)
    ctx.lineTo(stemEndX, y + headHalf)
    ctx.lineTo(headTipX, y)
    ctx.closePath()
    ctx.fill()
  }
}

// Two base corners join at the apex with no back edge, so it reads as a ">"
// rather than a filled triangle.
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

// `edgeSide` (+1 right, -1 left) is the only difference between the two edges:
// every direction below reads `edgeSide × …`, so the pair is one piece of
// arithmetic rather than two hand-mirrored copies to keep in sign agreement.
function drawEdgeMarker(
  ctx: Ctx2D,
  args: {
    edgeX: number
    edgeSide: 1 | -1
    strand: number
    cy: number
    halfH: number
  },
) {
  const { edgeX, edgeSide, strand, cy, halfH } = args
  const dir = markerDirection(strand, edgeSide)
  // A chevron pointing out of this edge puts its apex on the anchor; one pointing
  // inward shifts a triangle-width so its apex lands there instead of its base
  // and the whole glyph stays inside the scissor.
  const apexInset = CONT_TRI_W_PX * (1 - strandMatchesEdge(strand, edgeSide))
  for (let p = 0; p < 2; p++) {
    const anchorX =
      edgeX - edgeSide * (CONT_EDGE_MARGIN_PX + CONT_TRI_GAP_PX * p)
    strokeChevron(ctx, anchorX - edgeSide * apexInset, dir, cy, halfH)
  }
}

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
  const { leftIsCanvasEdge, rightIsCanvasEdge } = canvasEdgeFlags(
    scissorX,
    scissorW,
    canvasWidth,
  )
  // An interior block touches neither canvas edge, so no rect of it can qualify
  // and the whole per-rect scan is skippable.
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
    // Only mark once a meaningful amount of the feature is hidden; a few px
    // clipped off a short repeat stays unmarked.
    const offLeft =
      leftIsCanvasEdge &&
      runsOffEdge(left, right, scissorLeft, -1, CONT_MIN_OVERHANG_PX)
    const offRight =
      rightIsCanvasEdge &&
      runsOffEdge(right, left, scissorRight, 1, CONT_MIN_OVERHANG_PX)
    if (offLeft || offRight) {
      const c = region.rectColors[i]!
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

// Chevrons have no entry of their own: `drawLines` paints them per line, where
// the GPU draws them as a separate pass off the line buffer.
export const CANVAS_GLYPH_DRAW: Record<GlyphLayerId, GlyphDrawFn> = {
  line: drawLines,
  rect: drawRects,
  arrow: drawArrows,
  continuation: drawContinuation,
}

/**
 * No `this`, no DOM, no DPR scaling: the on-screen renderer wraps this with
 * `prepareCanvas`, and the SVG export calls it with an `SvgCanvas`.
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
  const rect = overlayItemRect(item, block)
  if (rect) {
    // The box wraps the glyph and its label, measured off the feature's full
    // width rather than the clamped rect.
    const extraWidth = labelData
      ? computeLabelExtraWidth(
          labelData,
          Math.abs(toX(item.endBp) - toX(item.startBp)),
          labelContext.showLabels,
          labelContext.showDescriptions,
          labelContext.fontSize,
        )
      : 0
    // The scroll offset below is what ScrollLockedOverlay applies on screen
    // through its -scrollTop transform.
    const box = computeOverlayRect(rect, extraWidth, 2, 2)
    const top = box.top - scrollY
    ctx.fillStyle = colors.fill
    ctx.fillRect(box.left, top, box.width, box.height)
    ctx.strokeStyle = colors.border
    ctx.lineWidth = 1
    ctx.strokeRect(box.left, top, box.width, box.height)
  }
}

// The search highlight is the only on-screen overlay kind the export draws:
// hover, the in-progress solo collection and the selection box are live-session
// UI, and a feature left selected from a details widget would border every
// export. The resolved id set holds a top-level feature or its subfeature, never
// both, so scanning both arrays cannot double-box.
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
