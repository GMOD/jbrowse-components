// One arc's drawn ink, as an SVG path.
//
// The counterpart to `hitTest.ts` on the other side of the same frame: that one
// answers "is the cursor on this arc", this one answers "where is it", and both
// take the `ArcHitOptions` one projection produced. Every expression below is
// `drawArcsToCtx`'s — same `arcYOffsetPx` off the same `arcAvailH`, same
// `arcRadiiPx`, same `ARC_FLAT_MIN_PX` clamp about the midpoint — so the path
// traces the arithmetic that painted the arc rather than a lookalike.
// `arcPath.test.ts` holds it against the ellipse `strokeArc` actually hands to
// Canvas2D, which is what keeps that true.
//
// A path string rather than a shape union, matching `SashimiArc.d`: the two
// kinds of arc differ only in the `d` they trace, and every consumer wants to
// stroke it, so a union would be a fork carried through the model and the
// overlay to be collapsed again at the `<path>`.
import { arcRadiiPx } from '../../shaders/slang/arc.js.generated.ts'
import { ARC_FLAT_MIN_PX } from '../../shaders/slang/arcFlat.iface.generated.ts'
import { arcAvailH, arcYOffsetPx } from './arcYScale.ts'
import { isFlatArcShape } from './compute.ts'

import type { ArcHitOptions } from './hitTest.ts'
import type { ArcsUploadData } from './types.ts'

export function arcScreenPath(
  data: ArcsUploadData,
  i: number,
  opts: ArcHitOptions,
) {
  const {
    bpToScreenX,
    arcsYDomainBp,
    arcsYLog,
    arcsTop,
    arcsH,
    pairedArcsDown,
    screenWidthPx,
  } = opts
  const anchorY = pairedArcsDown ? arcsTop : arcsTop + arcsH
  const sx1 = bpToScreenX(data.arcX1[i]!)
  const sx2 = bpToScreenX(data.arcX2[i]!)
  const arcH = arcYOffsetPx(
    data.arcYBp[i]!,
    arcsYDomainBp,
    arcsYLog,
    arcAvailH(arcsH),
  )
  const mid = (sx1 + sx2) / 2
  if (isFlatArcShape(data.arcShapeTypes[i]!)) {
    // The read cloud's flat connector, widened about its midpoint to the
    // minimum drawn length — so a sub-minimum pair traces the bar it actually
    // paints, the same extent `flatDistance` hit-tests.
    const halfPx = Math.max(Math.abs(sx2 - sx1), ARC_FLAT_MIN_PX) / 2
    const y = pairedArcsDown ? anchorY + arcH : anchorY - arcH
    return `M ${mid - halfPx} ${y} L ${mid + halfPx} ${y}`
  }
  const [rx, ry] = arcRadiiPx(Math.abs(sx2 - sx1) / 2, arcH, screenWidthPx)
  // Foot to foot over the apex. The sweep flag is the only thing the band's
  // direction changes: with y pointing down, 1 bulges up and 0 bulges down,
  // which is `strokeArc`'s [PI, 2PI] / [0, PI] choice said in path terms.
  return `M ${mid - rx} ${anchorY} A ${rx} ${ry} 0 0 ${pairedArcsDown ? 0 : 1} ${mid + rx} ${anchorY}`
}
