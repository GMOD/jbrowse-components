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
import { ARC_COLOR_INTERCHROM } from '../../shaders/slang/arcLine.consts.generated.ts'
import { ARC_MARKER_PX } from '../../shaders/slang/arcMarker.consts.generated.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { arcAvailH, arcYScale } from './arcYScale.ts'
import { arcMark } from './mark.ts'
import { ARC_SHAPE_FLAT_SPLIT, isFlatArcShape } from './shapes.ts'

import type { DrawBlock } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { ArcBandFrame, ArcDome } from './mark.ts'
import type { ArcsUploadData } from './types.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

// The band frame `arcMark` resolves into, plus what only the paint spends. A
// third declaration of those seven fields used to live here, beside
// `ArcHitOptions`' and the frame's own — which is how the frame could grow a
// field on one side and not the others.
export interface DrawArcsOpts extends ArcBandFrame {
  // The CONFIGURED width, unfloored — deliberately not the GPU's
  // `max(readConnectionsLineWidth, 1.5 / dpr)`, and this is the one place in
  // this directory where the two renderers are meant to differ. That floor
  // exists because the shader's AA ramp is a fixed number of DEVICE px
  // (STROKE_AA_PX) and a stroke thinner than it has no room to ramp, so a
  // sub-1.5px arc stairsteps. Canvas2D rasterizes with its own antialiasing and
  // renders a 0.5px line as a faint 1px one, which is the honest picture of a
  // 0.5px line; raising it here would make the export draw thicker than asked.
  // `hitTestArcBand` takes the unfloored width for the same reason, and
  // ARC_HIT_SLOP_PX swallows the sub-pixel difference against the GPU's ink
  // either way.
  lineWidth: number
  // The arc slot colors, indexed by the curves and by the read-cloud endpoint
  // squares alike — one meaning, one color. The squares took a `markerPalette`
  // of their own until the short-insert substitution behind it went away.
  // Pre-stringified once per block, since three of the four painters index it
  // per instance.
  cssPalette: string[]
  // The flat read-cloud connector's own colour — the theme's foreground, not a
  // palette slot, because the line carries no category (its endpoint squares
  // do). Mirrors arcFlat.slang's `u.colorFlatConnector`, alpha included.
  flatLineCss: string
}

// The frame every painter below resolves its marks in, for one block of one
// section. Its `arcYScale` call is the same domain rule `writeArcBandUniforms`
// applies, off the same availH — a mismatch would scale arcs to a different
// height than they are plotted into.
export function arcDrawOpts({
  block,
  bpLength,
  fullBlockWidth,
  arcsTop,
  arcsH,
  pairedArcsDown,
  screenWidthPx,
  arcsYDomainBp,
  lineWidth,
  colors,
}: {
  block: DrawBlock
  bpLength: number
  fullBlockWidth: number
  arcsTop: number
  arcsH: number
  pairedArcsDown: boolean
  screenWidthPx: number
  arcsYDomainBp: number | undefined
  lineWidth: number
  colors: ColorPalette
}): DrawArcsOpts {
  const { domainBp, log } = arcYScale(
    arcsYDomainBp,
    arcAvailH(arcsH),
    fullBlockWidth / bpLength,
  )
  return {
    bpToScreenX: bp => bpToScreenX(bp, block, bpLength, fullBlockWidth),
    arcsYDomainBp: domainBp,
    arcsYLog: log,
    arcsTop,
    arcsH,
    pairedArcsDown,
    screenWidthPx,
    lineWidth,
    cssPalette: buildArcColorPalette(colors).map(c => rgb255(c)),
    flatLineCss: rgba255(colors.colorFlatConnector, ARC_FLAT_ALPHA),
  }
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
export function strokeArcMark(ctx: MarkContext2D, mark: ArcDome) {
  const [start, end] = mark.down ? [0, Math.PI] : [Math.PI, 2 * Math.PI]
  ctx.beginPath()
  ctx.ellipse(mark.mid, mark.anchorY, mark.rx, mark.ry, 0, start, end)
  ctx.stroke()
}

// The band's four marks, in `ARC_BAND_MARKS` paint order. Each is one GPU
// pass's Canvas2D twin, and each resolves its geometry through `arcMark` — the
// one derivation the stroke, the hover highlight, the hit test and the debug
// overlay all read.
//
// They were one function with a kind branch inside its loop and a second loop
// for the squares. Splitting them along the passes is what lets the band be
// declared as marks; it changes no pixel, because `computeArcShape` emits a
// flat shape iff `cloud`, so a feed is all domes or all bars and the branch
// never interleaved two kinds in one draw.

// Interchromosomal connector ticks: a vertical line spanning the arc band at
// the breakpoint, matching arcLine.slang's full-band span. Every tick is
// ARC_COLOR_INTERCHROM — the shader names the same slot — so the COLOR is
// hoisted out of the loop rather than read per instance. The WIDTH is not: a
// tick is one breakpoint since `resolveArcs` coalesced them, so it draws at the
// width its read support earns, exactly as the arcs below do.
//
// Solid, and said so on the shared context: the bar painter sets a dash per
// arc, so a tick painted after one would otherwise inherit it.
export function drawArcTicks(
  ctx: MarkContext2D,
  data: ArcsUploadData,
  opts: DrawArcsOpts,
) {
  const { arcsTop, arcsH, lineWidth, cssPalette } = opts
  ctx.setLineDash([])
  ctx.strokeStyle = cssPalette[ARC_COLOR_INTERCHROM]!
  for (let i = 0; i < data.numArcLines; i++) {
    const x = opts.bpToScreenX(data.arcLinePositions[i]!)
    ctx.lineWidth = arcLineWidth(data.arcLineSupport[i]!, lineWidth)
    ctx.beginPath()
    ctx.moveTo(x, arcsTop)
    ctx.lineTo(x, arcsTop + arcsH)
    ctx.stroke()
  }
}

// Per arc, not once per draw: an arc is one junction now rather than one read,
// and its width is how many reads it stands for (`arcLineWidth`). Support 1
// resolves to exactly `lineWidth`, so a feed with no repeats paints what it
// painted before coalescing existed.
function strokeWidthAt(
  ctx: MarkContext2D,
  data: ArcsUploadData,
  i: number,
  lineWidth: number,
) {
  ctx.lineWidth = arcLineWidth(data.arcSupport[i]!, lineWidth)
}

// Curved paired-read domes (arc.slang). Never dashed — the dash is the split
// FLAT variant's, and a dome is `ARC_SHAPE_ARC` by construction — so the dash is
// cleared once rather than per arc.
export function drawArcDomes(
  ctx: MarkContext2D,
  data: ArcsUploadData,
  opts: DrawArcsOpts,
) {
  const { cssPalette } = opts
  ctx.setLineDash([])
  for (let i = 0; i < data.numArcs; i++) {
    if (!isFlatArcShape(data.arcShapeTypes[i]!)) {
      const mark = arcMark(data, i, opts)
      if (mark.kind === 'dome') {
        strokeWidthAt(ctx, data, i, opts.lineWidth)
        ctx.strokeStyle = cssPalette[arcColorSlot(data.arcColorTypes[i]!)]!
        strokeArcMark(ctx, mark)
      }
    }
  }
}

// Read-cloud flat connectors (arcFlat.slang). Neutral — the theme's foreground,
// so they read on a dark track background too; the category color lives in the
// endpoint squares. ARC_FLAT_ALPHA is arcFlat.slang's, which is also where the
// GPU twin of this line lives. The bar is drawn at the mark's own widened
// extent, so short-insert pairs stay visible; mirrors arcFlat.slang's clamp.
//
// The dash is arcFlat.slang's own, not a `[3, 3]` held to the shader's `6.0`
// period by a comment — and the SVG cross-region overlay reads the same pair as
// its third consumer.
export function drawArcBars(
  ctx: MarkContext2D,
  data: ArcsUploadData,
  opts: DrawArcsOpts,
) {
  ctx.strokeStyle = opts.flatLineCss
  for (let i = 0; i < data.numArcs; i++) {
    if (isFlatArcShape(data.arcShapeTypes[i]!)) {
      const mark = arcMark(data, i, opts)
      if (mark.kind === 'bar') {
        strokeWidthAt(ctx, data, i, opts.lineWidth)
        const dashed = data.arcShapeTypes[i] === ARC_SHAPE_FLAT_SPLIT
        ctx.setLineDash(dashed ? [ARC_FLAT_DASH_PX, ARC_FLAT_GAP_PX] : [])
        ctx.beginPath()
        ctx.moveTo(mark.mid - mark.halfPx, mark.markY)
        ctx.lineTo(mark.mid + mark.halfPx, mark.markY)
        ctx.stroke()
      }
    }
  }
  ctx.setLineDash([])
}

// The read cloud's endpoint squares (arcMarker.slang), a pass of their own and
// not the bar painter's last two statements.
//
// EVERY connector line, THEN every endpoint square, which is `ARC_BAND_MARKS`
// order. Interleaved, a connector is translucent (ARC_FLAT_ALPHA 0.7) and
// opaque squares are not, so every arc later in the feed veiled the squares of
// every arc before it that its bar crossed. On the GPU no square is ever veiled.
// The divergence is worst in the mode that emits thousands of these and is the
// whole reason the squares carry the colour — and since the SVG export paints
// through this path, an exported read cloud disagreed with the one on screen.
//
// The squares sit on the REAL mates (`sx1`/`sx2`), not on the ends of the bar,
// which is why a bar carries both: a sub-minimum pair draws a 2.5px bar with its
// two squares overlapping in the middle of it.
export function drawArcMarkers(
  ctx: MarkContext2D,
  data: ArcsUploadData,
  opts: DrawArcsOpts,
) {
  if (data.numFlatArcs === 0) {
    return
  }
  const { cssPalette } = opts
  const m = ARC_MARKER_PX
  for (let i = 0; i < data.numArcs; i++) {
    if (isFlatArcShape(data.arcShapeTypes[i]!)) {
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
