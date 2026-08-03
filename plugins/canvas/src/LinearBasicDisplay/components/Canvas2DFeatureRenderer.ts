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
} from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { computeOverlayRect, overlayItemRect } from './highlightUtils.ts'
import { computeLabelExtraWidth } from './labelPositioning.ts'
import {
  ARROW_MIN_FEATURE_WIDTH_PX,
  CHEVRON_H_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
  CONT_EDGE_MARGIN_PX,
  CONT_MIN_OVERHANG_PX,
  CONT_TRI_GAP_PX,
  CONT_TRI_HALF_H_PX,
  CONT_TRI_W_PX,
  HEAD_HALF_H_PX,
  MIN_DENSITY_ALPHA,
  MIN_RECT_WIDTH_PX,
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
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

const CHEVRON_HALF_W = CHEVRON_W_PX * 0.5
const CHEVRON_HALF_H = CHEVRON_H_PX * 0.5

type BpToScreen = (bp: number) => number

// JS twin of hpmath.slang's snapBoxCenterY: the crisp (x.5) screen-y of the
// drawn middle row of a box with real center `centerY` and height `heightPx`,
// reproducing drawRects' edge snapping so the thin glyphs riding on a box
// (intron lines, chevrons, strand arrows, continuation markers) land on its
// center row instead of ~1px off in odd-height modes (superCompact).
function boxCenterY(centerY: number, heightPx: number, scrollY: number) {
  const topPx = Math.floor(centerY - heightPx / 2 - scrollY + 0.5)
  const hPx = Math.floor(heightPx + 0.5)
  return topPx + Math.floor(hPx / 2) + 0.5
}

function drawLines(
  ctx: Ctx2D,
  region: RegionRenderData,
  block: BpRegionBounds,
  toX: BpToScreen,
  scrollY: number,
  canvasWidth: number,
) {
  for (let i = 0; i < region.lineYs.length; i++) {
    const startBp = region.linePositions[i * 2]!
    const endBp = region.linePositions[i * 2 + 1]!
    const x1 = toX(startBp)
    const x2 = toX(endBp)
    const y = boxCenterY(region.lineYs[i]!, region.lineHeights[i]!, scrollY)
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
      // Skip chevrons when the line is too short to host even one with
      // reasonable margins (half the nominal spacing).
      if (lineWidthPx >= CHEVRON_SPACING_PX * 0.5) {
        const totalChevrons = Math.max(
          1,
          Math.floor(lineWidthPx / CHEVRON_SPACING_PX),
        )
        // N chevrons with gaps at both ends ⇒ N+1 evenly-sized gaps.
        const spacing = lineWidthPx / (totalChevrons + 1)
        const minX = Math.min(x1, x2)
        // Only iterate chevrons whose center lands on-screen. A long intron
        // zoomed in spans millions of px with almost all chevrons off-screen;
        // without this window the loop issues thousands of clipped-away strokes
        // (mirrors the GPU shader's visible-range windowing). cx positions are
        // unchanged, so on-screen output is identical.
        const firstC = Math.max(0, Math.ceil(-minX / spacing - 1))
        const lastC = Math.min(
          totalChevrons - 1,
          Math.floor((canvasWidth - minX) / spacing - 1),
        )
        for (let c = firstC; c <= lastC; c++) {
          const cx = minX + spacing * (c + 1)
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
    // In the dense-pileup regime (thousands of collapsed row-0 marks) boxes draw
    // semi-transparent so src-over accumulation makes the pileup read as a density
    // texture instead of a flat block (mirrors rect.slang's densityAlpha); gene
    // subfeature rects, stacked boxes, and sparse tracks stay fully opaque.
    // rectDensityFade is that decision, so it alone gates the fade. Fold the
    // factor into the fill color's alpha so it also applies on the SVG-export
    // path (SvgCanvas has no globalAlpha).
    const a = (abgrAlpha(c) / 255) * (fade ? MIN_DENSITY_ALPHA : 1)
    style = `rgba(${abgrRed(c)},${abgrGreen(c)},${abgrBlue(c)},${a})`
    styles.set(key, style)
  }
  return style
}

function drawRects(
  ctx: Ctx2D,
  region: RegionRenderData,
  toX: BpToScreen,
  scrollY: number,
) {
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
    const startBp = region.rectPositions[i * 2]!
    const endBp = region.rectPositions[i * 2 + 1]!
    const x1 = toX(startBp)
    const x2 = toX(endBp)
    const y = Math.floor(region.rectYs[i]! - scrollY + 0.5)
    const h = Math.floor(region.rectHeights[i]! + 0.5)
    // Pixel-snap the endpoints (matching the GPU shader's snapToPixelX) so a
    // min-width box is a crisp >=2px column instead of an anti-aliased sub-2px
    // blur. spanLeft then anchors the box on the feature's start edge the way
    // rect.slang's extendToMinWidthX does — reversed, that's its right edge.
    //
    // Except for a degenerate span, which is an interbase point (a cut site)
    // rather than a box, and straddles its coordinate instead. Mirrors
    // rect.slang, including keying on the genomic coords rather than on the
    // snapped pixels — see the note there.
    const isPoint = startBp === endBp
    const sx1 = Math.round(isPoint ? x1 - MIN_RECT_WIDTH_PX / 2 : x1)
    const sx2 = Math.round(isPoint ? x1 + MIN_RECT_WIDTH_PX / 2 : x2)
    const w = Math.max(MIN_RECT_WIDTH_PX, Math.abs(sx2 - sx1))
    const xLeft = spanLeft(sx1, sx2, w)

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
    if (outlineStyle !== undefined && w > 2 && h > 2) {
      ctx.strokeRect(xLeft + 0.5, y + 0.5, w - 1, h - 1)
    }
  }
}

function drawArrows(
  ctx: Ctx2D,
  region: RegionRenderData,
  block: BpRegionBounds,
  toX: BpToScreen,
  scrollY: number,
) {
  for (let i = 0; i < region.arrowYs.length; i++) {
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
    // Mirrors arrow.slang: a feature too narrow to be worth a direction marker
    // gets none, so a dense repeat run doesn't drown in overlapping arrowheads.
    if (Math.abs(toX(otherEndBp) - cx) < ARROW_MIN_FEATURE_WIDTH_PX) {
      continue
    }
    const y = boxCenterY(region.arrowYs[i]!, region.arrowHeights[i]!, scrollY)
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

// "Feature keeps going" double-chevron (»/«) pinned at a screen edge for any rect
// that runs past the visible block region. Mirrors continuation.slang.
function drawContinuation(
  ctx: Ctx2D,
  region: RegionRenderData,
  block: BpRegionBounds,
  toX: BpToScreen,
  scrollY: number,
  scissorX: number,
  scissorW: number,
  canvasWidth: number,
) {
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
    const x1 = toX(region.rectPositions[i * 2]!)
    const x2 = toX(region.rectPositions[i * 2 + 1]!)
    const left = Math.min(x1, x2)
    const right = Math.max(x1, x2)
    // Only mark once a meaningful amount of the feature is hidden (overhang past
    // the edge > threshold); a few px clipped off a short repeat stays unmarked.
    const offLeft =
      leftIsCanvasEdge &&
      scissorLeft - left > CONT_MIN_OVERHANG_PX &&
      right > scissorLeft
    const offRight =
      rightIsCanvasEdge &&
      right - scissorRight > CONT_MIN_OVERHANG_PX &&
      left < scissorRight
    if (offLeft || offRight) {
      const c = region.rectColors[i]!
      const lum =
        0.299 * abgrRed(c) + 0.587 * abgrGreen(c) + 0.114 * abgrBlue(c)
      ctx.strokeStyle =
        lum > 127.5 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1
      const cy = boxCenterY(
        region.rectYs[i]! + region.rectHeights[i]! * 0.5,
        region.rectHeights[i]!,
        scrollY,
      )
      const halfH = Math.min(CONT_TRI_HALF_H_PX, region.rectHeights[i]! * 0.4)
      // Genomic strand → screen direction, so a reversed block's markers point
      // the way its glyphs run — same flip drawLines/drawArrows apply, and
      // continuation.slang's `flipX(inst.strand, u)`.
      const rawStrand = region.rectStrands[i]!
      const strand = block.reversed ? -rawStrand : rawStrand
      if (offRight) {
        const effectiveStrand = strand === 0 ? 1 : strand
        const strandMatchesEdge = Math.max(0, effectiveStrand) // edgeSide=1
        for (let p = 0; p < 2; p++) {
          const anchorX =
            scissorRight - CONT_EDGE_MARGIN_PX - CONT_TRI_GAP_PX * p
          const apexX = anchorX - CONT_TRI_W_PX * (1 - strandMatchesEdge)
          strokeChevron(ctx, apexX, effectiveStrand, cy, halfH)
        }
      }
      if (offLeft) {
        const effectiveStrand = strand === 0 ? -1 : strand
        const strandMatchesEdge = Math.max(0, effectiveStrand * -1) // edgeSide=-1
        for (let p = 0; p < 2; p++) {
          const anchorX =
            scissorLeft + CONT_EDGE_MARGIN_PX + CONT_TRI_GAP_PX * p
          const apexX = anchorX + CONT_TRI_W_PX * (1 - strandMatchesEdge)
          strokeChevron(ctx, apexX, effectiveStrand, cy, halfH)
        }
      }
    }
  }
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
  const { canvasWidth, canvasHeight, scrollY } = state
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (region, block, clip) => {
      const toX = makeBpMapper(block)
      drawLines(ctx, region, block, toX, scrollY, canvasWidth)
      drawRects(ctx, region, toX, scrollY)
      drawArrows(ctx, region, block, toX, scrollY)
      // Drawn last so the markers sit on top of the glyphs they annotate.
      drawContinuation(
        ctx,
        region,
        block,
        toX,
        scrollY,
        clip.scissorX,
        clip.scissorW,
        canvasWidth,
      )
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
            region.floatingLabelsData[item.featureId],
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
