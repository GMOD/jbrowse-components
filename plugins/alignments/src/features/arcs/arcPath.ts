// One arc's drawn ink, as an SVG path — the hover highlight's mark.
//
// A path string rather than a shape union, matching `SashimiArc.d`: the two
// kinds of arc differ only in the `d` they trace, every consumer strokes it, and
// the highlight is stored as a hover snapshot, so plain data is what it has to
// be. The geometry is `arcPlacement`'s, not a second reading of it.
import { arcRadiiPx } from '../../shaders/slang/arc.js.generated.ts'
import { ARC_FLAT_MIN_PX } from '../../shaders/slang/arcFlat.iface.generated.ts'
import { arcPlacement } from './placement.ts'

import type { ArcBandFrame } from './placement.ts'
import type { ArcsUploadData } from './types.ts'

export function arcScreenPath(
  data: ArcsUploadData,
  i: number,
  frame: ArcBandFrame & { screenWidthPx: number },
) {
  const { sx1, sx2, anchorY, apexY, destY, isFlat } = arcPlacement(
    data,
    i,
    frame,
  )
  const mid = (sx1 + sx2) / 2
  if (isFlat) {
    // The read cloud's connector, widened about its midpoint to the minimum
    // drawn length — so a sub-minimum pair traces the bar it actually paints,
    // the same extent `flatDistance` hit-tests.
    const halfPx = Math.max(Math.abs(sx2 - sx1), ARC_FLAT_MIN_PX) / 2
    return `M ${mid - halfPx} ${apexY} L ${mid + halfPx} ${apexY}`
  }
  const [rx, ry] = arcRadiiPx(
    Math.abs(sx2 - sx1) / 2,
    destY,
    frame.screenWidthPx,
  )
  // Foot to foot over the apex. The sweep flag is the only thing the band's
  // direction changes: with y pointing down, 1 bulges up and 0 bulges down,
  // which is `strokeArc`'s [PI, 2PI] / [0, PI] choice said in path terms.
  return `M ${mid - rx} ${anchorY} A ${rx} ${ry} 0 0 ${frame.pairedArcsDown ? 0 : 1} ${mid + rx} ${anchorY}`
}
