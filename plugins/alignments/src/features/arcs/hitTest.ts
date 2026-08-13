// What the cursor is on in the arc band. The counterpart to `drawArcs`: it takes
// its geometry from `arcPlacement`, the same call the draw makes, because a hit
// test that re-derives it is a second placement of the arcs — free to disagree
// with the drawn one, and it has, twice.
//
// The band paints TWO families of mark and this answers for both. It used to
// answer only for the arcs, which is the "layer with no hit test at all" gap
// this display's CLAUDE.md names: an interchromosomal tick is ink, drawn in the
// same rect, and hovering it reported nothing at all — so the one mark whose
// meaning is least guessable from its shape was the one you could not ask.
import { distToWideCirclePx } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { arcRadiiPx } from '../../shaders/slang/arc.js.generated.ts'
import { ARC_FLAT_MIN_PX } from '../../shaders/slang/arcFlat.iface.generated.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { arcAnchorY } from './arcYScale.ts'
import { ellipseDistance } from './ellipseDistance.ts'
import { arcPlacement, flatBarExtent } from './placement.ts'

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
  // Which family of mark. A discriminant rather than two sibling entry points,
  // because the caller's question is "what is under the cursor" and the band
  // draws both — asking the two separately puts the priority rule (below) at
  // every call site instead of in the one place that knows the paint order.
  kind: 'arc'
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
  // Where the arc plots, jitter included. The drawn position — measure against
  // it, don't report it.
  yBp: number
  // What that position means: |TLEN| for a read-cloud mate link, the breakpoint
  // gap for a split junction, the genomic radius for a curve. The number a
  // tooltip may show.
  spanBp: number
}

// An interchromosomal connector tick: a full-band vertical at one breakpoint.
export interface ArcLineHitResult {
  kind: 'tick'
  // Index into the `arcLine*` parallel arrays.
  index: number
  // The breakpoint, in absolute genomic bp.
  bp: number
  // Reads through it — the number its stroke width encodes since `resolveArcs`
  // began coalescing ticks, exactly as `ArcHitResult.support` does for an arc.
  support: number
  // The chromosome(s) on the far side, sorted. The reason this hover is worth
  // more than the arc one: a tick's own geometry says where the breakpoint is
  // and gives no hint at all of what it reaches.
  partnerRefNames: string[]
}

// Everything the arc band can answer a hover with.
export type ArcBandHitResult = ArcHitResult | ArcLineHitResult

// One family's best answer, with how far outside its ink the cursor is — the
// quantity `pickBetween` needs and the only reason this is not just the hit.
interface Candidate<T> {
  hit: T
  outside: number
}

/**
 * The ranking WITHIN one family, which both families use.
 *
 * Two buckets, and the split is the decision:
 *
 * ON THE INK (`outside <= 0`) — the cursor is literally over this mark. Stroke
 * width IS support (`arcLineWidth`: a 10-read mark paints roughly three times
 * the ink of a singleton), so ranking these on distance to the centre line, as
 * this used to, reported whichever hairline the cursor was nearest and threw
 * away the target the per-mark tolerance had just widened. Heaviest wins
 * instead, which is also the mark painted on top — `resolveArcs` orders both
 * feeds by support — so the hover and the picture name the same one.
 *
 * NEAR THE INK — reached only through `ARC_HIT_SLOP_PX`, so the cursor is over
 * blank band and the answer is a best guess. Nearest wins, measured from each
 * mark's own ink rather than its centre so a fat mark is not beaten by a
 * hairline it is visibly wider than. Consulted only when nothing is on ink.
 *
 * `>=` on both supports, so equal candidates resolve to the LAST considered —
 * the one painted over the other, both scans running ascending.
 *
 * Shared because the arcs and the ticks were two spellings of it, each with the
 * same five locals and the same tie-breaks, under comments on the tick side
 * saying it was the "same two-bucket ranking as the arcs". Two instances of one
 * rule is a missing function — the argument `placement.ts` makes for the
 * geometry, applied to the ranking. One object per scan (two per mousemove);
 * the per-mark loops it serves still only write numbers.
 */
function bestMark() {
  let onInk = -1
  let onInkSupport = -1
  let nearest = -1
  let nearestOutside = Number.POSITIVE_INFINITY
  let nearestSupport = -1
  return {
    consider(index: number, support: number, outside: number) {
      if (outside > ARC_HIT_SLOP_PX) {
        return
      }
      if (outside <= 0) {
        if (support >= onInkSupport) {
          onInk = index
          onInkSupport = support
        }
      } else if (
        outside < nearestOutside ||
        (outside === nearestOutside && support >= nearestSupport)
      ) {
        nearest = index
        nearestOutside = outside
        nearestSupport = support
      }
    },
    // `outside` 0 for an on-ink winner: `pickBetween` reads it as the on-ink
    // flag, so it must not carry the negative depth into the stroke.
    best() {
      return onInk !== -1
        ? { index: onInk, outside: 0 }
        : nearest === -1
          ? undefined
          : { index: nearest, outside: nearestOutside }
    },
  }
}

function arcHitAt(data: ArcsUploadData, i: number): ArcHitResult {
  return {
    kind: 'arc',
    index: i,
    x1: data.arcX1[i]!,
    x2: data.arcX2[i]!,
    support: data.arcSupport[i]!,
    colorType: data.arcColorTypes[i]!,
    shapeType: data.arcShapeTypes[i]!,
    yBp: data.arcYBp[i]!,
    spanBp: data.arcSpanBp[i]!,
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

/**
 * What the cursor is on in one section's arc band — a curved or flat arc, an
 * interchromosomal tick, or nothing.
 *
 * The single entry point on purpose. Both families are drawn into one rect and
 * overlap freely, so "which one answers" is a question about PAINT ORDER, and
 * the answer belongs here rather than at each call site: `drawArcsPass` runs
 * arc → flat → marker → line, and `drawArcs` strokes the arcs then the ticks,
 * so a tick is always the later ink.
 */
export function hitTestArcBand(
  canvasX: number,
  canvasY: number,
  data: ArcsUploadData,
  opts: ArcHitOptions,
): ArcBandHitResult | undefined {
  const { arcsTop, arcsH } = opts
  // The band's own gate, and it is EXACT rather than widened by the slop below:
  // both renderers clip the arc pass to this rect, so there is no arc ink
  // outside it to be near. Widening it would let a foot at the band edge answer
  // hovers a few px into whatever is stacked next to the band — the coverage
  // histogram above, the sashimi strip or the pileup below — which is the
  // "layer with no matching hit gate" trap in this display's CLAUDE.md, just
  // pointed outward instead of inward. Inside the band the per-mark slop
  // applies in full.
  if (canvasY < arcsTop || canvasY > arcsTop + arcsH) {
    return undefined
  }
  return pickBetween(
    arcCandidate(canvasX, canvasY, data, opts),
    tickCandidate(canvasX, data, opts),
  )
}

// The two families' winners, resolved by the rule the picture already states.
//
// ON THE INK beats near it, whichever family: the cursor is literally over that
// mark, and a mark it is merely NEAR is a guess. Within that, the tick wins,
// because it is painted over the arcs and naming the one underneath would
// describe a colour the reader cannot see. Only when neither is on ink does
// distance decide, and a tie there goes to the tick for the same reason.
function pickBetween(
  arc: Candidate<ArcHitResult> | undefined,
  tick: Candidate<ArcLineHitResult> | undefined,
): ArcBandHitResult | undefined {
  if (!arc) {
    return tick?.hit
  }
  if (!tick) {
    return arc.hit
  }
  const arcOnInk = arc.outside <= 0
  const tickOnInk = tick.outside <= 0
  if (arcOnInk !== tickOnInk) {
    return arcOnInk ? arc.hit : tick.hit
  }
  if (arcOnInk) {
    return tick.hit
  }
  return arc.outside < tick.outside ? arc.hit : tick.hit
}

// The ticks: full-band verticals, so the distance is purely horizontal and the
// band gate above has already settled Y. `bestMark` is the ranking, shared with
// the arcs — `resolveArcs` orders the tick feed by support too, so heaviest and
// last-drawn are the same tick here as well.
function tickCandidate(
  canvasX: number,
  data: ArcsUploadData,
  opts: ArcHitOptions,
): Candidate<ArcLineHitResult> | undefined {
  const { bpToScreenX, lineWidth } = opts
  const picker = bestMark()
  for (let i = 0; i < data.numArcLines; i++) {
    const support = data.arcLineSupport[i]!
    const halfWidth = arcLineWidth(support, lineWidth) / 2
    picker.consider(
      i,
      support,
      Math.abs(canvasX - bpToScreenX(data.arcLinePositions[i]!)) - halfWidth,
    )
  }
  const found = picker.best()
  return found === undefined
    ? undefined
    : {
        hit: {
          kind: 'tick',
          index: found.index,
          bp: data.arcLinePositions[found.index]!,
          support: data.arcLineSupport[found.index]!,
          partnerRefNames: data.arcLinePartnerRefNames[found.index] ?? [],
        },
        outside: found.outside,
      }
}

function arcCandidate(
  canvasX: number,
  canvasY: number,
  data: ArcsUploadData,
  opts: ArcHitOptions,
): Candidate<ArcHitResult> | undefined {
  // The projection and the Y scale are read by `arcPlacement`, not here — this
  // needs only the band rect, the direction, and the two widths.
  const { arcsTop, arcsH, pairedArcsDown, lineWidth, screenWidthPx } = opts
  const anchorY = arcAnchorY(arcsTop, arcsH, pairedArcsDown)
  // Drawn-side-positive local Y: an up-pointing band measures upward from the
  // anchor, a down-pointing one downward, and every test below is written once
  // against that single frame instead of twice against the two directions.
  const localY = (canvasY - anchorY) * (pairedArcsDown ? 1 : -1)

  // `bestMark` is the two-bucket ranking — see it for why on-ink is settled by
  // support and near-ink by distance. What is local to the arcs is the DISTANCE
  // fed to it, which needs a placement per arc where a tick needs one subtract.
  const picker = bestMark()
  for (let i = 0; i < data.numArcs; i++) {
    const support = data.arcSupport[i]!
    const halfWidth = arcLineWidth(support, lineWidth) / 2
    if (!nearArcColumns(canvasX, data, i, opts, halfWidth)) {
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
    // gates the hit and sorts the two buckets.
    picker.consider(i, support, dist - halfWidth)
  }
  const found = picker.best()
  return found === undefined
    ? undefined
    : { hit: arcHitAt(data, found.index), outside: found.outside }
}

// Whether arc `i` can possibly have ink in the cursor's COLUMN — the cheap
// rejection that keeps the scan from solving a quartic per arc. The read cloud
// emits thousands of arcs into one band and this runs on every hover frame, so
// what it skips is the whole of `arcPlacement` + `ellipseDistance` for every arc
// the cursor is nowhere near.
//
// Horizontal because that is the only bound available without placing the arc,
// and it holds for all three mark kinds: a dome and a far pair's circle are both
// centred on the midpoint with `rx` = the pair's own half-span (`arcRadiiPx`
// returns nothing wider), so neither reaches past its own endpoints, and a flat
// bar reaches past them only by the `ARC_FLAT_MIN_PX` widening. Deliberately
// over-inclusive — the pad is the widest case for every arc — because a
// prefilter that is merely conservative costs a few extra solves, while one that
// is tight is a second placement free to disagree with the real one.
//
// It replaces a guard that tested `localY` against the anchor, which read as
// rejecting the mirrored half of the conic and in fact rejected nothing:
// `hitTestArcBand` has already confined `canvasY` to the band, and the anchor is
// one of the band's two edges, so `localY` is in `[0, arcsH]` by then. It cost
// the scan nothing and saved it nothing.
function nearArcColumns(
  canvasX: number,
  data: ArcsUploadData,
  i: number,
  { bpToScreenX }: ArcHitOptions,
  strokeHalfWidth: number,
) {
  const sx1 = bpToScreenX(data.arcX1[i]!)
  const sx2 = bpToScreenX(data.arcX2[i]!)
  const pad = strokeHalfWidth + ARC_HIT_SLOP_PX + ARC_FLAT_MIN_PX / 2
  return (
    canvasX >= Math.min(sx1, sx2) - pad && canvasX <= Math.max(sx1, sx2) + pad
  )
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
  const { mid, halfPx } = flatBarExtent(sx1, sx2)
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
  // The pair's half SPAN, not the stroke's half width the caller measures
  // against — `arcRadiiPx`'s first argument, and the dome's `rx`.
  const halfSpanPx = Math.abs(sx2 - sx1) / 2
  const [rx, ry] = arcRadiiPx(halfSpanPx, arcH, screenWidthPx)
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
