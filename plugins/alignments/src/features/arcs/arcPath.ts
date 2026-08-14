// One arc's drawn ink, as an SVG path — the hover highlight's mark.
//
// A path string rather than a shape union, matching `SashimiArc.d`: the two
// kinds of arc differ only in the `d` they trace, every consumer strokes it, and
// the highlight is stored as a hover snapshot, so plain data is what it has to
// be. The geometry is `arcMark`'s, not a second reading of it.
import { arcMark } from './mark.ts'

import type { ArcBandFrame, ArcMark } from './mark.ts'
import type { ArcsUploadData } from './types.ts'

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
  return `M ${mid - rx} ${anchorY} A ${rx} ${ry} 0 0 ${down ? 0 : 1} ${mid + rx} ${anchorY}`
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
