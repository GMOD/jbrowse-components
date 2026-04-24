import { ARC_SHAPE_FLAT } from '../../shared/computeArcsFromPileupData.ts'
import { rgb255 } from '../colorUtils.ts'
import { ARC_HEIGHT_MARGIN } from './shaders/palettes.ts'

import type { RGBColor } from './shaders/colors.ts'
import type { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

type Ctx = CanvasRenderingContext2D | SvgCanvas

interface ArcFields {
  arcX1: Uint32Array
  arcX2: Uint32Array
  arcColorTypes: Uint8Array
  arcShapeTypes: Uint8Array
  arcYBp: Uint32Array
  numArcs: number
}

interface DrawArcsOpts {
  bpToScreenX: (bp: number) => number
  // Genomic bp that map to the full arcs band height (availH). Arc/bezier
  // mode passes availH/pxPerBp (zoom-proportional); samplot mode passes the
  // autoscaled max |tlen| so Y is zoom-stable. Mirrors arc.slang's
  // `arcsYDomainBp` uniform — one code path, caller-chosen value.
  arcsYDomainBp: number
  arcsTop: number
  arcsH: number
  pairedArcsDown: boolean
  lineWidth: number
  palette: RGBColor[]
}

// Shared arc rasterizer used by both the Canvas2D live renderer and the SVG
// export path (via SvgCanvas). See ARC_SHAPE_* in computeArcsFromPileupData.
// yBp is the Y apex in genomic bp — for flat it is the constant line Y,
// otherwise it is the curve apex.
export function drawArcsToCtx(ctx: Ctx, data: ArcFields, opts: DrawArcsOpts) {
  const {
    bpToScreenX,
    arcsYDomainBp,
    arcsTop,
    arcsH,
    pairedArcsDown,
    lineWidth,
    palette,
  } = opts
  // Pre-stringify the palette once per draw — saves N Math.round + string
  // allocations per frame (N = numArcs, often thousands).
  const cssPalette = palette.map(c => rgb255(c))
  const paletteLen = cssPalette.length
  // Anchor = where arcs meet the adjacent band (insert-size 0). pointing-up
  // sits at the bottom of the band; pointing-down sits at the top. Matches
  // the GPU shader and the right-side insert-size scalebar.
  const anchorY = pairedArcsDown ? arcsTop : arcsTop + arcsH
  const availH = arcsH - ARC_HEIGHT_MARGIN
  const yScale = arcsYDomainBp > 0 ? availH / arcsYDomainBp : 0

  ctx.lineWidth = lineWidth
  for (let i = 0; i < data.numArcs; i++) {
    const x1Bp = data.arcX1[i]!
    const x2Bp = data.arcX2[i]!
    const colorIdx = data.arcColorTypes[i]!
    const shape = data.arcShapeTypes[i]!
    const yBp = data.arcYBp[i]!

    const sx1 = bpToScreenX(x1Bp)
    const sx2 = bpToScreenX(x2Bp)
    const arcH = Math.min(yBp * yScale, availH)
    const apexY = pairedArcsDown ? anchorY + arcH : anchorY - arcH

    ctx.strokeStyle = cssPalette[colorIdx % paletteLen]!
    ctx.beginPath()
    if (shape === ARC_SHAPE_FLAT) {
      ctx.moveTo(sx1, apexY)
      ctx.lineTo(sx2, apexY)
    } else {
      // Cubic bezier with control points at (x1,apex) and (x2,apex) — matches
      // arc.slang's `evalArc` so GPU and Canvas2D arcs render identically.
      // Peak reaches 0.75·arcH (not apexY itself) by bezier math.
      ctx.moveTo(sx1, anchorY)
      ctx.bezierCurveTo(sx1, apexY, sx2, apexY, sx2, anchorY)
    }
    ctx.stroke()
  }
}
