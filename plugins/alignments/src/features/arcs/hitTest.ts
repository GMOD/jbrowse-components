// What the cursor is on in the arc band. The counterpart to `drawArcs`: it takes
// its geometry from `arcMark`, the same call the draw makes, because a hit test
// that re-derives it is a second placement of the arcs — free to disagree with
// the drawn one, and it has, twice.
//
// The band paints TWO families of mark and this answers for both. It used to
// answer only for the arcs, which is the "layer with no hit test at all" gap
// this display's CLAUDE.md names: an interchromosomal tick is ink, drawn in the
// same rect, and hovering it reported nothing at all — so the one mark whose
// meaning is least guessable from its shape was the one you could not ask.
import { distToWideCirclePx } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { ARC_FLAT_MIN_PX } from '../../shaders/slang/arcFlat.iface.generated.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { arcAnchorY } from './arcYScale.ts'
import { ellipseDistance } from './ellipseDistance.ts'
import { arcMark } from './mark.ts'

import type { ArcBandFrame, ArcMark } from './mark.ts'
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
 * ON THE INK (`outside <= 0`) — the cursor is literally over this mark, so the
 * answer is whichever mark is painted ON TOP at that pixel, the strokes being
 * opaque. Both feeds arrive in paint order and both scans run ascending, so
 * that is simply the LAST on-ink candidate considered. Ranking these on
 * distance to the centre line, as this once did, reported whichever hairline
 * the cursor was nearest and threw away the target the per-mark tolerance had
 * just widened.
 *
 * Reading the paint order off the feed rather than re-deriving it is the point:
 * it used to rank on support, which was equivalent only while support WAS the
 * sort key. `resolveArcs` now sorts the arcs by category first, so a lone
 * discordant arc paints over a heavily-supported concordant one and a
 * support-ranked hover would have named the grey arc underneath — the exact
 * drift this comment previously claimed could not happen.
 *
 * NEAR THE INK — reached only through `ARC_HIT_SLOP_PX`, so the cursor is over
 * blank band and the answer is a best guess. Nearest wins, measured from each
 * mark's own ink rather than its centre so a fat mark is not beaten by a
 * hairline it is visibly wider than. Consulted only when nothing is on ink, and
 * `<=` so a tie again resolves to the later-painted one.
 *
 * Shared because the arcs and the ticks were two spellings of it, each with the
 * same locals and the same tie-breaks, under comments on the tick side saying
 * it was the "same two-bucket ranking as the arcs". Two instances of one rule
 * is a missing function — the argument `mark.ts` makes for the geometry,
 * applied to the ranking. One object per scan (two per mousemove); the per-mark
 * loops it serves still only write numbers.
 */
function bestMark() {
  let onInk = -1
  let nearest = -1
  let nearestOutside = Number.POSITIVE_INFINITY
  return {
    consider(index: number, outside: number) {
      if (outside > ARC_HIT_SLOP_PX) {
        return
      }
      if (outside <= 0) {
        onInk = index
      } else if (outside <= nearestOutside) {
        nearest = index
        nearestOutside = outside
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

// The band frame every mark is resolved into, plus the one thing only the hit
// test spends: the configured stroke width, which is how wide the target is. It
// was a second declaration of the same seven fields, which is what let the frame
// grow `screenWidthPx` on one side and not the other — the bug the field's own
// comment in `mark.ts` describes.
export interface ArcHitOptions extends ArcBandFrame {
  lineWidth: number
}

/**
 * What the cursor is on in one section's arc band — a curved or flat arc, an
 * interchromosomal tick, or nothing.
 *
 * The single entry point on purpose. Both families are drawn into one rect and
 * overlap freely, so "which one answers" is a question about PAINT ORDER, and
 * the answer belongs here rather than at each call site: `drawArcsPass` runs
 * line → arc → flat → marker, and `drawArcs` strokes the ticks then the arcs,
 * so an arc is always the later ink.
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
// mark, and a mark it is merely NEAR is a guess. Within that, the ARC wins,
// because the tick pass now paints first (see `ARC_PASSES`) and naming the mark
// underneath would describe a colour the reader cannot see. Only when neither is
// on ink does distance decide, and a tie there goes to the arc for the same
// reason.
//
// This whole function inverts with the pass order and must: it is the one place
// that reads paint order as an answer, which is why the ordering is stated in
// `ARC_PASSES` and consumed here rather than being asserted twice.
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
    return arc.hit
  }
  return arc.outside <= tick.outside ? arc.hit : tick.hit
}

// The ticks: full-band verticals, so the distance is purely horizontal and the
// band gate above has already settled Y. `bestMark` is the ranking, shared with
// the arcs — `resolveArcs` leaves the tick feed in paint order too, so scanning
// it ascending puts the last-drawn tick last here as well.
function tickCandidate(
  canvasX: number,
  data: ArcsUploadData,
  opts: ArcHitOptions,
): Candidate<ArcLineHitResult> | undefined {
  const { bpToScreenX, lineWidth } = opts
  const picker = bestMark()
  for (let i = 0; i < data.numArcLines; i++) {
    const halfWidth = arcLineWidth(data.arcLineSupport[i]!, lineWidth) / 2
    picker.consider(
      i,
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
  // The projection, the Y scale and the near/far branch are read by `arcMark`,
  // not here — this needs only the band rect, the direction and the stroke width.
  const { arcsTop, arcsH, pairedArcsDown, lineWidth } = opts
  const anchorY = arcAnchorY(arcsTop, arcsH, pairedArcsDown)
  // Drawn-side-positive local Y: an up-pointing band measures upward from the
  // anchor, a down-pointing one downward, and every test below is written once
  // against that single frame instead of twice against the two directions.
  const localY = (canvasY - anchorY) * (pairedArcsDown ? 1 : -1)

  // `bestMark` is the two-bucket ranking — see it for why on-ink is settled by
  // paint order and near-ink by distance. What is local to the arcs is the
  // DISTANCE fed to it, which needs a mark per arc where a tick needs one
  // subtract.
  const picker = bestMark()
  for (let i = 0; i < data.numArcs; i++) {
    const halfWidth = arcLineWidth(data.arcSupport[i]!, lineWidth) / 2
    if (!nearArcColumns(canvasX, data, i, opts, halfWidth)) {
      continue
    }
    // How far past this arc's own ink the cursor is: the quantity that both
    // gates the hit and sorts the two buckets.
    picker.consider(
      i,
      markDistance(canvasX, localY, arcMark(data, i, opts)) - halfWidth,
    )
  }
  const found = picker.best()
  return found === undefined
    ? undefined
    : { hit: arcHitAt(data, found.index), outside: found.outside }
}

// Whether arc `i` can possibly have ink in the cursor's COLUMN — the cheap
// rejection that keeps the scan from solving a quartic per arc. The read cloud
// emits thousands of arcs into one band and this runs on every hover frame, so
// what it skips is the whole of `arcMark` + `ellipseDistance` for every arc
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

// Distance from the cursor to one arc's own ink, in the drawn-side-positive
// frame `localY` is measured in — so an up band and a down band are one case
// here, and which conic (or bar) this arc is has already been decided by
// `arcMark` rather than being this file's to remember.
function markDistance(canvasX: number, localY: number, mark: ArcMark) {
  // The read cloud's flat connector: a horizontal segment at the arc's Y, at the
  // extent `arcMark` widened it to — so a sub-minimum pair is hoverable across
  // the whole bar it paints rather than only over its two real endpoints.
  if (mark.kind === 'bar') {
    return Math.hypot(
      Math.max(Math.abs(canvasX - mark.mid) - mark.halfPx, 0),
      localY - mark.destY,
    )
  }
  const { mid, rx, ry, far } = mark
  // The far branch is numerical, not cosmetic. A far pair's radius reaches
  // millions of px, where `length(p - c) - r` — which is what the ellipse
  // solver's own circle short-circuit computes — cancels away every significant
  // digit. `distToWideCirclePx` assembles the same quantity from small terms,
  // measured from the leg's own endpoint, which on this branch is `mid ± rx`
  // (the radius IS the pair's half-span there).
  if (far) {
    const right = canvasX >= mid
    // x positive pointing AWAY from the circle, which is outward from whichever
    // leg the cursor is on.
    const legX = right ? canvasX - (mid + rx) : mid - rx - canvasX
    return distToWideCirclePx(legX, localY, rx)
  }
  return ellipseDistance(canvasX - mid, localY, rx, ry)
}
