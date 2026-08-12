import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { bpToScreenX } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { buildArcColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051) —
// imported from the generated module directly, with no re-export hop.
import { arcColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
// The dome's two radii and the near/far branch behind them, likewise generated
// (adr-051) — see strokeArc.
import { arcRadiiPx } from '../../shaders/slang/arc.js.generated.ts'
// The flat-line constants moved with the flat line: they are arcFlat.slang's
// now, declared on the pass that consumes them.
import { ARC_FLAT_ALPHA } from '../../shaders/slang/arcFlat.iface.generated.ts'
import { ARC_COLOR_INTERCHROM } from '../../shaders/slang/arcLine.iface.generated.ts'
import { ARC_MARKER_PX } from '../../shaders/slang/arcMarker.iface.generated.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { arcAvailH, arcYScale } from './arcYScale.ts'
import { ARC_SHAPE_FLAT_SPLIT } from './compute.ts'
import { arcPlacement, flatBarExtent } from './placement.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { RGBColor } from '../../shaders/colors.ts'
import type { ArcsUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface DrawArcsOpts {
  bpToScreenX: (bp: number) => number
  // Genomic bp that map to the full arcs band height (availH). Arc/bezier
  // mode passes availH/pxPerBp (zoom-proportional); read-cloud mode passes the
  // autoscaled max |tlen| so Y is zoom-stable. Mirrors arc.slang's
  // `arcsYDomainBp` uniform — one code path, caller-chosen value.
  arcsYDomainBp: number
  // Read cloud maps yBp=|tlen| with a base-2 log scale (small inserts spread near
  // the baseline, matching origin/main's d3.scaleLog().base(2)); arc mode stays
  // linear. Mirrors arc.slang's `arcsYLog` uniform.
  arcsYLog: boolean
  arcsTop: number
  arcsH: number
  pairedArcsDown: boolean
  lineWidth: number
  // The arc slot colors, indexed by the curves and by the read-cloud endpoint
  // squares alike — one meaning, one color. The squares took a `markerPalette`
  // of their own until the short-insert substitution behind it went away.
  palette: RGBColor[]
  // The flat read-cloud connector's own colour — the theme's foreground, not a
  // palette slot, because the line carries no category (its endpoint squares
  // do). Mirrors arcFlat.slang's `u.colorFlatConnector`.
  flatConnectorColor: RGBColor
  // Visible width in px (mirrors arc.slang's `canvasW`); sets the far-pair
  // threshold below.
  screenWidthPx: number
}

// Strokes one non-flat paired-read arc between screen-x sx1 and sx2 as a half
// ellipse rising from the two endpoints. Caller sets strokeStyle and clips to
// the band.
//
// `destY` is `arcPlacement`'s — the drawn-side-positive distance the insert size
// earns, NOT where the ink peaks. The apex is `ARC_APEX_FRACTION` of the way
// there (`arcRadiiPx`, which owns that scaling), so this used to take
// `placement.apexY` and immediately undo it with `abs(apexY - anchorY)`. The
// round trip cost nothing but it made the parameter read as a claim about the
// curve's top that neither renderer honours.
//
// Both radii come from `arcRadiiPx`, generated from arc.slang (adr-051) — the
// near/far branch, the ARC_APEX_FRACTION scaling and the span threshold behind
// them are the shader's, and were hand-written here until
// `arcRadiiParity.test.ts` retired them. The threshold in particular was stated
// in different terms on the two sides (`2*halfWidth > k*canvasW` there,
// `|sx2-sx1| > k*screenWidth` here), which is the shape a comment-synced twin
// drifts in unnoticed; what it decides is an ellipse versus a circle, not a
// pixel. Still exported for arcShape.test.ts, which pins the sweep and the
// centre this wraps them in.
export function strokeArc(
  ctx: Ctx2D,
  sx1: number,
  sx2: number,
  anchorY: number,
  destY: number,
  pairedArcsDown: boolean,
  screenWidthPx: number,
) {
  const [rx, ry] = arcRadiiPx(Math.abs(sx2 - sx1) / 2, destY, screenWidthPx)
  const [start, end] = pairedArcsDown ? [0, Math.PI] : [Math.PI, 2 * Math.PI]
  ctx.beginPath()
  ctx.ellipse((sx1 + sx2) / 2, anchorY, rx, ry, 0, start, end)
  ctx.stroke()
}

// Inner arc rasterizer. yBp is the Y apex in genomic bp — for flat it is the
// constant line Y, otherwise the curve apex. See ARC_SHAPE_* in compute.ts.
function drawArcsToCtx(ctx: Ctx2D, data: ArcsUploadData, opts: DrawArcsOpts) {
  // The band rect is not read here at all: `arcPlacement` takes `opts` whole
  // and resolves the anchor and both mark Ys from it.
  const {
    pairedArcsDown,
    lineWidth,
    palette,
    flatConnectorColor,
    screenWidthPx,
  } = opts
  // Pre-stringify the palette once per draw — saves N Math.round + string
  // allocations per frame (N = numArcs, often thousands).
  const cssPalette = palette.map(c => rgb255(c))
  // Flat (read cloud) connector lines are neutral — the theme's foreground, so
  // they read on a dark track background too; the category color lives in the
  // endpoint squares drawn by the arcMarker pass. ARC_FLAT_ALPHA is
  // arcFlat.slang's, which is also where the GPU twin of this line lives.
  const flatLineCss = rgba255(flatConnectorColor, ARC_FLAT_ALPHA)

  for (let i = 0; i < data.numArcs; i++) {
    const colorIdx = data.arcColorTypes[i]!
    const shape = data.arcShapeTypes[i]!
    // Per arc, not once per draw: an arc is one junction now rather than one
    // read, and its width is how many reads it stands for (`arcLineWidth`).
    // Support 1 resolves to exactly `lineWidth`, so a feed with no repeats
    // paints what it painted before coalescing existed.
    ctx.lineWidth = arcLineWidth(data.arcSupport[i]!, lineWidth)

    // The one placement — shared with `hitTestArcs` and the hover highlight, so
    // none of the three can drift from the other two. `anchorY` comes off it
    // too: the anchor rule is `arcAnchorY`'s, and hoisting a second copy of it
    // out of this loop is how a draw gets to disagree with the placement it is
    // otherwise reading. The band clip is the caller's; a dome deliberately
    // leaves the band rather than flattening onto its ceiling.
    const { sx1, sx2, anchorY, markY, destY, isFlat } = arcPlacement(
      data,
      i,
      opts,
    )

    ctx.setLineDash(shape === ARC_SHAPE_FLAT_SPLIT ? [3, 3] : [])
    if (isFlat) {
      // Neutral connector line clamped to a minimum drawn width (centered on
      // the midpoint) so short-insert pairs stay visible; mirrors
      // arcFlat.slang's clamp. The endpoint squares carry the category color.
      ctx.strokeStyle = flatLineCss
      const { mid, halfPx } = flatBarExtent(sx1, sx2)
      ctx.beginPath()
      ctx.moveTo(mid - halfPx, markY)
      ctx.lineTo(mid + halfPx, markY)
      ctx.stroke()
      // Colored square at each read endpoint (mirrors the arcMarker GPU pass).
      ctx.fillStyle = cssPalette[arcColorSlot(colorIdx)]!
      const m = ARC_MARKER_PX
      ctx.fillRect(sx1 - m / 2, markY - m / 2, m, m)
      ctx.fillRect(sx2 - m / 2, markY - m / 2, m, m)
    } else {
      ctx.strokeStyle = cssPalette[arcColorSlot(colorIdx)]!
      strokeArc(ctx, sx1, sx2, anchorY, destY, pairedArcsDown, screenWidthPx)
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
  // Same domain rule the GPU's fillArcUniforms applies, off the same availH —
  // a mismatch would scale arcs to a different height than they're plotted into.
  const { domainBp, log } = arcYScale(
    state.arcsYDomainBp,
    arcAvailH(arcsH),
    fullBlockWidth / bpLength,
  )
  const arcColors = buildArcColorPalette(state.colors)
  drawArcsToCtx(ctx, region, {
    bpToScreenX: bp => bpToScreenX(bp, block, bpLength, fullBlockWidth),
    arcsYDomainBp: domainBp,
    arcsYLog: log,
    arcsTop,
    arcsH,
    pairedArcsDown,
    lineWidth: state.readConnectionsLineWidth,
    palette: arcColors,
    flatConnectorColor: state.colors.colorFlatConnector,
    screenWidthPx,
  })

  // Interchromosomal connector ticks: a vertical line spanning the arc band at
  // the breakpoint, matching arcLine.slang's full-band ±1 span. Every tick is
  // ARC_COLOR_INTERCHROM — the shader names the same slot — so the color is
  // hoisted out of the loop rather than read per instance.
  ctx.lineWidth = state.readConnectionsLineWidth
  ctx.setLineDash([])
  ctx.strokeStyle = rgb255(arcColors[ARC_COLOR_INTERCHROM]!)
  for (let i = 0; i < region.numArcLines; i++) {
    const bp = region.arcLinePositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    ctx.beginPath()
    ctx.moveTo(x, arcsTop)
    ctx.lineTo(x, arcsTop + arcsH)
    ctx.stroke()
  }
}
