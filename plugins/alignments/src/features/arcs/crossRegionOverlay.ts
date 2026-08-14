import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { buildArcColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051) —
// the same slot the GPU and Canvas2D passes resolve, so an arc that moves to
// this overlay does not change colour.
import { arcColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { arcMarkScreenPath } from './arcPath.ts'
import { arcMarkFrom } from './mark.ts'

import type { ColorPalette } from '../../shaders/colors.ts'
import type { CrossRegionArc } from './compute.ts'
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
export interface CrossRegionArcShape {
  // `ComputedArc.key`, which `resolveArcs` already made unique across the feed.
  key: string
  d: string
  stroke: string
  strokeWidth: number
  // The resolved mark, band-local like `d`. Carried for the hover alone: the
  // highlight is drawn by `ArcHoverOverlay` at the component's origin rather
  // than inside this band's box, so it needs the same mark one offset down —
  // see `offsetArcMark`. Re-projecting it there would be a second geometry.
  mark: ArcMark
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
// real answer and this is only a floor under the DOM.
//
// Interchromosomal is bounded by a far more selective filter and does not need
// this: only pairs joining the two displayed windows qualify at all, and a
// translocation at 300x recruits ~100 pairs (reference/DEEP_COVERAGE.md).
const CROSS_REGION_ARC_CAP = 600

export interface ComputeCrossRegionArcsOpts {
  arcs: CrossRegionArc[]
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
  lineWidth: number
  colors: ColorPalette
  // Told how many it dropped, once per resolve, rather than dropping them
  // silently. The caller owns the reporting because this runs inside a MobX
  // computed that can replay.
  onCapped?: (dropped: number, kept: number) => void
}

export function computeCrossRegionArcs({
  arcs,
  bpToScreenX,
  frame,
  lineWidth,
  colors,
  onCapped,
}: ComputeCrossRegionArcsOpts): CrossRegionArcShape[] {
  const palette = buildArcColorPalette(colors)
  const out: CrossRegionArcShape[] = []
  for (const arc of arcs) {
    const sx1 = bpToScreenX(arc.p1.refName, arc.p1.bp, arc.p1RegionIndex)
    const sx2 = bpToScreenX(arc.p2.refName, arc.p2.bp, arc.p2RegionIndex)
    if (sx1 === undefined || sx2 === undefined) {
      continue
    }
    const mark = arcMarkFrom(
      { sx1, sx2, yBp: arc.yBp, shapeType: arc.shapeType },
      frame,
    )
    out.push({
      key: arc.key,
      d: arcMarkScreenPath(mark),
      mark,
      stroke: rgb255(palette[arcColorSlot(arc.colorType)]!),
      strokeWidth: arcLineWidth(arc.support, lineWidth),
      support: arc.support,
      refName: arc.p1.refName,
      endRefName: arc.p2.refName,
      start: arc.p1.bp,
      end: arc.p2.bp,
      colorType: arc.colorType,
      shapeType: arc.shapeType,
      spanBp: arc.spanBp,
    })
  }
  // ASCENDING SUPPORT, the same order `resolveArcs` sorts the per-region feed
  // into and for the same two reasons: array order is document order, so the
  // last path drawn keeps the pixels it shares, and `pointerEvents: 'stroke'`
  // gives the topmost path the tooltip. `resolveArcs` sorts on paint rank first,
  // but every arc here is one the reader is looking for — nothing cross-region
  // is routine — so support alone is the ranking, tie-broken on the dedup key so
  // the order is the same twice.
  out.sort((a, b) => a.support - b.support || (a.key < b.key ? -1 : 1))
  if (out.length <= CROSS_REGION_ARC_CAP) {
    return out
  }
  // The cap takes the TAIL, which is the heaviest-supported end of the sort
  // above — so what survives is the junctions the most reads agree on, and what
  // goes is the singletons that were about to be painted over anyway.
  const kept = out.slice(out.length - CROSS_REGION_ARC_CAP)
  onCapped?.(out.length - CROSS_REGION_ARC_CAP, kept.length)
  return kept
}
