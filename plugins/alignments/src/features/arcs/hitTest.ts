// Which arc, if any, the cursor is on. The counterpart to `drawArcs` — every
// screen-space step below is the same one `drawArcsToCtx` takes, off the same
// generated helpers, because a hit test that re-derives the geometry is a second
// placement of the arcs that can disagree with the drawn one.
import { distToWideCirclePx } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { arcRadiiPx } from '../../shaders/slang/arc.js.generated.ts'
import { ARC_FLAT_MIN_PX } from '../../shaders/slang/arcFlat.iface.generated.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { arcAvailH, arcYOffsetPx } from './arcYScale.ts'
import { isFlatArcShape } from './compute.ts'
import { ellipseDistance } from './ellipseDistance.ts'

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
  const {
    bpToScreenX,
    arcsYDomainBp,
    arcsYLog,
    arcsTop,
    arcsH,
    pairedArcsDown,
    lineWidth,
    screenWidthPx,
  } = opts
  // The band's own gate, so this is correct called on a bare canvas Y rather
  // than only from a caller that already narrowed to the band. Widened by the
  // largest slop any arc here could claim, so the cheap reject can't cut off an
  // arc whose stroke legitimately reaches the cursor.
  const maxTol = ARC_HIT_SLOP_PX + arcLineWidth(maxSupport(data), lineWidth) / 2
  if (canvasY < arcsTop - maxTol || canvasY > arcsTop + arcsH + maxTol) {
    return undefined
  }

  const anchorY = pairedArcsDown ? arcsTop : arcsTop + arcsH
  const availH = arcAvailH(arcsH)
  // Drawn-side-positive local Y: an up-pointing band measures upward from the
  // anchor, a down-pointing one downward, and every test below is written once
  // against that single frame instead of twice against the two directions.
  const localY = (canvasY - anchorY) * (pairedArcsDown ? 1 : -1)

  let best: ArcHitResult | undefined
  let bestDist = Number.POSITIVE_INFINITY
  for (let i = 0; i < data.numArcs; i++) {
    const support = data.arcSupport[i]!
    const tol = arcLineWidth(support, lineWidth) / 2 + ARC_HIT_SLOP_PX
    // Nothing is drawn on the far side of the anchor line, and the stroke does
    // not cross it either: at the feet the tangent is vertical, so the stroke
    // there runs horizontally, out to the sides rather than down. Without this
    // the mirrored half of the conic answers hovers over blank band.
    if (localY < -tol) {
      continue
    }
    const sx1 = bpToScreenX(data.arcX1[i]!)
    const sx2 = bpToScreenX(data.arcX2[i]!)
    const arcH = arcYOffsetPx(data.arcYBp[i]!, arcsYDomainBp, arcsYLog, availH)
    const dist = isFlatArcShape(data.arcShapeTypes[i]!)
      ? flatDistance(canvasX, localY, sx1, sx2, arcH)
      : curveDistance(canvasX, localY, sx1, sx2, arcH, screenWidthPx)
    // `<=` so a later arc wins a tie, which is "last drawn is the one under the
    // cursor" — the same rule hitTestFeature and hitTestChain settle ties with,
    // and here the arcs are painted in this array's order.
    if (dist <= tol && dist <= bestDist) {
      bestDist = dist
      best = {
        index: i,
        x1: data.arcX1[i]!,
        x2: data.arcX2[i]!,
        support,
        colorType: data.arcColorTypes[i]!,
        shapeType: data.arcShapeTypes[i]!,
        yBp: data.arcYBp[i]!,
      }
    }
  }
  return best
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

function maxSupport(data: ArcsUploadData) {
  let max = 1
  for (let i = 0; i < data.numArcs; i++) {
    if (data.arcSupport[i]! > max) {
      max = data.arcSupport[i]!
    }
  }
  return max
}
