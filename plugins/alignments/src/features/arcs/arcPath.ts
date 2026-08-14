// One arc's drawn ink, as an SVG path — the hover highlight's mark.
//
// A path string rather than a shape union, matching `SashimiArc.d`: the two
// kinds of arc differ only in the `d` they trace, every consumer strokes it, and
// the highlight is stored as a hover snapshot, so plain data is what it has to
// be. The geometry is `arcMark`'s, not a second reading of it.
import { arcMarkY } from './arcYScale.ts'
import { arcMark } from './mark.ts'

import type { ArcBandFrame, ArcDome, ArcMark } from './mark.ts'
import type { ArcsUploadData } from './types.ts'

// How long a breakend foot is drawn, in CSS px. Short: it says a direction, and
// a longer tick starts reading as a second connection lying along the band. 20
// is `plugins/arc`'s and BreakpointSplitView's length, and both draw theirs
// across a whole track rather than inside a ~25-60 px arc band.
export const ARC_FOOT_PX = 10

export function arcScreenPath(
  data: ArcsUploadData,
  i: number,
  frame: ArcBandFrame,
) {
  return arcMarkScreenPath(arcMark(data, i, frame))
}

// The path of an already-resolved mark. Split out for the cross-region overlay,
// which has no `ArcsUploadData` to index into — its arcs are the ones no
// per-region buffer holds — and which must trace the same ink the GPU would
// have, not a lookalike.
export function arcMarkScreenPath(mark: ArcMark) {
  // The read cloud's connector, at the drawn extent `arcMark` widened — so a
  // sub-minimum pair traces the bar it actually paints, which is the same extent
  // the hit test measures.
  if (mark.kind === 'bar') {
    const { mid, halfPx, markY } = mark
    return `M ${mid - halfPx} ${markY} L ${mid + halfPx} ${markY}`
  }
  // Foot to foot over the apex. The sweep flag is the only thing the band's
  // direction changes: with y pointing down, 1 bulges up and 0 bulges down,
  // which is `strokeArcMark`'s [PI, 2PI] / [0, PI] choice said in path terms.
  const { mid, rx, ry, anchorY, down } = mark
  return (
    `M ${mid - rx} ${anchorY} A ${rx} ${ry} 0 0 ${down ? 0 : 1} ${mid + rx} ${anchorY}` +
    feetSubpaths(mark)
  )
}

// The breakend ticks, as subpaths of the arc's own `d` rather than paths of their
// own. That is what keeps them the arc's ink in every sense: same stroke colour
// and width, inside the same `pointerEvents: 'stroke'` hover target, and — the
// half that would otherwise drift — carried by the hover HIGHLIGHT, which
// re-traces the mark through this same function.
//
// Drawn a little inside the band (`insetPx`) instead of on the anchor: the
// overlay's clip is the band rect, so a horizontal tick lying exactly on the
// anchor loses its outer half and publishes thinner than the curve rising out of
// it. `arcMarkY` places the offset on the drawn side, the same helper the ruler
// and the curve use.
function feetSubpaths({ mid, rx, anchorY, down, feet }: ArcDome) {
  if (!feet) {
    return ''
  }
  const y = arcMarkY(anchorY, feet.insetPx, down)
  const left = feet.leftDir
    ? ` M ${mid - rx} ${y} L ${mid - rx + feet.leftDir * ARC_FOOT_PX} ${y}`
    : ''
  const right = feet.rightDir
    ? ` M ${mid + rx} ${y} L ${mid + rx + feet.rightDir * ARC_FOOT_PX} ${y}`
    : ''
  return left + right
}

// One connector tick's ink: a vertical spanning the whole band at the
// breakpoint, which is arcLine.slang's own span and `drawArcs`' moveTo/lineTo.
// Its own function rather than a branch in `arcScreenPath` because the two read
// different arrays — a tick has no `arcMark`, having no Y to place.
export function arcLineScreenPath(
  data: ArcsUploadData,
  i: number,
  frame: ArcBandFrame,
) {
  const x = frame.bpToScreenX(data.arcLinePositions[i]!)
  return `M ${x} ${frame.arcsTop} L ${x} ${frame.arcsTop + frame.arcsH}`
}
