// What one arc DRAWS, on screen. THE derivation — the Canvas2D/SVG stroke, the
// hover highlight's path, the hit test and the debug overlay all take their
// geometry from here.
//
// They used to each compute it. Three copies of four lines is cheap to write and
// the drift is silent, because every copy looks right on its own and the two
// that disagree are in different files: `98dd82120b` split the dome's Y from the
// flat mark's and updated two of the three, leaving the highlight tracing a
// curve the renderer had stopped drawing — visible only on wide pairs, which is
// exactly the case the split was about. The hit test had the same divergence
// against the paint one commit earlier, over the far/near width. Two instances
// of one shape is a missing function, not two bugs.
//
// This answers the SHAPE question too, and that is the other half of the same
// argument. Placing an arc used to be shared while resolving what it draws was
// not: each consumer took the placement and then asked `arcRadiiPx` (four sites)
// or widened the bar to `ARC_FLAT_MIN_PX` (three) and branched on `isFlat`
// itself. A mark is a bar or a dome, the numbers that describe each are
// different, and deciding which — once — is what stops a consumer measuring an
// ellipse against a circle the renderer painted.
import { arcRadiiPx } from '../../shaders/slang/arc.js.generated.ts'
import { ARC_FLAT_MIN_PX } from '../../shaders/slang/arcFlat.consts.generated.ts'
import { arcAnchorY, arcAvailH, arcMarkY, arcYOffsetPx } from './arcYScale.ts'
import { isFlatArcShape } from './compute.ts'

import type { ArcsUploadData } from './types.ts'

// The band frame an arc is marked into. A subset of `ArcHitOptions` by
// construction — the hover passes that straight in — and the fields the Canvas2D
// draw already had in hand.
export interface ArcBandFrame {
  bpToScreenX: (bp: number) => number
  arcsYDomainBp: number
  arcsYLog: boolean
  arcsTop: number
  arcsH: number
  pairedArcsDown: boolean
  // The BLOCK's clamped on-screen width, which is the shader's `canvasW` — both
  // renderers upload `scissorW` there. It decides the near/far branch below, so
  // handing the whole track's width instead puts a consumer on a different side
  // of that test from the paint: an ellipse measured against a painted circle,
  // which is a different mark rather than a near miss.
  screenWidthPx: number
}

interface ArcMarkBase {
  // Midpoint of the two mates on screen. Both mark kinds are centred on it: the
  // bar is widened about it and the dome's conic is centred on it.
  mid: number
  // How far `yBp` plots from the anchor, on the drawn side, always positive. The
  // frame the hit test measures in, where "up" and "down" are one case, and the
  // height the dome's radii are derived from.
  //
  // CLAMPED into the band. A dome briefly took an unclamped Y (98dd82120b,
  // reverted): that let a wide pair's apex fall below the band, so it drew as two
  // clipped flanks with no arc between its endpoints. Mirrors arc.slang, off the
  // generated helper it is generated from.
  destY: number
}

// The read cloud's flat connector: a horizontal segment with a square at each
// mate.
export interface ArcBar extends ArcMarkBase {
  kind: 'bar'
  // Screen x of each mate, in the order the worker resolved them. NOT ordered: a
  // reversed region maps the pair onto the other side of the block, so `sx2` is
  // left of `sx1` there. Here for the endpoint squares, which sit on the real
  // mates however far the bar below was widened past them.
  sx1: number
  sx2: number
  // Half the DRAWN length — the pair's own half-span, widened to
  // ARC_FLAT_MIN_PX so a sub-pixel pair still paints something. THE extent: the
  // Canvas2D/SVG stroke, the highlight's path and the hit target all measure it,
  // and each spelled `Math.max(Math.abs(sx2 - sx1), ARC_FLAT_MIN_PX) / 2` for
  // itself, two of the three under a comment promising they mirrored the third.
  halfPx: number
  // Screen y of the bar and of the two squares on it. Bar-only, because it is
  // meaningless for a dome and was read as one anyway: it was called `apexY` and
  // documented as the dome's apex too, which is not true of any dome the
  // renderers draw — a curve peaks at `ARC_APEX_FRACTION` of `destY` (see
  // `arcRadiiPx`), and the only dome caller it ever had took it apart again to
  // recover `destY`.
  markY: number
}

// The paired-read dome: a half conic from foot to foot over the anchor line.
export interface ArcDome extends ArcMarkBase {
  kind: 'dome'
  // The band edge the arc springs from — insert size 0. Bottom of the band when
  // arcs point up, top when they point down. The conic's centre y.
  anchorY: number
  rx: number
  ry: number
  // Which way it bulges, so a stroker and a path builder each take a mark and
  // nothing else — the sweep is the only thing the band's direction changes.
  down: boolean
  // Near pair or far pair, and it is READ OFF the radii rather than re-asking
  // `arcIsFar`: an equal pair is the only thing the far branch returns, and the
  // predicate is `//! js-skip`ped precisely so a consumer cannot ask it
  // separately from the radii it decides. What it distinguishes is numerical,
  // not cosmetic — see `hitTest.ts`, where a far pair's radius reaches millions
  // of px and the ellipse solver cancels away every significant digit.
  far: boolean
}

// A bar or a dome. Every consumer switches on `kind` and is then handed exactly
// the numbers that kind is described by — there is no field on either that
// belongs to the other shape.
export type ArcMark = ArcBar | ArcDome

// One arc, already projected. The bp→x step is the caller's because the two
// callers resolve it differently and cannot share a `(bp) => x`: a per-region
// pass maps both feet through the block it is drawing, while the cross-region
// overlay resolves each foot through ITS OWN displayed region — which is the
// whole difference between the two and the reason `CrossRegionArc` exists.
//
// Everything below this point is identical for both, which is the point of
// splitting it out: the overlay's arc is the same shape the GPU would have
// drawn, not a second approximation of it.
export interface ProjectedArc {
  sx1: number
  sx2: number
  yBp: number
  shapeType: number
}

export function arcMark(
  data: ArcsUploadData,
  i: number,
  frame: ArcBandFrame,
): ArcMark {
  return arcMarkFrom(
    {
      sx1: frame.bpToScreenX(data.arcX1[i]!),
      sx2: frame.bpToScreenX(data.arcX2[i]!),
      yBp: data.arcYBp[i]!,
      shapeType: data.arcShapeTypes[i]!,
    },
    frame,
  )
}

export function arcMarkFrom(
  { sx1, sx2, yBp, shapeType }: ProjectedArc,
  frame: Omit<ArcBandFrame, 'bpToScreenX'>,
): ArcMark {
  const {
    arcsYDomainBp,
    arcsYLog,
    arcsTop,
    arcsH,
    pairedArcsDown,
    screenWidthPx,
  } = frame
  const mid = (sx1 + sx2) / 2
  const anchorY = arcAnchorY(arcsTop, arcsH, pairedArcsDown)
  const destY = arcYOffsetPx(yBp, arcsYDomainBp, arcsYLog, arcAvailH(arcsH))
  // One Y rule for both kinds — the split above is the shape, not the height.
  if (isFlatArcShape(shapeType)) {
    return {
      kind: 'bar',
      mid,
      destY,
      sx1,
      sx2,
      halfPx: Math.max(Math.abs(sx2 - sx1), ARC_FLAT_MIN_PX) / 2,
      markY: arcMarkY(anchorY, destY, pairedArcsDown),
    }
  }
  const [rx, ry] = arcRadiiPx(Math.abs(sx2 - sx1) / 2, destY, screenWidthPx)
  return {
    kind: 'dome',
    mid,
    destY,
    anchorY,
    rx,
    ry,
    down: pairedArcsDown,
    far: rx === ry,
  }
}
