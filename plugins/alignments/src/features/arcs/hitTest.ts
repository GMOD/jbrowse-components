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

export interface ArcHit {
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

export interface ArcHitResult extends ArcHit {
  // The arcs the cursor is on BESIDES this one, heaviest first.
  //
  // Two arcs can be separated by less than a pixel — the HG002 chr12 fold-back
  // has junctions 689 bp apart, which is sub-pixel at any zoom that shows the
  // whole event — and `arcKey` folds only exact repeats, so two connections
  // between the same pair of breakpoints that classify into different colors
  // stay two arcs drawn on the same curve. There is no ranking rule that can
  // pick between those, because there is nothing to pick with: the cursor
  // really is on all of them. Naming the winner alone is then a guess presented
  // as a fact, which is how a hover reads "supported by 1 read" over a spot the
  // user is holding the mouse on because it looked heavy.
  //
  // So the hover reports them. Empty in the ordinary case of one arc under the
  // cursor, and empty for a near-miss — if the cursor is on no ink at all the
  // answer is already a best guess and a list of things it is also not on adds
  // nothing.
  coincident: ArcHit[]
}

function arcHitAt(data: ArcsUploadData, i: number): ArcHit {
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
  const availH = arcAvailH(arcsH)
  // Drawn-side-positive local Y: an up-pointing band measures upward from the
  // anchor, a down-pointing one downward, and every test below is written once
  // against that single frame instead of twice against the two directions.
  const localY = (canvasY - anchorY) * (pairedArcsDown ? 1 : -1)

  // The candidates split in two, because the two are answered differently.
  //
  // ON THE INK (`outside <= 0`): every one of these is an arc the cursor is
  // literally over. Stroke width IS support (`arcLineWidth` — a 10-read arc
  // paints roughly three times the ink of a singleton), so ranking these on
  // distance to the centre line, as this used to, reported whichever hairline
  // the cursor was nearest and threw away the target the per-arc tolerance had
  // just widened. They are ranked by support instead, and the losers are
  // reported rather than discarded (see `coincident`).
  //
  // NEAR THE INK: reached only through the slop, so the cursor is over blank
  // band and the answer is a best guess. Nearest wins, measured from each arc's
  // own ink rather than its centre so a fat arc is not beaten by a hairline it
  // is visibly wider than. Consulted only when nothing was hit.
  //
  // Indices rather than objects: this runs per mousemove over the whole feed.
  const onInk: number[] = []
  let nearest = -1
  let nearestOutside = Number.POSITIVE_INFINITY
  let nearestSupport = 0

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
    const sx1 = bpToScreenX(data.arcX1[i]!)
    const sx2 = bpToScreenX(data.arcX2[i]!)
    const arcH = arcYOffsetPx(data.arcYBp[i]!, arcsYDomainBp, arcsYLog, availH)
    const dist = isFlatArcShape(data.arcShapeTypes[i]!)
      ? flatDistance(canvasX, localY, sx1, sx2, arcH)
      : curveDistance(canvasX, localY, sx1, sx2, arcH, screenWidthPx)
    // How far past this arc's own ink the cursor is: the quantity that both
    // gates the hit and sorts the two buckets above.
    const outside = dist - halfWidth
    if (outside > ARC_HIT_SLOP_PX) {
      continue
    }
    if (outside <= 0) {
      onInk.push(i)
    } else if (
      outside < nearestOutside ||
      // `>=` keeps the old tie rule: candidates that rank equal resolve to the
      // last drawn, which is the one painted over the other. Scanning
      // ascending, that is the later index.
      (outside === nearestOutside && support >= nearestSupport)
    ) {
      nearest = i
      nearestOutside = outside
      nearestSupport = support
    }
  }

  if (onInk.length === 0) {
    return nearest === -1
      ? undefined
      : { ...arcHitAt(data, nearest), coincident: [] }
  }
  // Heaviest first — the arc `resolveArcs` ordered last and the painter drew on
  // top, so the hit test and the picture name the same arc as the visible one.
  // Equal support falls back to the later index, which is that same rule.
  onInk.sort((a, b) => data.arcSupport[b]! - data.arcSupport[a]! || b - a)
  return {
    ...arcHitAt(data, onInk[0]!),
    coincident: onInk.slice(1).map(i => arcHitAt(data, i)),
  }
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
