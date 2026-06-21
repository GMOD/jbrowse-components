import { arcYFraction } from './arcYScale.ts'
import { ARC_SHAPE_FLAT, ARC_SHAPE_FLAT_SPLIT } from './compute.ts'
import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  type DrawBlock,
  type RenderState,
  bpToScreenX,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import {
  ARC_HEIGHT_MARGIN,
  arcColorPalette,
} from '../../LinearAlignmentsDisplay/shaders/palettes.ts'
import {
  ARC_FAR_SCREEN_WIDTHS,
  ARC_FLAT_MIN_PX,
} from '../../LinearAlignmentsDisplay/shaders/slang/arc.generated.ts'

import type { ArcsUploadData } from './types.ts'
import type { RGBColor } from '../../LinearAlignmentsDisplay/shaders/colors.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface DrawArcsOpts {
  bpToScreenX: (bp: number) => number
  // Genomic bp that map to the full arcs band height (availH). Arc/bezier
  // mode passes availH/pxPerBp (zoom-proportional); samplot mode passes the
  // autoscaled max |tlen| so Y is zoom-stable. Mirrors arc.slang's
  // `arcsYDomainBp` uniform — one code path, caller-chosen value.
  arcsYDomainBp: number
  // Samplot maps yBp=|tlen| with a base-2 log scale (small inserts spread near
  // the baseline, matching origin/main's d3.scaleLog().base(2)); arc mode stays
  // linear. Mirrors arc.slang's `arcsYLog` uniform.
  arcsYLog: boolean
  arcsTop: number
  arcsH: number
  pairedArcsDown: boolean
  lineWidth: number
  palette: RGBColor[]
  // Visible width in px (mirrors arc.slang's `canvasW`); sets the far-pair
  // threshold below.
  screenWidthPx: number
}

// Strokes one non-flat paired-read arc between screen-x sx1 and sx2. Caller
// sets strokeStyle and clips to the band. `far` picks the shape:
//  - near: a rounded dome (cubic bezier, control points at the apex) — matches
//    arc.slang; the bezier peak reaches 0.75·(apexY-anchorY).
//  - far: a full-size circle whose radius is the real half-width. It's so big
//    the band clip leaves only the near-vertical sides at each real endpoint.
function strokeArc(
  ctx: Ctx2D,
  sx1: number,
  sx2: number,
  anchorY: number,
  apexY: number,
  pairedArcsDown: boolean,
  far: boolean,
) {
  ctx.beginPath()
  if (far) {
    const midX = (sx1 + sx2) / 2
    const r = Math.abs(sx2 - sx1) / 2
    const [start, end] = pairedArcsDown ? [0, Math.PI] : [Math.PI, 2 * Math.PI]
    ctx.arc(midX, anchorY, r, start, end)
  } else {
    ctx.moveTo(sx1, anchorY)
    ctx.bezierCurveTo(sx1, apexY, sx2, apexY, sx2, anchorY)
  }
  ctx.stroke()
}

// Inner arc rasterizer. yBp is the Y apex in genomic bp — for flat it is the
// constant line Y, otherwise the curve apex. See ARC_SHAPE_* in compute.ts.
function drawArcsToCtx(ctx: Ctx2D, data: ArcsUploadData, opts: DrawArcsOpts) {
  const {
    bpToScreenX,
    arcsYDomainBp,
    arcsYLog,
    arcsTop,
    arcsH,
    pairedArcsDown,
    lineWidth,
    palette,
    screenWidthPx,
  } = opts
  // Pre-stringify the palette once per draw — saves N Math.round + string
  // allocations per frame (N = numArcs, often thousands). Faded variant is used
  // for samplot flat lines; kept above samplot.py's 0.25 so an isolated thin
  // short-insert pair stays legible (mirrors arc.slang's flat-line alpha).
  const cssPalette = palette.map(c => rgb255(c))
  const cssPaletteFaded = palette.map(c => rgba255(c, 0.4))
  const paletteLen = cssPalette.length
  // Anchor = where arcs meet the adjacent band (insert-size 0). pointing-up
  // sits at the bottom of the band; pointing-down sits at the top. Matches
  // the GPU shader and the right-side insert-size scalebar.
  const anchorY = pairedArcsDown ? arcsTop : arcsTop + arcsH
  const availH = arcsH - ARC_HEIGHT_MARGIN

  ctx.lineWidth = lineWidth
  for (let i = 0; i < data.numArcs; i++) {
    const x1Bp = data.arcX1[i]!
    const x2Bp = data.arcX2[i]!
    const colorIdx = data.arcColorTypes[i]!
    const shape = data.arcShapeTypes[i]!
    const yBp = data.arcYBp[i]!

    const sx1 = bpToScreenX(x1Bp)
    const sx2 = bpToScreenX(x2Bp)
    const arcH = Math.min(
      arcYFraction(yBp, arcsYDomainBp, arcsYLog) * availH,
      availH,
    )
    const apexY = pairedArcsDown ? anchorY + arcH : anchorY - arcH

    const isFlat = shape === ARC_SHAPE_FLAT || shape === ARC_SHAPE_FLAT_SPLIT
    const paletteForShape = isFlat ? cssPaletteFaded : cssPalette
    ctx.strokeStyle = paletteForShape[colorIdx % paletteLen]!
    ctx.setLineDash(shape === ARC_SHAPE_FLAT_SPLIT ? [3, 3] : [])
    if (isFlat) {
      // clamp to a minimum drawn width (centered on the midpoint) so
      // short-insert pairs stay visible; mirrors arc.slang's flat-line clamp
      const mid = (sx1 + sx2) / 2
      const halfPx = Math.max(Math.abs(sx2 - sx1), ARC_FLAT_MIN_PX) / 2
      ctx.beginPath()
      ctx.moveTo(mid - halfPx, apexY)
      ctx.lineTo(mid + halfPx, apexY)
      ctx.stroke()
    } else {
      // far is purely a function of on-screen span — no bp limit.
      const far = Math.abs(sx2 - sx1) > ARC_FAR_SCREEN_WIDTHS * screenWidthPx
      strokeArc(ctx, sx1, sx2, anchorY, apexY, pairedArcsDown, far)
    }
  }
  ctx.setLineDash([])
}

// Canvas2D / SVG entry point used by drawAlignmentBlocks. Paints the arcs band
// (bezier curves and flat lines) plus the small dots that mark arc-line
// connector endpoints.
export function drawArcs(
  ctx: Ctx2D,
  region: ArcsUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
  arcsTop: number,
  arcsH: number,
  pairedArcsDown: boolean,
  screenWidthPx: number,
) {
  // Samplot autoscales via state.arcsYDomainBp; arc mode falls back to the
  // bp-span that fits availH at the current zoom. availH must match the value
  // used in drawArcsToCtx (and the GPU's fillArcUniforms) or the fallback
  // domain scales arcs to a different height than they're plotted into.
  const availH = arcsH - ARC_HEIGHT_MARGIN
  const pxPerBp = fullBlockWidth / bpLength
  const fallbackDomain = pxPerBp > 0 ? availH / pxPerBp : 1
  drawArcsToCtx(ctx, region, {
    bpToScreenX: bp => bpToScreenX(bp, block, bpLength, fullBlockWidth),
    arcsYDomainBp: state.arcsYDomainBp ?? fallbackDomain,
    arcsYLog: state.arcsYDomainBp !== undefined,
    arcsTop,
    arcsH,
    pairedArcsDown,
    lineWidth: state.readConnectionsLineWidth,
    palette: arcColorPalette,
    screenWidthPx,
  })

  // Interchromosomal connector ticks: a vertical line spanning the arc band at
  // the breakpoint, matching arcLine.slang's full-band ±1 span.
  ctx.lineWidth = state.readConnectionsLineWidth
  ctx.setLineDash([])
  for (let i = 0; i < region.numArcLines; i++) {
    const bp = region.arcLinePositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const colorIdx = region.arcLineColorTypes[i]!
    ctx.strokeStyle = rgb255(
      arcColorPalette[colorIdx % arcColorPalette.length]!,
    )
    ctx.beginPath()
    ctx.moveTo(x, arcsTop)
    ctx.lineTo(x, arcsTop + arcsH)
    ctx.stroke()
  }
}
