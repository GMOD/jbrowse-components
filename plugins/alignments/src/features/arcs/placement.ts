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
import { arcAvailH, arcYOffsetPx } from './arcYScale.ts'
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
  // Screen y of a FLAT read-cloud mark: the bar itself and the two endpoint
  // squares on it. It was called `apexY` and documented as the dome's apex too,
  // which is not true of any dome the renderers draw: a curve peaks at
  // `ARC_APEX_FRACTION` of `destY` (see `arcRadiiPx`), and the only dome caller
  // it ever had took it apart again to recover `destY`.
  markY: number
  // How far `yBp` plots from the anchor, on the drawn side, always positive.
  // The frame the hit test measures in, where "up" and "down" are one case, and
  // the height the dome's radii are derived from.
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
  // One rule for both mark kinds, CLAMPED into the band. A dome briefly took an
  // unclamped Y (98dd82120b, reverted): that let a wide pair's apex fall below
  // the band, so it drew as two clipped flanks with no arc between its
  // endpoints. Mirrors arc.slang, off the generated helper it is generated from.
  const isFlat = isFlatArcShape(data.arcShapeTypes[i]!)
  const destY = arcYOffsetPx(yBp, arcsYDomainBp, arcsYLog, availH)
  return {
    sx1: bpToScreenX(data.arcX1[i]!),
    sx2: bpToScreenX(data.arcX2[i]!),
    anchorY,
    markY: pairedArcsDown ? anchorY + destY : anchorY - destY,
    destY,
    isFlat,
  }
}
