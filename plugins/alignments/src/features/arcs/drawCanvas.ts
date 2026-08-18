import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { bpToScreenX } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { buildArcColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051) —
// imported from the generated module directly, with no re-export hop.
import { arcColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
// The flat-line constants moved with the flat line: they are arcFlat.slang's
// now, declared on the pass that consumes them.
import {
  ARC_FLAT_ALPHA,
  ARC_FLAT_DASH_PX,
  ARC_FLAT_GAP_PX,
} from '../../shaders/slang/arcFlat.consts.generated.ts'
import {
  ARC_COLOR_INTERCHROM,
  ARC_LINE_DASH_PX,
  ARC_LINE_GAP_PX,
} from '../../shaders/slang/arcLine.consts.generated.ts'
import { ARC_MARKER_PX } from '../../shaders/slang/arcMarker.consts.generated.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { arcAvailH, arcYScale } from './arcYScale.ts'
import { arcMark } from './mark.ts'
import { ARC_SHAPE_FLAT_SPLIT } from './shapes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { RGBColor } from '../../shaders/colors.ts'
import type { ArcBandFrame, ArcDome } from './mark.ts'
import type { ArcsUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// The band frame `arcMark` resolves into, plus what only the paint spends. A
// third declaration of those seven fields used to live here, beside
// `ArcHitOptions`' and the frame's own — which is how the frame could grow a
// field on one side and not the others.
interface DrawArcsOpts extends ArcBandFrame {
  lineWidth: number
  // The arc slot colors, indexed by the curves and by the read-cloud endpoint
  // squares alike — one meaning, one color. The squares took a `markerPalette`
  // of their own until the short-insert substitution behind it went away.
  palette: RGBColor[]
  // The flat read-cloud connector's own colour — the theme's foreground, not a
  // palette slot, because the line carries no category (its endpoint squares
  // do). Mirrors arcFlat.slang's `u.colorFlatConnector`.
  flatConnectorColor: RGBColor
}

// Strokes one paired-read dome. Caller sets strokeStyle and clips to the band.
//
// Takes the resolved mark and nothing else: the two radii, the centre and the
// direction are all `arcMark`'s, generated-from-arc.slang `arcRadiiPx` included
// (adr-051). Those were hand-written here until `arcRadiiParity.test.ts` retired
// them, and the threshold in particular was stated in different terms on the two
// sides (`2*halfWidth > k*canvasW` there, `|sx2-sx1| > k*screenWidth` here) —
// the shape a comment-synced twin drifts in unnoticed, deciding an ellipse
// versus a circle rather than a pixel.
//
// It used to take the resolved geometry's `apexY` and immediately undo it with
// `abs(apexY - anchorY)`; the round trip cost nothing but it made the parameter
// read as a claim about the curve's top that neither renderer honours. A dome
// has no `markY` at all now — that field is the bar's.
//
// Still exported for arcShape.test.ts, which pins the sweep and the centre this
// wraps the radii in.
export function strokeArcMark(ctx: Ctx2D, mark: ArcDome) {
  const [start, end] = mark.down ? [0, Math.PI] : [Math.PI, 2 * Math.PI]
  ctx.beginPath()
  ctx.ellipse(mark.mid, mark.anchorY, mark.rx, mark.ry, 0, start, end)
  ctx.stroke()
}

// Inner arc rasterizer. yBp is the Y apex in genomic bp — for flat it is the
// constant line Y, otherwise the curve apex. See ARC_SHAPE_* in compute.ts.
function drawArcsToCtx(ctx: Ctx2D, data: ArcsUploadData, opts: DrawArcsOpts) {
  // The band rect, the Y scale and the near/far width are not read here at all:
  // `arcMark` takes `opts` whole and resolves every mark from them.
  const { lineWidth, palette, flatConnectorColor } = opts
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

    // The one mark — shared with `hitTestArcBand` and the hover highlight, so
    // none of the three can drift from the other two. Its anchor, its widened
    // bar extent and its two radii all come off this call; hoisting a second
    // copy of any of them out of this loop is how a draw gets to disagree with
    // the geometry it is otherwise reading. The band clip is the caller's; a
    // dome deliberately leaves the band rather than flattening onto its ceiling.
    const mark = arcMark(data, i, opts)

    // arcFlat.slang's own dash, not a `[3, 3]` held to the shader's `6.0`
    // period by a comment — the same move arcLine.slang's tick dash already
    // made, and now the SVG cross-region overlay's third reading of it.
    ctx.setLineDash(
      shape === ARC_SHAPE_FLAT_SPLIT ? [ARC_FLAT_DASH_PX, ARC_FLAT_GAP_PX] : [],
    )
    if (mark.kind === 'bar') {
      // Neutral connector line at the mark's own widened extent, so short-insert
      // pairs stay visible; mirrors arcFlat.slang's clamp. The endpoint squares
      // carry the category color and are a SECOND pass below, not this one's
      // last two statements.
      ctx.strokeStyle = flatLineCss
      ctx.beginPath()
      ctx.moveTo(mark.mid - mark.halfPx, mark.markY)
      ctx.lineTo(mark.mid + mark.halfPx, mark.markY)
      ctx.stroke()
    } else {
      ctx.strokeStyle = cssPalette[arcColorSlot(colorIdx)]!
      strokeArcMark(ctx, mark)
    }
  }
  ctx.setLineDash([])

  // EVERY connector line, THEN every endpoint square — the GPU's pass order
  // (`ARC_FLAT_PASS` before `ARC_MARKER_PASS` in `ARC_PASSES`, whose order is
  // the paint order and says so), rather than each arc's line
  // followed by its own two squares.
  //
  // Interleaved, a connector is translucent (ARC_FLAT_ALPHA 0.7) and opaque
  // squares are not, so every arc later in the feed veiled the squares of every
  // arc before it that its bar crossed. On the GPU no square is ever veiled. The
  // divergence is worst in the mode that emits thousands of these and is the
  // whole reason the squares carry the colour — and since the SVG export paints
  // through this path, an exported read cloud disagreed with the one on screen.
  //
  // A second `arcMark` per flat arc rather than state carried between the loops:
  // it is the same call, so there is nothing here that can drift from the pass
  // above, and next to a `ctx.stroke()` per arc the arithmetic is free.
  //
  // The squares sit on the REAL mates (`sx1`/`sx2`), not on the ends of the bar,
  // which is why a bar carries both: a sub-minimum pair draws a 2.5px bar with
  // its two squares overlapping in the middle of it.
  if (data.numFlatArcs > 0) {
    const m = ARC_MARKER_PX
    for (let i = 0; i < data.numArcs; i++) {
      const mark = arcMark(data, i, opts)
      if (mark.kind === 'bar') {
        const { sx1, sx2, markY } = mark
        ctx.fillStyle = cssPalette[arcColorSlot(data.arcColorTypes[i]!)]!
        ctx.fillRect(sx1 - m / 2, markY - m / 2, m, m)
        ctx.fillRect(sx2 - m / 2, markY - m / 2, m, m)
      }
    }
  }
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

  // Interchromosomal connector ticks FIRST, under everything else in the band:
  // a vertical line spanning the arc band at the breakpoint, matching
  // arcLine.slang's full-band ±1 span. Every tick is ARC_COLOR_INTERCHROM — the
  // shader names the same slot — so the COLOR is hoisted out of the loop rather
  // than read per instance. The WIDTH is not: a tick is one breakpoint since
  // `resolveArcs` coalesced them, so it draws at the width its read support
  // earns, exactly as the arcs below do.
  //
  // Mirrors `ARC_PASSES`, where `ARC_LINE_PASS` leads for the reason given
  // there; `hitTestArcBand` resolves its ties by this same order.
  // DASHED, off arcLine.slang's own constants rather than a pair repeated here
  // — the shader is where the pattern is declared, and this is the CPU twin
  // (adr-051). The reason it is dashed at all is in that file: a tick and a
  // cross-region arc's foot share an x whenever a breakpoint reaches both a
  // displayed acceptor and an undisplayed one, and solid they read as one mark.
  //
  // `SvgCanvas.setLineDash` carries this into the export, so the three
  // renderers agree without the export tracing its own tick.
  ctx.setLineDash([ARC_LINE_DASH_PX, ARC_LINE_GAP_PX])
  ctx.strokeStyle = rgb255(arcColors[ARC_COLOR_INTERCHROM]!)
  for (let i = 0; i < region.numArcLines; i++) {
    const bp = region.arcLinePositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    ctx.lineWidth = arcLineWidth(
      region.arcLineSupport[i]!,
      state.readConnectionsLineWidth,
    )
    ctx.beginPath()
    ctx.moveTo(x, arcsTop)
    ctx.lineTo(x, arcsTop + arcsH)
    ctx.stroke()
  }
  // Scoped to the tick loop rather than left for the next painter to overwrite.
  // `drawArcsToCtx` does set a dash per arc, so nothing downstream reads this
  // today — which is exactly why leaving it set is the kind of thing that only
  // breaks once something is inserted between the two.
  ctx.setLineDash([])

  drawArcsToCtx(ctx, region, {
    bpToScreenX: bp => bpToScreenX(bp, block, bpLength, fullBlockWidth),
    arcsYDomainBp: domainBp,
    arcsYLog: log,
    arcsTop,
    arcsH,
    pairedArcsDown,
    // The CONFIGURED width, unfloored — deliberately not the GPU's
    // `max(readConnectionsLineWidth, 1.5 / dpr)` (fillArcUniforms), and this is
    // the one place in this directory where the two renderers are meant to
    // differ. That floor exists because the shader's AA ramp is a fixed number
    // of DEVICE px (STROKE_AA_PX) and a stroke thinner than it has no room to
    // ramp, so a sub-1.5px arc stairsteps. Canvas2D rasterizes with its own
    // antialiasing and renders a 0.5px line as a faint 1px one, which is the
    // honest picture of a 0.5px line; raising it here would make the export
    // draw thicker than asked. `hitTestArcBand` takes the unfloored width for the
    // same reason, and ARC_HIT_SLOP_PX swallows the sub-pixel difference
    // against the GPU's ink either way.
    lineWidth: state.readConnectionsLineWidth,
    palette: arcColors,
    flatConnectorColor: state.colors.colorFlatConnector,
    screenWidthPx,
  })
}
