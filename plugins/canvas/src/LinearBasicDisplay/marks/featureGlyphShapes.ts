/* eslint-disable unicorn/prefer-path2d -- every path here is one instance's own coordinates, built once and stroked once */
import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
  abgrToCssRgba,
} from '@jbrowse/core/util/colorBits'
import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import {
  clipBlockForCanvas,
  makeBpMapper,
  spanLeft,
  strokeRectInside,
} from '@jbrowse/render-core/canvas2dUtils'
import {
  snapBoxCenterYPx,
  snapBoxHeightPx,
  snapBoxTopPx,
} from '@jbrowse/render-core/shaders/hpmath'

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
} from '../components/sharedRendererConstants.ts'
import {
  ArrowPass,
  ContinuationPass,
  LinePass,
  RectPass,
  arrowShader,
  lineShader,
  makeChevronPass,
  rectShader,
} from '../passes/index.ts'
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

import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type {
  MarkContext2D,
  MarkFrame,
  MarkShape,
} from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * What every feature-glyph shape takes beside the frame: the rows-area scroll
 * and the region's outline colour, which reaches the rect shader as a uniform
 * and the painter as a stroke.
 */
export interface FeatureGlyphParams {
  scrollY: number
  /** Packed ABGR; 0 for no outline. */
  outlineColor: number
}

/** A box from `startEnd[2i]` to `startEnd[2i+1]`, `height` tall from `y`. */
export interface RectChannels {
  startEnd: Uint32Array
  y: Float32Array
  height: Float32Array
  color: Uint32Array
  densityFade: Uint32Array
  strand: Float32Array
  count: number
}

/** A 1px line at `y` (a box centre) with strand chevrons in `direction`. */
export interface LineChannels {
  startEnd: Uint32Array
  y: Float32Array
  height: Float32Array
  direction: Int8Array
  color: Uint32Array
  count: number
}

/** A strand arrow off the end `x` of a feature `widthBp` wide. */
export interface ArrowChannels {
  x: Uint32Array
  y: Float32Array
  height: Float32Array
  widthBp: Uint32Array
  direction: Int8Array
  color: Uint32Array
  count: number
}

const CHEVRON_HALF_W = CHEVRON_W_PX * 0.5
const CHEVRON_HALF_H = CHEVRON_H_PX * 0.5

// The furthest a glyph reaches outside the box it rides on: a chevron arm, an
// arrowhead, a continuation triangle, plus the ≤1px center-row snap.
const GLYPH_Y_SLACK_PX = 8

// Changes no pixel — the block scissor already hides what this rejects. It pays
// for itself because a fixed-height display scrolls over content many times its
// height: thousands of no-op `fillRect`s a frame, and on the export path an
// element serialized into the file and then clipped away.
function rowVisible(
  scrollY: number,
  canvasHeight: number,
  topY: number,
  heightPx: number,
) {
  const y = topY - scrollY
  return (
    y + heightPx >= -GLYPH_Y_SLACK_PX && y <= canvasHeight + GLYPH_Y_SLACK_PX
  )
}

// `y` is the box's center for lines and arrows and its top for rects, and only
// this pair of helpers has to know which is which.
function centeredRowVisible(
  scrollY: number,
  canvasHeight: number,
  centerY: number,
  heightPx: number,
) {
  return rowVisible(scrollY, canvasHeight, centerY - heightPx * 0.5, heightPx)
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

// All five passes bind one `FeatureGlyphUniforms` block, so every shape writes
// the same bytes: what differs per shape is only which pass reads them.
function writeFeatureGlyphUniforms(
  scratch: ArrayBuffer,
  clip: BlockClipResult,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
) {
  const edges = canvasEdgeFlags(clip.scissorX, clip.scissorW, frame.canvasWidth)
  rectShader.writeUniforms(scratch, {
    bpRangeX: bpRangeXTuple(clip, block.reversed),
    canvasHeight: frame.canvasHeight,
    canvasWidth: clip.scissorW,
    scrollY: params.scrollY,
    bpPerPx: clip.bpPerPx,
    zero: 0,
    reversed: block.reversed ? 1 : 0,
    outlineColor: params.outlineColor,
    leftIsCanvasEdge: edges.leftIsCanvasEdge ? 1 : 0,
    rightIsCanvasEdge: edges.rightIsCanvasEdge ? 1 : 0,
  })
}

function canvasEdgesOf(block: RenderBlock, frame: MarkFrame) {
  const clip = clipBlockForCanvas(block, frame.canvasWidth)
  return clip
    ? {
        ...canvasEdgeFlags(clip.scissorX, clip.scissorW, frame.canvasWidth),
        scissorLeft: clip.scissorX,
        scissorRight: clip.scissorX + clip.scissorW,
      }
    : undefined
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
  toX: (bp: number) => number,
): [xLeft: number, width: number] {
  const [sx1, sx2] = rectSpanPx(toX(startBp), toX(endBp), startBp === endBp)
  const width = Math.abs(sx2 - sx1)
  return [spanLeft(sx1, sx2, width), width]
}

export const rectShape: MarkShape<RectChannels, FeatureGlyphParams> = {
  id: 'rect',
  pass: { ...RectPass, pack: c => rectShader.packInstances(c, c.count) },
  writeUniforms: writeFeatureGlyphUniforms,

  paintBlock(ctx, channels, block, frame, params) {
    const { startEnd, y: ys, height, color, densityFade, count } = channels
    const { scrollY, outlineColor } = params
    const { canvasHeight } = frame
    const toX = makeBpMapper(block)
    const styles = new Map<number, string>()
    let lastStyle: string | undefined
    // outlineColor is per-region, so the stroke state hoists out of the loop
    // instead of being re-parsed on every outlined rect.
    const outlineStyle = outlineColor ? abgrToCssRgba(outlineColor) : undefined
    if (outlineStyle !== undefined) {
      ctx.strokeStyle = outlineStyle
      ctx.lineWidth = 1
    }
    for (let i = 0; i < count; i++) {
      if (!rowVisible(scrollY, canvasHeight, ys[i]!, height[i]!)) {
        continue
      }
      const y = snapBoxTopPx(ys[i]!, height[i]!, scrollY)
      const h = snapBoxHeightPx(height[i]!)
      const [xLeft, w] = paintedRectSpan(
        startEnd[i * 2]!,
        startEnd[i * 2 + 1]!,
        toX,
      )
      const style = rectFillStyle(styles, color[i]!, densityFade[i])
      if (style !== lastStyle) {
        ctx.fillStyle = style
        lastStyle = style
      }
      ctx.fillRect(xLeft, y, w, h)
      if (outlineStyle !== undefined && rectDrawsOutline(w, h)) {
        strokeRectInside(ctx, xLeft, y, w, h)
      }
    }
  },
}

/**
 * The line's painter also strokes its chevrons, per line, where the GPU draws
 * them as a separate pass off the line buffer (`makeChevronShape`).
 */
export const lineShape: MarkShape<LineChannels, FeatureGlyphParams> = {
  id: 'line',
  pass: { ...LinePass, pack: c => lineShader.packInstances(c, c.count) },
  writeUniforms: writeFeatureGlyphUniforms,

  paintBlock(ctx, channels, block, frame, params) {
    const { startEnd, y: ys, height, direction, color, count } = channels
    const { scrollY } = params
    const { canvasWidth, canvasHeight } = frame
    const toX = makeBpMapper(block)
    const styles = new Map<number, string>()
    let lastStyle: string | undefined
    for (let i = 0; i < count; i++) {
      if (!centeredRowVisible(scrollY, canvasHeight, ys[i]!, height[i]!)) {
        continue
      }
      const x1 = toX(startEnd[i * 2]!)
      const x2 = toX(startEnd[i * 2 + 1]!)
      const y = snapBoxCenterYPx(ys[i]!, height[i]!, scrollY)
      const style = cssRgbaStyle(styles, color[i]!)
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
      const rawDir = direction[i]!
      const dir = block.reversed ? -rawDir : rawDir
      if (dir !== 0) {
        ctx.lineWidth = CHEVRON_THICKNESS_PX
        const lineWidthPx = Math.abs(x2 - x1)
        if (showChevrons(lineWidthPx)) {
          const totalChevrons = chevronCount(lineWidthPx)
          const spacing = chevronOffset(lineWidthPx, totalChevrons, 0)
          const minX = Math.min(x1, x2)
          // A long intron zoomed in spans millions of px with almost every
          // chevron off-screen. The window measures from the LINE'S start,
          // which is why the canvas enters it as `-minX`.
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
  },
}

/**
 * The GPU's chevrons: one pass over the line buffer, shading
 * `maxChevronsPerLine` slots per line, so a consumer declares it with
 * `bufferOf` the line mark and a cap of its own. The painter is a no-op — the
 * line shape strokes its chevrons per line.
 */
export function makeChevronShape(
  maxChevronsPerLine: number,
): MarkShape<LineChannels, FeatureGlyphParams> {
  return {
    id: 'chevron',
    pass: {
      ...makeChevronPass(maxChevronsPerLine),
      pack: c => lineShader.packInstances(c, c.count),
    },
    writeUniforms: writeFeatureGlyphUniforms,
    paintBlock() {},
  }
}

export const arrowShape: MarkShape<ArrowChannels, FeatureGlyphParams> = {
  id: 'arrow',
  pass: { ...ArrowPass, pack: c => arrowShader.packInstances(c, c.count) },
  writeUniforms: writeFeatureGlyphUniforms,

  paintBlock(ctx, channels, block, frame, params) {
    const { x: xs, y: ys, height, widthBp, direction, color, count } = channels
    const { scrollY } = params
    const { canvasHeight } = frame
    const toX = makeBpMapper(block)
    const styles = new Map<number, string>()
    let lastStyle: string | undefined
    for (let i = 0; i < count; i++) {
      if (!centeredRowVisible(scrollY, canvasHeight, ys[i]!, height[i]!)) {
        continue
      }
      const xBp = xs[i]!
      const rawDir = direction[i]!
      // `xBp` is whichever end the arrow points off, so the feature's other end
      // is a widthBp step back along its strand.
      const otherEndBp = rawDir === 1 ? xBp - widthBp[i]! : xBp + widthBp[i]!
      const cx = toX(xBp)
      // A feature too narrow to be worth a direction marker gets none, so a
      // dense repeat run does not drown in overlapping arrowheads.
      if (!arrowDraws(Math.abs(toX(otherEndBp) - cx))) {
        continue
      }
      const y = snapBoxCenterYPx(ys[i]!, height[i]!, scrollY)
      const dir = block.reversed ? -rawDir : rawDir
      const style = cssRgbaStyle(styles, color[i]!)
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
      const headHalf = arrowHeadHalfHeightPx(height[i]!)
      ctx.beginPath()
      ctx.moveTo(stemEndX, y - headHalf)
      ctx.lineTo(stemEndX, y + headHalf)
      ctx.lineTo(headTipX, y)
      ctx.closePath()
      ctx.fill()
    }
  },
}

// Two base corners join at the apex with no back edge, so it reads as a ">"
// rather than a filled triangle.
function strokeChevron(
  ctx: MarkContext2D,
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
  ctx: MarkContext2D,
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

/**
 * The "feature keeps going" marker at a canvas edge, one pass over the rect
 * buffer (`bufferOf` the rect mark). A block touching neither canvas edge has
 * no marker to draw, and `paintsBlock` says so before either backend walks
 * the rects.
 */
export const continuationShape: MarkShape<RectChannels, FeatureGlyphParams> = {
  id: 'continuation',
  pass: {
    ...ContinuationPass,
    pack: c => rectShader.packInstances(c, c.count),
  },
  writeUniforms: writeFeatureGlyphUniforms,

  paintsBlock(block, frame) {
    const edges = canvasEdgesOf(block, frame)
    return !!edges && (edges.leftIsCanvasEdge || edges.rightIsCanvasEdge)
  },

  paintBlock(ctx, channels, block, frame, params) {
    const edges = canvasEdgesOf(block, frame)
    if (!edges) {
      return
    }
    const { startEnd, y: ys, height, color, strand: strands, count } = channels
    const { scrollY } = params
    const { canvasHeight } = frame
    const { leftIsCanvasEdge, rightIsCanvasEdge, scissorLeft, scissorRight } =
      edges
    const toX = makeBpMapper(block)
    for (let i = 0; i < count; i++) {
      if (!rowVisible(scrollY, canvasHeight, ys[i]!, height[i]!)) {
        continue
      }
      const x1 = toX(startEnd[i * 2]!)
      const x2 = toX(startEnd[i * 2 + 1]!)
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
        const c = color[i]!
        ctx.strokeStyle = markerIsDark(
          abgrRed(c) / 255,
          abgrGreen(c) / 255,
          abgrBlue(c) / 255,
        )
          ? `rgba(0,0,0,${CONT_MARK_ALPHA})`
          : `rgba(255,255,255,${CONT_MARK_ALPHA})`
        ctx.lineWidth = 1
        const cy = snapBoxCenterYPx(
          ys[i]! + height[i]! * 0.5,
          height[i]!,
          scrollY,
        )
        const halfH = markerHalfHeight(height[i]!)
        const rawStrand = strands[i]!
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
  },
}
