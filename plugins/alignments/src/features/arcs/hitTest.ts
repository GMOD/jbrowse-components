// Which arc, if any, the cursor is on. The counterpart to `drawArcs`: it takes
// its geometry from `arcPlacement`, the same call the draw makes, because a hit
// test that re-derives it is a second placement of the arcs — free to disagree
// with the drawn one, and it has, twice.
import { distToWideCirclePx } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { arcRadiiPx } from '../../shaders/slang/arc.js.generated.ts'
import { ARC_FLAT_MIN_PX } from '../../shaders/slang/arcFlat.iface.generated.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { ellipseDistance } from './ellipseDistance.ts'
import { arcPlacement } from './placement.ts'

import type { ArcsUploadData } from './types.ts'

// How far outside its own stroke an arc still answers a hover, in CSS px.
//
// An arc is ink one to a few px wide over a band tens of px tall, so requiring
// the cursor to be within the stroke itself makes the target a hairline and the
// tooltip a thing you fish for. The slop is added to the arc's own half-width,
// so a heavily-supported (thicker) arc grows its target the way it grows its
// ink, rather than every arc getting one fixed-size hitbox.
export const ARC_HIT_SLOP_PX = 3

export interface ArcHitResult {
  // Index into the ArcsUploadData parallel arrays, so a caller can reach any
  // channel this result does not name.
  index: number
  // The two endpoints, in absolute genomic bp — the worker's own coordinates.
  x1: number
  x2: number
  // How many identical connections `resolveArcs` folded into this arc. The whole
  // reason a hover on an arc has something to say: the picture ranks junctions
  // by stroke width, and this is the number behind that width.
  support: number
  colorType: number
  shapeType: number
  yBp: number
}

function arcHitAt(data: ArcsUploadData, i: number): ArcHitResult {
  return {
    index: i,
    x1: data.arcX1[i]!,
    x2: data.arcX2[i]!,
    support: data.arcSupport[i]!,
    colorType: data.arcColorTypes[i]!,
    shapeType: data.arcShapeTypes[i]!,
    yBp: data.arcYBp[i]!,
  }
}

export interface ArcHitOptions {
  bpToScreenX: (bp: number) => number
  arcsYDomainBp: number
  arcsYLog: boolean
  arcsTop: number
  arcsH: number
  pairedArcsDown: boolean
  lineWidth: number
  screenWidthPx: number
}

export function hitTestArcs(
  canvasX: number,
  canvasY: number,
  data: ArcsUploadData,
  opts: ArcHitOptions,
): ArcHitResult | undefined {
  // The projection and the Y scale are read by `arcPlacement`, not here — this
  // needs only the band rect, the direction, and the two widths.
  const { arcsTop, arcsH, pairedArcsDown, lineWidth, screenWidthPx } = opts
  // The band's own gate, and it is EXACT rather than widened by the slop below:
  // both renderers clip the arc pass to this rect, so there is no arc ink
  // outside it to be near. Widening it would let a foot at the band edge answer
  // hovers a few px into whatever is stacked next to the band — the coverage
  // histogram above, the sashimi strip or the pileup below — which is the
  // "layer with no matching hit gate" trap in this display's CLAUDE.md, just
  // pointed outward instead of inward. Inside the band the per-arc slop applies
  // in full.
  if (canvasY < arcsTop || canvasY > arcsTop + arcsH) {
    return undefined
  }

  const anchorY = pairedArcsDown ? arcsTop : arcsTop + arcsH
  // Drawn-side-positive local Y: an up-pointing band measures upward from the
  // anchor, a down-pointing one downward, and every test below is written once
  // against that single frame instead of twice against the two directions.
  const localY = (canvasY - anchorY) * (pairedArcsDown ? 1 : -1)

  // The candidates split in two, because the two are answered differently.
  //
  // ON THE INK (`outside <= 0`): the cursor is literally over this arc. Stroke
  // width IS support (`arcLineWidth` — a 10-read arc paints roughly three times
  // the ink of a singleton), so ranking these on distance to the centre line, as
  // this used to, reported whichever hairline the cursor was nearest and threw
  // away the target the per-arc tolerance had just widened. Heaviest wins
  // instead, which is also the arc painted on top since `resolveArcs` orders the
  // feed by support — so the hover and the picture name the same one.
  //
  // NEAR THE INK: reached only through the slop, so the cursor is over blank
  // band and the answer is a best guess. Nearest wins, measured from each arc's
  // own ink rather than its centre so a fat arc is not beaten by a hairline it
  // is visibly wider than. Consulted only when the cursor is on nothing.
  //
  // Indices, not objects: this runs per mousemove over the whole feed.
  let onInk = -1
  let onInkSupport = -1
  let nearest = -1
  let nearestOutside = Number.POSITIVE_INFINITY
  let nearestSupport = -1

  for (let i = 0; i < data.numArcs; i++) {
    const support = data.arcSupport[i]!
    const halfWidth = arcLineWidth(support, lineWidth) / 2
    // Nothing is drawn on the far side of the anchor line, and the stroke does
    // not cross it either: at the feet the tangent is vertical, so the stroke
    // there runs horizontally, out to the sides rather than down. Without this
    // the mirrored half of the conic answers hovers over blank band.
    if (localY < -(halfWidth + ARC_HIT_SLOP_PX)) {
      continue
    }
    // `destY` is the apex height above the anchor on the drawn side, which is
    // the frame `localY` is in — so an up band and a down band are one case
    // here, and the flat/dome Y split is `arcPlacement`'s to make rather than
    // this file's to remember.
    const { sx1, sx2, destY, isFlat } = arcPlacement(data, i, opts)
    const dist = isFlat
      ? flatDistance(canvasX, localY, sx1, sx2, destY)
      : curveDistance(canvasX, localY, sx1, sx2, destY, screenWidthPx)
    // How far past this arc's own ink the cursor is: the quantity that both
    // gates the hit and sorts the two buckets above.
    const outside = dist - halfWidth
    if (outside > ARC_HIT_SLOP_PX) {
      continue
    }
    // `>=` on both, so equal candidates resolve to the LAST drawn — the one
    // painted over the other. Scanning ascending, that is the later index.
    if (outside <= 0) {
      if (support >= onInkSupport) {
        onInk = i
        onInkSupport = support
      }
    } else if (
      outside < nearestOutside ||
      (outside === nearestOutside && support >= nearestSupport)
    ) {
      nearest = i
      nearestOutside = outside
      nearestSupport = support
    }
  }

  const found = onInk === -1 ? nearest : onInk
  return found === -1 ? undefined : arcHitAt(data, found)
}

// The read cloud's flat connector: a horizontal segment at the arc's Y, widened
// about its midpoint to a minimum drawn length so short-insert pairs stay
// visible. Mirrors the flat branch of `drawArcsToCtx` — including that the
// minimum is applied to the DRAWN extent, so a sub-minimum pair is hoverable
// across the whole bar it paints rather than only over its two real endpoints.
function flatDistance(
  canvasX: number,
  localY: number,
  sx1: number,
  sx2: number,
  arcH: number,
) {
  const mid = (sx1 + sx2) / 2
  const halfPx = Math.max(Math.abs(sx2 - sx1), ARC_FLAT_MIN_PX) / 2
  return Math.hypot(
    Math.max(Math.abs(canvasX - mid) - halfPx, 0),
    localY - arcH,
  )
}

// The paired-read dome. `arcRadiiPx` is generated from arc.slang and is the one
// thing here that MUST match the shader: it decides which conic this is, and an
// ellipse and a circle are different marks.
function curveDistance(
  canvasX: number,
  localY: number,
  sx1: number,
  sx2: number,
  arcH: number,
  screenWidthPx: number,
) {
  const halfWidth = Math.abs(sx2 - sx1) / 2
  const [rx, ry] = arcRadiiPx(halfWidth, arcH, screenWidthPx)
  // `rx === ry` IS the far-pair branch — that is the only thing arcRadiiPx
  // returns an equal pair for, short of a near arc whose apex coincidentally
  // lands there, and a near arc that happens to be a circle is measured the same
  // way by both routines anyway. Reading the pair rather than re-asking
  // `arcIsFar` is deliberate: the predicate is `//! js-skip`ped precisely so a
  // consumer cannot ask it separately from the radii it decides.
  //
  // The split is numerical, not cosmetic. A far pair's radius reaches millions
  // of px, where `length(p - c) - r` — which is what the ellipse solver's own
  // circle short-circuit computes — cancels away every significant digit.
  // `distToWideCirclePx` assembles the same quantity from small terms, measured
  // from the leg's own endpoint.
  if (rx === ry) {
    const mid = (sx1 + sx2) / 2
    const near = canvasX >= mid ? Math.max(sx1, sx2) : Math.min(sx1, sx2)
    // x positive pointing AWAY from the circle, which is outward from whichever
    // leg the cursor is on.
    const legX = canvasX >= mid ? canvasX - near : near - canvasX
    return distToWideCirclePx(legX, localY, rx)
  }
  return ellipseDistance(canvasX - (sx1 + sx2) / 2, localY, rx, ry)
}
