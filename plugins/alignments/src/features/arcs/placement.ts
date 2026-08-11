// Where one arc lands on screen. THE derivation — the draw, the hit test and
// the hover highlight all take their geometry from here.
//
// They used to each compute it. Three copies of four lines is cheap to write and
// the drift is silent, because every copy looks right on its own and the two
// that disagree are in different files: `98dd82120b` split the dome's Y from the
// flat mark's and updated two of the three, leaving the highlight tracing a
// curve the renderer had stopped drawing — visible only on wide pairs, which is
// exactly the case the split was about. The hit test had the same divergence
// against the paint one commit earlier, over the far/near width. Two instances
// of one shape is a missing function, not two bugs.
import { arcAvailH, arcDomeDestY, arcYOffsetPx } from './arcYScale.ts'
import { isFlatArcShape } from './compute.ts'

import type { ArcsUploadData } from './types.ts'

// The band frame an arc is placed into. A subset of `ArcHitOptions` by
// construction — the hover passes that straight in — and the fields the Canvas2D
// draw already had in hand.
export interface ArcBandFrame {
  bpToScreenX: (bp: number) => number
  arcsYDomainBp: number
  arcsYLog: boolean
  arcsTop: number
  arcsH: number
  pairedArcsDown: boolean
}

export interface ArcPlacement {
  // Screen x of each mate, in the order the worker resolved them. NOT ordered:
  // a reversed region maps the pair onto the other side of the block, so `sx2`
  // is left of `sx1` there.
  sx1: number
  sx2: number
  // The band edge the arc springs from — insert size 0. Bottom of the band when
  // arcs point up, top when they point down.
  anchorY: number
  // Screen y of the apex (a dome) or of the bar (a flat read-cloud line).
  apexY: number
  // How far the apex is from the anchor, on the drawn side, always positive.
  // The frame the hit test measures in, where "up" and "down" are one case.
  destY: number
  isFlat: boolean
}

export function arcPlacement(
  data: ArcsUploadData,
  i: number,
  frame: ArcBandFrame,
): ArcPlacement {
  const {
    bpToScreenX,
    arcsYDomainBp,
    arcsYLog,
    arcsTop,
    arcsH,
    pairedArcsDown,
  } = frame
  const anchorY = pairedArcsDown ? arcsTop : arcsTop + arcsH
  const availH = arcAvailH(arcsH)
  const yBp = data.arcYBp[i]!
  // The split that diverged, now stated once. A flat mark's Y is CLAMPED into
  // the band; a dome's is not, so a wide pair leaves the band rather than
  // flattening onto its ceiling and elbowing. Mirrors arc.slang, off the two
  // generated helpers it is generated from.
  const isFlat = isFlatArcShape(data.arcShapeTypes[i]!)
  const destY = isFlat
    ? arcYOffsetPx(yBp, arcsYDomainBp, arcsYLog, availH)
    : arcDomeDestY(yBp, arcsYDomainBp, arcsYLog, availH)
  return {
    sx1: bpToScreenX(data.arcX1[i]!),
    sx2: bpToScreenX(data.arcX2[i]!),
    anchorY,
    apexY: pairedArcsDown ? anchorY + destY : anchorY - destY,
    destY,
    isFlat,
  }
}
