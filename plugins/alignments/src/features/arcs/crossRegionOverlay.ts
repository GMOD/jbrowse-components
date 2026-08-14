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
import type { ArcBandFrame } from './mark.ts'

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
  // Whether the two feet are on different chromosomes, which is the one thing a
  // reader cannot get from the picture: the arc crosses a panel divider either
  // way. Drives the tooltip's wording, not the drawing.
  endRefName: string
}

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
}

export function computeCrossRegionArcs({
  arcs,
  bpToScreenX,
  frame,
  lineWidth,
  colors,
}: ComputeCrossRegionArcsOpts): CrossRegionArcShape[] {
  const palette = buildArcColorPalette(colors)
  const out: CrossRegionArcShape[] = []
  for (const arc of arcs) {
    const sx1 = bpToScreenX(arc.p1.refName, arc.p1.bp, arc.p1RegionIndex)
    const sx2 = bpToScreenX(arc.p2.refName, arc.p2.bp, arc.p2RegionIndex)
    if (sx1 === undefined || sx2 === undefined) {
      continue
    }
    out.push({
      key: arc.key,
      d: arcMarkScreenPath(
        arcMarkFrom(
          { sx1, sx2, yBp: arc.yBp, shapeType: arc.shapeType },
          frame,
        ),
      ),
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
  // is routine — so support alone is the ranking.
  out.sort((a, b) => a.support - b.support)
  return out
}
