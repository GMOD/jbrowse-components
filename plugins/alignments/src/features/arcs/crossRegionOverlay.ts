import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { buildArcColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051) —
// the same slot the GPU and Canvas2D passes resolve, so an arc that moves to
// this overlay does not change colour.
import { arcColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import {
  ARC_FLAT_ALPHA,
  ARC_FLAT_DASH_PX,
  ARC_FLAT_GAP_PX,
} from '../../shaders/slang/arcFlat.consts.generated.ts'
import { ARC_COLOR_INTERCHROM } from '../../shaders/slang/arcLine.consts.generated.ts'
import { ARC_MARKER_PX } from '../../shaders/slang/arcMarker.consts.generated.ts'
import { arcPaintOrder } from './arcColors.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { arcMarkScreenPath } from './arcPath.ts'
import { ARC_HIT_SLOP_PX } from './hitTest.ts'
import { arcMarkFrom } from './mark.ts'
import { ARC_SHAPE_FLAT_SPLIT } from './shapes.ts'

import type { ColorPalette } from '../../shaders/colors.ts'
import type { CrossRegionArc } from './arcTypes.ts'
import type { ArcBandFrame, ArcMark } from './mark.ts'

// The arcs no per-region pass can draw, projected across the whole view.
//
// This exists because the two renderers are per-BLOCK: each maps bp to x
// through the block's own range and the GPU draws into a viewport that IS the
// block, so an arc with a foot in another displayed region gets that foot
// extrapolated at this block's scale, to a place the other block is not. See
// `CrossRegionArc` for the measurement — 52 of 381 arcs in an ordinary
// two-region view were being drawn as a pair of dangling halves.
//
// What makes this an overlay rather than a fix inside the passes is that
// nothing per-region can be given the answer: the two feet live on two
// different bp→px mappings, and only the view holds both. `bezierArcScope`'s
// `crossRegion` is the same conclusion reached for the per-read connectors.
//
// SVG for the same reason sashimi is: the set is inherently small — a fragment
// can straddle only one seam — so the vector cost is nothing and the paths
// carry native hover.
// One endpoint square of a read-cloud connector, as the five SVG `<rect>`
// attributes, so a host is `<rect {...marker} />` and cannot transpose them —
// the shape `ArcBandClip` already takes for the band rect.
export interface CrossRegionArcMarker {
  x: number
  y: number
  width: number
  height: number
  fill: string
}

export interface CrossRegionArcShape {
  // `ComputedArc.key`, which `resolveArcs` already made unique across the feed.
  key: string
  d: string
  stroke: string
  strokeWidth: number
  // `stroke-dasharray`, present only on the split-read read-cloud connector —
  // arcFlat.slang's dash, which `drawArcsToCtx` hands to `setLineDash` and the
  // GPU fragment measures its phase against.
  dash?: string
  // The two endpoint squares of a read-cloud connector, absent on every other
  // mark. They are where a flat arc's CATEGORY COLOUR lives (arcMarker.slang;
  // the line between them is neutral), so an overlay drawing only `d` published
  // a bar with no insert-size or orientation channel at all.
  markers?: CrossRegionArcMarker[]
  // The resolved mark, band-local like `d`. Carried for the hover alone: the
  // highlight is drawn by `ArcHoverOverlay` at the component's origin rather
  // than inside this band's box, so it needs the same mark one offset down —
  // see `offsetArcMark`. Re-projecting it there would be a second geometry.
  mark: ArcMark
  // How wide this arc answers a hover, as opposed to how wide it draws.
  //
  // An SVG path with `pointerEvents: 'stroke'` answers on its own ink and
  // nothing more, so at the default `readConnectionsLineWidth` of 1 these arcs
  // had a ONE PIXEL target while every arc inside a region had seven —
  // `hitTestArcBand` adds `ARC_HIT_SLOP_PX` either side of the stroke, for the
  // reason given there: an arc is ink a few px wide in a band tens of px tall,
  // and a hairline target makes the tooltip a thing you fish for. These are the
  // arcs a two-region view is opened for (every interchromosomal arc is one), so
  // they were the hardest to hover in the band that most needed hovering.
  //
  // The host strokes a second, invisible path at this width and hangs the
  // handlers on that — see `CrossRegionArcsOverlay`. Resolved here rather than at
  // the host so the two families' tolerance is one expression: this is
  // `hitTestArcBand`'s target, spelled for a renderer that has no hit test.
  //
  // It also covers the endpoint squares, by the same arithmetic that covers them
  // on canvas: `ARC_MARKER_PX / 2 <= ARC_HIT_SLOP_PX`, and the squares sit on the
  // bar this widens.
  hitStrokeWidth: number
  // Reads coalesced into this arc, exactly as the stroke width encodes it and
  // as `ArcTooltipPayload` reports it.
  support: number
  refName: string
  start: number
  end: number
  colorType: number
  // Carried for the hover, which reports the same fields for these arcs as for
  // the ones inside a region — see `formatArcTooltip`.
  shapeType: number
  spanBp: number
  // The far foot's refName. Equal to `refName` for a same-chromosome arc across
  // a seam, and different for an interchromosomal one — which is the one thing
  // a reader cannot get from the picture, since the arc crosses a panel divider
  // either way. `formatArcTooltip` needs both or it prints a locstring naming
  // one chromosome and a coordinate from another.
  endRefName: string
}

// How many cross-region arcs one lane's overlay will draw.
//
// Sized for the SAME-CHROMOSOME multi-seam case, which is the one that is
// actually unbounded — not the interchromosomal one. Cross-region arcs at a
// seam are the fragments straddling it, so the count scales with physical
// coverage and with the number of seams: the measured input is 52 of 381 arcs
// (13.6%) on ONE seam of a ~30x paired-end sample, and the same seam at 300x is
// ~10x that before an N-region view multiplies it again. 600 is roughly two
// deep seams' worth, which is already past the point where the picture is a
// wash of ink rather than a set of junctions; the reader's own lever at that
// depth (`drawProperPairArcs: false`, which drops 9138 of 9204 arcs) is the
// real answer and this is a floor under the frame rather than a filter.
//
// It bounds the WORK as well as the DOM, which is why the projection below runs
// before the build rather than after — see `computeCrossRegionArcs`.
//
// Interchromosomal is bounded by a far more selective filter and does not need
// this: only pairs joining the two displayed windows qualify at all, and a
// translocation at 300x recruits ~100 pairs (reference/DEEP_COVERAGE.md).
const CROSS_REGION_ARC_CAP = 600

export interface ComputeCrossRegionArcsOpts {
  arcs: readonly CrossRegionArc[]
  // Resolves each foot through ITS OWN displayed region, which is the entire
  // difference from the per-region passes. Returns undefined for a coordinate
  // that projects nowhere, and that arc is dropped rather than clamped to an
  // edge it does not reach.
  bpToScreenX: (
    refName: string,
    bp: number,
    displayedRegionIndex: number,
  ) => number | undefined
  // The band, minus the projection the frame's own `bpToScreenX` would have
  // supplied — that is the field this overlay replaces.
  //
  // `screenWidthPx` is the WHOLE VIEW's here, not a block's. In the per-region
  // passes it must be the block's, because it decides `arcRadiiPx`' near/far
  // branch and a consumer on the other side of that test from the paint is
  // measuring a different mark. There is no other paint to agree with here:
  // this overlay IS the paint for these arcs, and the width they are drawn
  // across is the view's.
  frame: Omit<ArcBandFrame, 'bpToScreenX'>
  // Whether a displayed region draws right-to-left, which mirrors a foot's
  // genomic direction into a screen one. A view-level property in practice —
  // `horizontallyFlip` sets `reversed` on every region — but asked per region,
  // because that is what the projection above is keyed on and a session is free
  // to reverse one region and not another.
  regionReversed: (displayedRegionIndex: number) => boolean
  lineWidth: number
  colors: ColorPalette
  // Told how many it dropped, once per resolve, rather than dropping them
  // silently. The caller owns the reporting because this runs inside a MobX
  // computed that can replay.
  onCapped?: (dropped: number, kept: number) => void
}

// The genomic direction of the retained arm at each foot, mirrored per region
// into the screen direction `ArcFeet` wants — the producers resolved it, this
// only reflects it — and only for the family that has no other channel
// left: `ARC_COLOR_INTERCHROM` overwrites orientation, insert size and long-range
// distance with one colour, so a reader of an interchromosomal arc has nothing
// telling them which arms are joined.
//
// The same-chromosome cross-region arcs deliberately get none. Their colour
// already carries it — `unpairedOrientationColor` paints a strand-flip junction
// magenta and a co-linear one yellow, which is what a pair of feet would say —
// and, decisively, an arc is only in this overlay while its two feet sit in
// different displayed regions. Feet here alone would appear and disappear as the
// view is panned across a seam, for the identical junction. Interchromosomal
// cannot: two refNames never share a region, so every arc in that family is
// always drawn right here.
function screenFeet(
  arc: CrossRegionArc,
  regionReversed: (displayedRegionIndex: number) => boolean,
  strokeWidth: number,
) {
  if (arc.colorType !== ARC_COLOR_INTERCHROM) {
    return undefined
  }
  return {
    dir1: arc.p1Dir * (regionReversed(arc.p1RegionIndex) ? -1 : 1),
    dir2: arc.p2Dir * (regionReversed(arc.p2RegionIndex) ? -1 : 1),
    // Half the arc's own stroke, so the tick clears the band's clip by exactly
    // its own half-width whatever `support` made it — see `feetSubpaths`.
    insetPx: strokeWidth / 2,
  }
}

// Everything about a mark that is not its path: the stroke, the split variant's
// dash, and the two endpoint squares.
//
// It exists because a DOME is stroked in its category colour and a BAR is not.
// This overlay painted both with `palette[arcColorSlot(colorType)]`, on the
// argument its own import comment makes — an arc moving here must not change
// colour — which holds for the domes and fails for the read cloud's flat
// connector: the per-region passes draw that line in the theme's neutral
// foreground at ARC_FLAT_ALPHA (arcFlat.slang, `flatConnectorTheme.test.ts`) and
// keep the insert-size / orientation colour in the two squares at its ends. A
// discordant pair straddling a seam therefore published as an opaque saturated
// line with no squares — the one mark in the band whose whole category channel
// had gone missing — and the split variant lost its dash with it.
//
// The squares sit on the REAL mates rather than on the ends of the bar
// `arcMarkFrom` widened, which is `drawArcsToCtx`' rule and `packArcMarkers`'
// alike: a sub-minimum pair draws them overlapping in the middle of its 2.5px
// bar.
function markInk(
  mark: ArcMark,
  shapeType: number,
  categoryCss: string,
  flatConnectorCss: string,
) {
  if (mark.kind !== 'bar') {
    return { stroke: categoryCss }
  }
  const { sx1, sx2, markY } = mark
  const m = ARC_MARKER_PX
  return {
    stroke: flatConnectorCss,
    dash:
      shapeType === ARC_SHAPE_FLAT_SPLIT
        ? `${ARC_FLAT_DASH_PX} ${ARC_FLAT_GAP_PX}`
        : undefined,
    markers: [sx1, sx2].map(x => ({
      x: x - m / 2,
      y: markY - m / 2,
      width: m,
      height: m,
      fill: categoryCss,
    })),
  }
}

export function computeCrossRegionArcs({
  arcs,
  bpToScreenX,
  frame,
  regionReversed,
  lineWidth,
  colors,
  onCapped,
}: ComputeCrossRegionArcsOpts): CrossRegionArcShape[] {
  // PROJECT FIRST, BUILD LAST, with the cap in between — because this runs on
  // every pan frame and the cap can throw most of its input away. Projecting is
  // two `bpToPx` calls over a list of displayed regions; BUILDING is a mark, a
  // radii solve and a path string per arc, and the string is what dominates. Cap
  // after building and a lane 5000 arcs deep pays for 5000 path strings a frame
  // to draw 600, which is the one regime the cap exists for.
  //
  // An arc that projects nowhere is dropped rather than clamped to an edge it
  // does not reach, and it is dropped HERE so the reported count below is what
  // was really left out for want of room.
  const projected: { arc: CrossRegionArc; sx1: number; sx2: number }[] = []
  for (const arc of arcs) {
    const sx1 = bpToScreenX(arc.p1.refName, arc.p1.bp, arc.p1RegionIndex)
    const sx2 = bpToScreenX(arc.p2.refName, arc.p2.bp, arc.p2RegionIndex)
    if (sx1 !== undefined && sx2 !== undefined) {
      projected.push({ arc, sx1, sx2 })
    }
  }
  // `arcPaintOrder`, the same comparator `resolveArcs` puts the per-region feed
  // in, for the same two reasons one level down: array order is document order,
  // so the last path drawn keeps the pixels it shares, and `pointerEvents:
  // 'stroke'` gives the topmost path the tooltip.
  //
  // Re-sorted here rather than trusted off the input, because the projection
  // above DROPS arcs and the cap below reads the tail — an order the caller
  // happens to leave behind is not a thing to key a filter on.
  //
  // It sorted on support alone, on the ground that "nothing cross-region is
  // routine". That is false, and the cap's own comment says so two paragraphs
  // up: cross-region arcs at a seam ARE the fragments straddling it, so at depth
  // this set is overwhelmingly ordinary concordant pairs — the 9138-of-9204
  // ratio `arcPaintRank` exists for, arriving here as well. Ranking them by
  // support alone let a grey pair two reads deep paint over, and take the hover
  // from, the interchromosomal arc the two-region view was opened to see; and
  // the cap, taking the tail, dropped that arc first.
  projected.sort((a, b) => arcPaintOrder(a.arc, b.arc))
  // The cap takes the TAIL, which is the categorized, heaviest-supported end of
  // that sort — so what survives is what the picture is for, and what goes is
  // the routine singletons that were about to be painted over anyway.
  let kept = projected
  if (projected.length > CROSS_REGION_ARC_CAP) {
    kept = projected.slice(projected.length - CROSS_REGION_ARC_CAP)
    onCapped?.(projected.length - CROSS_REGION_ARC_CAP, kept.length)
  }
  const palette = buildArcColorPalette(colors)
  // The connector's neutral, resolved once per lane rather than per bar: it is
  // the theme's foreground and the same string for every flat arc in the feed —
  // `drawArcsToCtx` hoists it out of its own loop for the same reason.
  const flatConnectorCss = rgba255(colors.colorFlatConnector, ARC_FLAT_ALPHA)
  return kept.map(({ arc, sx1, sx2 }) => {
    const strokeWidth = arcLineWidth(arc.support, lineWidth)
    const mark = arcMarkFrom(
      {
        sx1,
        sx2,
        yBp: arc.yBp,
        shapeType: arc.shapeType,
        feet: screenFeet(arc, regionReversed, strokeWidth),
      },
      frame,
    )
    return {
      key: arc.key,
      d: arcMarkScreenPath(mark),
      mark,
      ...markInk(
        mark,
        arc.shapeType,
        rgb255(palette[arcColorSlot(arc.colorType)]!),
        flatConnectorCss,
      ),
      strokeWidth,
      hitStrokeWidth: strokeWidth + 2 * ARC_HIT_SLOP_PX,
      support: arc.support,
      refName: arc.p1.refName,
      endRefName: arc.p2.refName,
      start: arc.p1.bp,
      end: arc.p2.bp,
      colorType: arc.colorType,
      shapeType: arc.shapeType,
      spanBp: arc.spanBp,
    }
  })
}
