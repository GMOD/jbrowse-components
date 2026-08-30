// What the cursor is on in the arc band. The counterpart to `drawArcs`: it takes
// its geometry from `arcMarkFrom`, which is what `arcMark` and the draw both
// resolve through, because a hit test that re-derives it is a second placement
// of the arcs — free to disagree with the drawn one, and it has, twice. It
// projects the two feet itself rather than going through `arcMark` only because
// it has already spent that projection rejecting arcs by column.
//
// The band paints TWO families of mark and this answers for both. It used to
// answer only for the arcs, which is the "layer with no hit test at all" gap
// this display's CLAUDE.md names: an interchromosomal tick is ink, drawn in the
// same rect, and hovering it reported nothing at all — so the one mark whose
// meaning is least guessable from its shape was the one you could not ask.
import { ARC_HIT_SLOP_PX, bestArcMark } from '@jbrowse/sv-core'

import { distToWideCirclePx } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { ARC_FLAT_MIN_PX } from '../../shaders/slang/arcFlat.consts.generated.ts'
import { ARC_WIDTH_MAX_SCALE, arcLineWidth } from './arcLineWidth.ts'
import { arcAnchorY } from './arcYScale.ts'
import { ellipseDistance } from './ellipseDistance.ts'
import { arcMarkFrom } from './mark.ts'

import type { ArcBandFrame, ArcMark } from './mark.ts'
import type { ArcsUploadData } from './types.ts'
import type { ArcCandidate } from '@jbrowse/sv-core'

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
  // What the arc's Y MEANS: |TLEN| for a read-cloud mate link, the breakpoint
  // gap for a split junction, the genomic radius for a curve. The number a
  // tooltip may show.
  //
  // The drawn position (`arcYBp`) is deliberately NOT here. It carries the read
  // cloud's ±8% jitter, so every consumer that reported it named a template
  // length no read has; it was carried for a while with a comment saying not to
  // report it, which is a field whose only use is the bug. Anything that really
  // wants the plotted position has `index` into the arrays.
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

// The ranking — `bestArcMark`, and see it for why on-ink is settled by paint
// order and near-ink by distance. It is `@jbrowse/sv-core`'s because
// `plugins/arc` ranks its own semicircles and beziers by the same rule and
// shares none of the geometry below: the arcs and the ticks here were already
// two spellings of it, and a third in another plugin is what drifts.

function arcHitAt(data: ArcsUploadData, i: number): ArcHitResult {
  return {
    kind: 'arc',
    index: i,
    x1: data.arcX1[i]!,
    x2: data.arcX2[i]!,
    support: data.arcSupport[i]!,
    colorType: data.arcColorTypes[i]!,
    shapeType: data.arcShapeTypes[i]!,
    spanBp: data.arcSpanBp[i]!,
  }
}

function arcLineHitAt(data: ArcsUploadData, i: number): ArcLineHitResult {
  return {
    kind: 'tick',
    index: i,
    bp: data.arcLinePositions[i]!,
    support: data.arcLineSupport[i]!,
    partnerRefNames: data.arcLinePartnerRefNames[i] ?? [],
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

// The two families' winners, resolved by the SAME rule `bestArcMark` applies
// within one: nearest ink wins, and the later-painted breaks the tie.
//
// Both halves fall out of that one comparison, because `bestArcMark` clamps an
// on-ink winner to 0. On the ink beats near it, whichever family — a mark the
// cursor is merely NEAR is a guess. Two on-ink marks both read 0, so the `<=`
// gives it to the ARC, which is the tick pass now painting first (see
// `ARC_PASSES`): naming the mark underneath would describe a colour the reader
// cannot see.
//
// This whole function inverts with the pass order and must: it is the one place
// that reads paint order as an answer, which is why the ordering is stated in
// `ARC_PASSES` and consumed here rather than being asserted twice.
function pickBetween(
  arc: ArcCandidate<ArcHitResult> | undefined,
  tick: ArcCandidate<ArcLineHitResult> | undefined,
): ArcBandHitResult | undefined {
  if (!arc) {
    return tick?.hit
  }
  if (!tick) {
    return arc.hit
  }
  return arc.outside <= tick.outside ? arc.hit : tick.hit
}

// The ticks: full-band verticals, so the distance is purely horizontal and the
// band gate above has already settled Y. `bestArcMark` is the ranking, shared with
// the arcs — `resolveArcs` leaves the tick feed in paint order too, so scanning
// it ascending puts the last-drawn tick last here as well.
function tickCandidate(
  canvasX: number,
  data: ArcsUploadData,
  opts: ArcHitOptions,
): ArcCandidate<ArcLineHitResult> | undefined {
  const { bpToScreenX, lineWidth } = opts
  const picker = bestArcMark()
  for (let i = 0; i < data.numArcLines; i++) {
    const halfWidth = arcLineWidth(data.arcLineSupport[i]!, lineWidth) / 2
    picker.consider(
      i,
      Math.abs(canvasX - bpToScreenX(data.arcLinePositions[i]!)) - halfWidth,
    )
  }
  return picker.best(i => arcLineHitAt(data, i))
}

function arcCandidate(
  canvasX: number,
  canvasY: number,
  data: ArcsUploadData,
  opts: ArcHitOptions,
): ArcCandidate<ArcHitResult> | undefined {
  // The Y scale and the near/far branch are read by `arcMarkFrom`, not here —
  // this needs the band rect, the direction, the projection and the width.
  const { arcsTop, arcsH, pairedArcsDown, lineWidth, bpToScreenX } = opts
  const anchorY = arcAnchorY(arcsTop, arcsH, pairedArcsDown)
  // Drawn-side-positive local Y: an up-pointing band measures upward from the
  // anchor, a down-pointing one downward, and every test below is written once
  // against that single frame instead of twice against the two directions.
  const localY = (canvasY - anchorY) * (pairedArcsDown ? 1 : -1)
  const pad = columnPad(lineWidth)

  // `bestArcMark` is the ranking — see it for why on-ink is settled by paint order
  // and near-ink by distance. What is local to the arcs is the DISTANCE fed to
  // it, which needs a mark per arc where a tick needs one subtract.
  const picker = bestArcMark()
  for (let i = 0; i < data.numArcs; i++) {
    // Projected ONCE, here, and handed to `arcMarkFrom` — `arcMark` would
    // re-run the same two `bpToScreenX` calls it takes to reject an arc.
    const sx1 = bpToScreenX(data.arcX1[i]!)
    const sx2 = bpToScreenX(data.arcX2[i]!)
    if (!nearArcColumns(canvasX, sx1, sx2, pad)) {
      continue
    }
    const mark = arcMarkFrom(
      {
        sx1,
        sx2,
        yBp: data.arcYBp[i]!,
        shapeType: data.arcShapeTypes[i]!,
      },
      opts,
    )
    // How far past this arc's own ink the cursor is: the quantity that both
    // gates the hit and ranks the survivors. `arcLineWidth` is a `log2` and is
    // spent only here, past the reject — the pad above is the widest case, so
    // the scan does not need each arc's own width to decide whether to skip it.
    picker.consider(
      i,
      markDistance(canvasX, localY, mark) -
        arcLineWidth(data.arcSupport[i]!, lineWidth) / 2,
    )
  }
  return picker.best(i => arcHitAt(data, i))
}

// How far outside its own two endpoints ANY arc can still answer, at this
// configured width — the widest case rather than each arc's own, so the reject
// below is one subtraction and the per-arc `arcLineWidth` is paid only by what
// survives it. `ARC_WIDTH_MAX_SCALE` is the ceiling `arcLineWidth` caps at.
function columnPad(lineWidth: number) {
  return (
    (lineWidth * ARC_WIDTH_MAX_SCALE) / 2 +
    ARC_HIT_SLOP_PX +
    ARC_FLAT_MIN_PX / 2
  )
}

// Whether an arc projected to `sx1`/`sx2` can possibly have ink in the cursor's
// COLUMN — the cheap rejection that keeps the scan from solving a quartic per
// arc. The read cloud emits thousands of arcs into one band and this runs on
// every hover frame, so what it skips is the whole of `arcMarkFrom` +
// `ellipseDistance` for every arc the cursor is nowhere near.
//
// Horizontal because that is the only bound available without placing the arc,
// and it holds for all three mark kinds: a dome and a far pair's circle are both
// centred on the midpoint with `rx` = the pair's own half-span (`arcRadiiPx`
// returns nothing wider), so neither reaches past its own endpoints, and a flat
// bar reaches past them only by the `ARC_FLAT_MIN_PX` widening. Deliberately
// over-inclusive because a prefilter that is merely conservative costs a few
// extra solves, while one that is tight is a second placement free to disagree
// with the real one.
//
// It replaces a guard that tested `localY` against the anchor, which read as
// rejecting the mirrored half of the conic and in fact rejected nothing:
// `hitTestArcBand` has already confined `canvasY` to the band, and the anchor is
// one of the band's two edges, so `localY` is in `[0, arcsH]` by then. It cost
// the scan nothing and saved it nothing.
function nearArcColumns(
  canvasX: number,
  sx1: number,
  sx2: number,
  pad: number,
) {
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
  const { mid, rx, ry, circular } = mark
  // The circle branch is numerical, not cosmetic. A far pair's radius reaches
  // millions of px, where `length(p - c) - r` — which is what the ellipse
  // solver's own circle short-circuit computes — cancels away every significant
  // digit. `distToWideCirclePx` assembles the same quantity from small terms,
  // measured from the leg's own endpoint, `mid ± rx`, which is where the mark's
  // two endpoints sit whichever branch of `arcRadiiPx` set the radii.
  if (circular) {
    const right = canvasX >= mid
    // x positive pointing AWAY from the circle, which is outward from whichever
    // leg the cursor is on.
    const legX = right ? canvasX - (mid + rx) : mid - rx - canvasX
    return distToWideCirclePx(legX, localY, rx)
  }
  return ellipseDistance(canvasX - mid, localY, rx, ry)
}
