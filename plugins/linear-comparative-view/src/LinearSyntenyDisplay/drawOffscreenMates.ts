import { alpha } from '@jbrowse/core/ui/palette'

import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// A MARK is one short tick at the top of the band, standing for an alignment
// the level cannot draw a ribbon for. The STRIP is the row of them across the
// query axis, which is the whole of what this file paints — marks, plus a
// contig name over each run of them. Same words the user guide uses.

// Tall enough to see against a scalebar, short enough that it visibly STOPS.
// The whole risk in drawing these is that a mark spanning the band reads as an
// alignment to the locus directly below it, which is the one thing they must
// not say — so a mark goes a fixed few pixels down whatever the band's height,
// and the gap under it is the message.
export const OFFSCREEN_MATE_HEIGHT_PX = 6

// A sub-pixel alignment still has to be a mark. The ribbons fade thin ones
// instead, but a mark carries no width information a reader could act on — it
// is a tick saying "something here goes elsewhere" — so it gets a floor.
export const MIN_OFFSCREEN_MATE_WIDTH_PX = 1.5

// At most a third of a short band, so a compact level does not turn into a
// solid bar with the ribbons hidden under it.
const MAX_BAND_FRACTION = 1 / 3

// Below this a label is a smudge, and the mark alone says "something here goes
// elsewhere" perfectly well. Measured against the drawn text, not guessed from
// the character count, since a scaffold name is not a fixed width.
const MIN_LABEL_PADDING_PX = 6

const LABEL_FONT = '10px sans-serif'

// The label sits BELOW the mark, over whatever the renderer drew — a ribbon, a
// pale fill, the empty band — so it is grey-on-anything and needs the halo the
// rest of the app's over-plot text uses.
const LABEL_HALO_PX = 3

// Clear of the mark and the ribbons, measured from whichever band edge the
// strip hangs off. Tight, because the band between two rows is the one place in
// this view with no vertical room to spare.
//
// TWO NUMBERS RATHER THAN ONE MIRRORED. The top strip's label sits BELOW its
// marks and the bottom strip's sits ABOVE them, so the second is the mark height
// plus its clearance from the edge, not `height - 16`.
const LABEL_BASELINE_PX = 16
const LABEL_BASELINE_FROM_BOTTOM_PX = 10

// Marks to one contig closer together than this many of its own names are one
// stretch as far as a label is concerned. MEASURED IN LABELS, NOT PIXELS: a
// break too small to hold a second name is not a break a reader can see, and a
// block of anchors spreads with the zoom, so a fixed 20px fragmented one block
// into fifteen unlabellable slivers at exactly the zoom where a reader asks
// what they are looking at.
const LABEL_MERGE_GAP_LABELS = 2

const LABEL_ROW_PX = 12

// How far a label reaches ABOVE its own baseline, which is what decides whether
// a row fits: a baseline is a bottom edge, so the row that has to clear the band
// edge and the marks is `y - this`. Approximated from the font size rather than
// measured, because `measureText` reports ascent per STRING and a row is
// reserved for whatever lands on it.
const LABEL_ASCENT_PX = 8

// The case this feature exists for is one query segment with SEVERAL
// counterparts — peach chr1 has about three grape chromosomes over each of its
// segments — so those stretches overlap in x by construction and one row of
// labels can only ever name one of them. Three rows names the paleohexaploid
// case; past that the band is a wall of grey text over the ribbons.
const MAX_LABEL_ROWS = 3

// The marks are the BACKGROUND and the labels are the finding, so the marks are
// washed out to roughly the weight of the ribbons they sit over. Alpha rather
// than a lighter grey, so the strip recedes into the band.
//
// Exported because a lane painting its marks by contig
// (`offscreenMateMarkColorFor`) has to reach the same weight through a different
// palette.
export const MARK_ALPHA = 0.35

// Constants, not theme values, because the band is opaque white whatever the
// page theme is — `Canvas2DSyntenyRenderer.clear` is why, and `MARKER_COLOR`
// makes the same choice for the location ticks.
//
// These two ARE MUI's own light-mode `text.secondary` and `background.paper`,
// which is what they were read from until a dark theme resolved the first to
// `rgba(255,255,255,0.7)`: the marks went to white at 0.35 alpha on white and
// vanished, and the labels to near-white text under a `#121212` halo. So
// nothing moves in the theme this was ever right in.
const MARK_INK = 'rgba(0, 0, 0, 0.6)'
const BAND_GROUND = '#fff'

// One source for both surfaces: the screen overlay and the SVG export run the
// same draw, and a figure whose marks are a different grey from the ones the
// user turned on is a difference nothing would report.
export function offscreenMateColors() {
  return {
    markColor: alpha(MARK_INK, MARK_ALPHA),
    // full strength, unlike the marks: the label is the actionable half, it is
    // haloed rather than tinted, and there is one of them per stretch
    labelColor: MARK_INK,
    // the band's own ground, so a label over a ribbon stays readable
    haloColor: BAND_GROUND,
  }
}

// Which band edge a strip hangs off — the top for marks on the query axis, the
// bottom for the target axis's. The two never overlap in y, which is what lets
// one hit test answer for both without deciding between them.
export type OffscreenMateSide = 'top' | 'bottom'

/**
 * A dataset the strip draws from.
 *
 * TWO KINDS, one shape. Without `mateAxis` every entry is a mark by
 * construction — the worker found no place on the facing axis for it at all.
 * With them the entry HAS a place, and whether it is a mark is a question about
 * where that place currently sits: see `culledRibbonMates`.
 */
export interface OffscreenMateDataset extends Omit<
  OffscreenMateData,
  'mateStarts' | 'mateEnds'
> {
  mateStarts: ArrayLike<number>
  mateEnds: ArrayLike<number>
  mateAxis?: MateAxisPlacement
}

/**
 * Where a dataset's entries sit on the FACING axis, in its cumBp.
 *
 * ONE OPTIONAL OBJECT rather than optional lanes beside optional bounds: the
 * four are present together or not at all, so narrowing on the object is what
 * lets every reader reach the extent without asserting a shape the type does
 * not carry.
 */
export interface MateAxisPlacement {
  starts: Float64Array
  ends: Float64Array
  // The extent over both lanes: a facing row whose band already spans it is
  // hiding none of these, and the whole dataset then leaves the lane unwalked.
  lo: number
  hi: number
}

// One strip's worth of input: what to mark and the ruler to mark it against.
// A band has at most two, and they are NOT interchangeable — see
// `offscreenMateStrips`, which is what builds them.
export interface OffscreenMateLane {
  // one per synteny display on the level, drawn and hit-tested as one strip:
  // they share a band, so labels that avoid each other within a display have to
  // avoid the neighbouring display's too
  datasets: OffscreenMateDataset[]
  // The facing axis's drawable span in ITS cumBp — the overdraw band
  // `isRibbonCulled` keeps a ribbon for, restated in bp so a mark and the
  // ribbon it stands in for cannot disagree about the edge. Read only by
  // datasets carrying `mateAxis`, and required by them: a dataset that
  // knows where its mates are and is handed no band marks nothing, rather than
  // marking alignments the band is drawing.
  mateBand?: { lo: number; hi: number }
  // the axis these are placed against, which is the only axis they have — the
  // query row for a top strip, the target row for a bottom one
  bpPerPx: number
  offsetPx: number
  // which band edge the marks hang off
  side: OffscreenMateSide
  // The view-wide alignment-length floor, applied here for the same reason the
  // shader applies it to ribbons: a whole-genome hairball filtered down to its
  // real blocks should not keep a fringe of marks for the noise it just hid.
  minAlignmentLength: number
  // The color for the contig a mark NAMES, or absent to leave this lane's marks
  // in the band's grey.
  //
  // PER LANE, because the two lanes hold contigs of different assemblies — and
  // because only one of them is usually keyed the same way the ribbons are. See
  // `offscreenMateMarkColors`, which is where the decision lives; this file only
  // paints what it is handed.
  markColorFor?: (refName: string) => string
}

// One lane against the band it is drawn in — what the geometry needs, and what
// the hit test is asked about.
export type OffscreenMateLayout = OffscreenMateLane & {
  width: number
  height: number
}

// The band every lane shares: its box, and the greys both surfaces paint in.
export interface OffscreenMateBand {
  width: number
  height: number
  markColor: string
  labelColor: string
  haloColor: string
}

interface LabelRun {
  refName: string
  x: number
  end: number
  // measured once per contig here, and read again by the fit test and the
  // centring, so the gap the merge tolerates and the name it tolerates it for
  // are the same number
  textWidth: number
}

/**
 * The stretches worth naming: each contig's marks, joined where they sit closer
 * together than a reader could tell apart, so a block of anchors to one contig
 * is one label rather than one per anchor — and a contig appearing in two
 * genuinely separate places is still named twice, which naming each contig once
 * would lose.
 */
function labelRuns(
  rects: OffscreenMateRect[],
  measure: (text: string) => number,
): LabelRun[] {
  const byContig = new Map<string, OffscreenMateRect[]>()
  for (const r of rects) {
    const refName = offscreenMateRefName(r.data, r.index)
    let list = byContig.get(refName)
    if (!list) {
      list = []
      byContig.set(refName, list)
    }
    list.push(r)
  }
  const runs: LabelRun[] = []
  for (const [refName, list] of byContig) {
    const textWidth = measure(refName)
    const mergeGap = textWidth * LABEL_MERGE_GAP_LABELS
    // by x, since draw order is the adapter's and says nothing about position
    list.sort((a, b) => a.x - b.x)
    let run: LabelRun | undefined
    for (const r of list) {
      if (run && r.x - run.end <= mergeGap) {
        run.end = Math.max(run.end, r.x + r.width)
      } else {
        run = { refName, x: r.x, end: r.x + r.width, textWidth }
        runs.push(run)
      }
    }
  }
  return runs
}

interface PlacedLabel {
  refName: string
  x: number
  y: number
}

interface BandSpan {
  from: number
  to: number
}

// The strip's own top edge: 0 for a top strip, the band height less the mark
// height for a bottom one.
function markTop(side: OffscreenMateSide, height: number, markHeight: number) {
  return side === 'bottom' ? height - markHeight : 0
}

// The pixels one lane's marks occupy. Reserved against LABELS — every lane's,
// not just its own — because a name printed over the marks is a name over the
// thing it is naming.
function markZone(
  side: OffscreenMateSide,
  height: number,
  markHeight: number,
): BandSpan {
  const from = markTop(side, height, markHeight)
  return { from, to: from + markHeight }
}

/**
 * The baselines this lane may put a name on, nearest its own edge first.
 *
 * EACH SIDE MEASURES FROM ITS OWN EDGE — the top strip's rows step down and the
 * bottom strip's step up — so a row count derived from one is wrong for the
 * other in both directions.
 */
function labelBaselines(
  side: OffscreenMateSide,
  height: number,
  zones: BandSpan[],
) {
  const first =
    side === 'top' ? LABEL_BASELINE_PX : height - LABEL_BASELINE_FROM_BOTTOM_PX
  const step = side === 'top' ? LABEL_ROW_PX : -LABEL_ROW_PX
  const out: number[] = []
  for (let row = 0; row < MAX_LABEL_ROWS; row++) {
    const y = first + row * step
    const top = y - LABEL_ASCENT_PX
    const clear = !zones.some(z => top < z.to && z.from < y)
    if (top >= 0 && y <= height && clear) {
      out.push(y)
    }
  }
  return out
}

// A row of the band, as the placement builds it up: every label already on that
// baseline, so the next one can find out whether it would land on top of one.
interface LabelSlot {
  y: number
  boxes: BandSpan[]
}

/**
 * Where each stretch's name goes, on the first baseline it does not collide on.
 * A stretch with no free row goes unlabelled rather than over another name.
 *
 * EVERY LANE AT ONCE, which is why this takes a list. The two strips' MARKS hang
 * off opposite edges and cannot collide, but their labels stack INWARD and meet
 * in the middle. One rule covers both that and two stretches of one lane
 * overlapping: a name may not share a baseline, or come within `LABEL_ROW_PX` of
 * one, with an overlapping name already placed.
 *
 * A STRETCH IS MEASURED BY THE PART IN VIEW. One wider than the window has its
 * midpoint off the edge, so both the centring and the fit test read a width
 * nothing can show — and the one contig the whole window maps to was the one
 * contig never named.
 */
function placeLabels(
  lanes: { runs: LabelRun[]; baselines: number[] }[],
  width: number,
): PlacedLabel[] {
  const slots: LabelSlot[] = []
  const placed: PlacedLabel[] = []
  // Left to right, so placement does not depend on the adapter's order — and
  // between stretches at the same x, ONE FROM EACH LANE BEFORE A SECOND FROM
  // EITHER. Sorted by x alone the lanes ran in order, so where both lanes cover
  // the same pixels the top strip took every row a 50px band has and the bottom
  // strip's marks went permanently unnamed. `rank` is a stretch's place from the
  // left within its own lane, so the interleave only decides ties.
  const candidates = lanes
    .flatMap(({ runs, baselines }) =>
      [...runs]
        .sort((a, b) => a.x - b.x)
        .map((run, rank) => ({ run, baselines, rank })),
    )
    .sort((a, b) => a.run.x - b.run.x || a.rank - b.rank)
  for (const { run, baselines } of candidates) {
    const from = Math.max(run.x, 0)
    const to = Math.min(run.end, width)
    const { textWidth } = run
    if (textWidth + MIN_LABEL_PADDING_PX > to - from) {
      continue
    }
    const x = from + (to - from - textWidth) / 2
    // the padding is the gap between neighbours as well as the fit test, so a
    // row's labels never touch
    const box = {
      from: x - MIN_LABEL_PADDING_PX / 2,
      to: x + textWidth + MIN_LABEL_PADDING_PX / 2,
    }
    const y = baselines.find(
      candidate =>
        !slots.some(
          s =>
            Math.abs(s.y - candidate) < LABEL_ROW_PX &&
            s.boxes.some(b => box.from < b.to && b.from < box.to),
        ),
    )
    if (y !== undefined) {
      let slot = slots.find(s => s.y === y)
      if (!slot) {
        slot = { y, boxes: [] }
        slots.push(slot)
      }
      slot.boxes.push(box)
      placed.push({ refName: run.refName, x, y })
    }
  }
  return placed
}

export interface OffscreenMateRect {
  // the dataset and lane index it came from, rather than the contig name it
  // points at: the hover scan builds one of these per candidate and reads the
  // name only for the one it answers with
  data: OffscreenMateDataset
  index: number
  x: number
  // the strip's own top edge: 0 for a top strip, and the band height less the
  // mark height for a bottom one. Carried per rect rather than recomputed by
  // each reader, for the same reason `x` is — draw and hit test cannot disagree
  // about a number neither of them derives.
  y: number
  width: number
  height: number
}

function offscreenMateRefName(data: OffscreenMateDataset, i: number) {
  return data.mateRefNameDict[data.mateRefNameIds[i]!]!
}

// Same expression the ribbons project with, written out rather than reused:
// `projectCorners` works in window-relative bp against the geometry's fetch-time
// base (ADR-067), and these never reach a shader. Absolute cumBp in Float64 on
// the main thread is the same number with the base folded back in.
function screenX(cumBp: number, bpPerPx: number, offsetPx: number) {
  return cumBp / bpPerPx - offsetPx
}

/**
 * Where each mark lands on screen, in the order it is drawn.
 *
 * ONE FUNCTION BECAUSE DRAW AND HIT TEST HAVE TO AGREE. The ribbons keep that
 * agreement under test (`syntenyPickRenderAgreement.test.ts`) precisely because
 * their two paths are separate code; these have one path, so a mark the eye can
 * see and the pointer cannot is not a shape this can take.
 */
function offscreenMateRects(layout: OffscreenMateLayout): OffscreenMateRect[] {
  const strip = stripGeometry(layout)
  if (!strip) {
    return []
  }
  const out: OffscreenMateRect[] = []
  for (const data of layout.datasets) {
    for (let i = 0; i < data.starts.length; i++) {
      const rect = offscreenMateRectAt(layout, data, i, strip)
      if (rect) {
        out.push(rect)
      }
    }
  }
  return out
}

// Every mark in a level is the same height, so the strip is a constant the hit
// test can reject a whole pointer position against before it looks at any
// alignment.
function offscreenMateMarkHeight(height: number) {
  return Math.max(
    1,
    Math.min(OFFSCREEN_MATE_HEIGHT_PX, height * MAX_BAND_FRACTION),
  )
}

// The strip's box in the band — the half of a mark's geometry every mark in a
// lane shares, resolved once so the draw and the hit test cannot place their
// marks a pixel apart, and undefined for a band with no pixels to draw in.
interface StripGeometry {
  markY: number
  markHeight: number
}

function stripGeometry({
  width,
  height,
  side,
}: OffscreenMateLayout): StripGeometry | undefined {
  if (width <= 0 || height <= 0) {
    return undefined
  }
  const markHeight = offscreenMateMarkHeight(height)
  return { markY: markTop(side, height, markHeight), markHeight }
}

// The one place a mark's geometry is decided, so the array the canvas paints and
// the scan the pointer runs cannot describe different rectangles. It ALLOCATES
// per alignment, deliberately — a scratch object halved the strip hover and cost
// the repaint 25%, which is the every-pan path: `REJECTED_IDEAS.md`.
function offscreenMateRectAt(
  {
    bpPerPx,
    offsetPx,
    width,
    minAlignmentLength,
    mateBand,
  }: OffscreenMateLayout,
  data: OffscreenMateDataset,
  i: number,
  { markY, markHeight }: StripGeometry,
): OffscreenMateRect | undefined {
  // the block's own length, NOT `ends - starts`: those are clamped to the
  // displayed region, and the ribbons' own cull reads the unclamped extent
  // (`alignmentLengths`), so measuring the clamp here hid a mark whose ribbon
  // the same setting kept
  if (data.lengths[i]! < minAlignmentLength) {
    return undefined
  }
  const x1 = screenX(data.starts[i]!, bpPerPx, offsetPx)
  const x2 = screenX(data.ends[i]!, bpPerPx, offsetPx)
  if (x2 < 0 || x1 > width) {
    return undefined
  }
  // AFTER the span tests, not before: an entry whose instances were all emitted
  // off-screen keeps its sentinel mate span, and reading that as a position
  // would call it hidden. It is the x test above that drops it.
  const { mateAxis } = data
  if (mateAxis) {
    const drawn =
      mateBand === undefined ||
      (mateAxis.ends[i]! >= mateBand.lo && mateAxis.starts[i]! <= mateBand.hi)
    if (drawn) {
      return undefined
    }
  }
  return {
    data,
    index: i,
    x: x1,
    y: markY,
    width: Math.max(MIN_OFFSCREEN_MATE_WIDTH_PX, x2 - x1),
    height: markHeight,
  }
}

// The strip's hit test, so the hover and the click cannot disagree about what
// "under the pointer" means. Both spelled these comparisons out, and one of the
// two widened is a click that navigates where no tooltip ever appeared.
function pointerOnStrip(strip: StripGeometry, y: number) {
  return y >= strip.markY && y <= strip.markY + strip.markHeight
}

function pointerOnMark(rect: { x: number; width: number }, x: number) {
  return x >= rect.x && x <= rect.x + rect.width
}

/**
 * The contig the mark under a point stands for, or undefined.
 *
 * LAST MATCH WINS: the scan runs backwards over the datasets the canvas paints
 * forwards, so where two marks overlap it answers with the one on top. Marks of
 * two COLORS composite at `MARK_ALPHA` with neither on top, so there is no "on
 * top" there to disagree with — what the two hit tests must not differ on is the
 * order between THEM, and both take it off the datasets.
 *
 * THE STRIP IS TESTED BEFORE ANY ALIGNMENT IS: it is a few pixels of a band ~100
 * tall, so one comparison answers most pointer positions and a hover over the
 * ribbons costs nothing whatever the level fetched.
 */
export function offscreenMateAt(
  layout: OffscreenMateLayout,
  x: number,
  y: number,
) {
  const strip = stripGeometry(layout)
  if (!strip || !pointerOnStrip(strip, y)) {
    return undefined
  }
  const { datasets } = layout
  for (let d = datasets.length - 1; d >= 0; d--) {
    const data = datasets[d]!
    for (let i = data.starts.length - 1; i >= 0; i--) {
      const rect = offscreenMateRectAt(layout, data, i, strip)
      if (rect && pointerOnMark(rect, x)) {
        return offscreenMateRefName(data, i)
      }
    }
  }
  return undefined
}

// Where on the contig it names the alignments under one point actually land.
export interface OffscreenMateLocus {
  // the contig's own bp, half-open like everything else on this side
  start: number
  end: number
}

/**
 * What a CLICK on a mark resolves to: which contig, and the two coordinates the
 * caller's two branches take.
 *
 * `mateCumBp` PRESENT IS THE SCROLL CLASS — the facing row already has this
 * contig and has merely scrolled off it, and this is where to scroll. Absent is
 * the other one, where the row has to gain a region for the contig first and
 * `locus` frames the window inside it.
 *
 * Carrying the destination itself, rather than a `displayed` boolean beside it,
 * makes "displayed with nowhere to scroll to" unrepresentable rather than merely
 * documented — the two came apart, and the click navigated somewhere the mark
 * was never about.
 */
export interface OffscreenMateSpan {
  refName: string
  // The contig's own bp: the BLOCKS' extent, untrimmed, which is what a click
  // on a contig the facing row lacks frames once it has added it, and what a
  // label can name.
  locus: OffscreenMateLocus
  /**
   * Where the alignments under the mark are DRAWN on the facing axis, in that
   * row's cumBp — and, by being present at all, that the row displays this
   * contig and the click may SCROLL rather than change its regions.
   *
   * WHERE THE RIBBONS ARE, not where the block is: `locus` is the untrimmed
   * extent and `clipLargeBlockToWindow` re-anchors a chain to its visible slice,
   * so on chimp chr19 vs hg38 chr17 a mark drawn at chr17:42.6-43.3Mb navigated
   * to the centre of the chromosome, wherever the row already was.
   *
   * ANY placed dataset under the pointer gives the mark one, not the last one
   * scanned: a contig can be in a worker lane and a culled lane at once, and one
   * placed alignment is enough to scroll to.
   *
   * cumBp rather than the contig's own bp because that is what `mateAxis` holds,
   * and which region a coordinate falls in is the facing view's question.
   */
  mateCumBp?: OffscreenMateLocus
}

/**
 * The contig a click on a mark should show, and where on it.
 *
 * THE UNION OF EVERY ALIGNMENT UNDER THE POINT, because a mark is not one
 * alignment — `MIN_OFFSCREEN_MATE_WIDTH_PX` makes even a sub-pixel one a mark,
 * so they pile up in a column and picking one among them would send the same
 * visible mark to two places at two window widths. The union collapses to the
 * single alignment exactly when the mark is one.
 *
 * ONE LANE, because the two strips hold contigs of DIFFERENT assemblies and a
 * name matched across them would union coordinates from two genomes.
 *
 * ONE FORWARD PASS, unlike the hover's backwards early exit: it answers with the
 * last contig the scan meets, which is `offscreenMateAt`'s rule read forwards,
 * and the same walk that accumulates the spans already knows it. For the SHAPE
 * rather than for speed — asking the hit test for the name and scanning again
 * for its coordinates is two traversals that have to agree on which contig won.
 */
export function offscreenMateSpanAt(
  layout: OffscreenMateLayout,
  x: number,
  y: number,
): OffscreenMateSpan | undefined {
  const strip = stripGeometry(layout)
  if (!strip || !pointerOnStrip(strip, y)) {
    return undefined
  }
  const spans = new Map<string, OffscreenMateLocus>()
  // The same union in the facing row's cumBp, and only from the datasets that
  // have one. Kept apart rather than folded into `spans`: a contig can be in
  // both a worker lane and a culled one, and the two carry coordinates in
  // different spaces, so one map would union a contig bp with a cumBp.
  const drawn = new Map<string, OffscreenMateLocus>()
  let top: string | undefined
  for (const data of layout.datasets) {
    const { mateAxis } = data
    for (let i = 0; i < data.starts.length; i++) {
      const rect = offscreenMateRectAt(layout, data, i, strip)
      if (rect && pointerOnMark(rect, x)) {
        const refName = offscreenMateRefName(data, i)
        top = refName
        extendSpan(spans, refName, data.mateStarts[i]!, data.mateEnds[i]!)
        if (mateAxis) {
          extendSpan(drawn, refName, mateAxis.starts[i]!, mateAxis.ends[i]!)
        }
      }
    }
  }
  if (!top) {
    return undefined
  }
  // A DEGENERATE SPAN IS STILL A PLACE. It used to be dropped and the click fell
  // back to the whole contig, which is the answer these coordinates were added
  // to stop — and on a mark whose contig the facing row already displays, that
  // fallback is the other class's navigation, which this one must never take.
  // `OFFSCREEN_MATE_NAV_MIN_BP` frames a zero-width locus the same way it
  // frames a 500bp one.
  return { refName: top, locus: spans.get(top)!, mateCumBp: drawn.get(top) }
}

function extendSpan(
  spans: Map<string, OffscreenMateLocus>,
  refName: string,
  start: number,
  end: number,
) {
  const span = spans.get(refName)
  if (span) {
    span.start = Math.min(span.start, start)
    span.end = Math.max(span.end, end)
  } else {
    spans.set(refName, { start, end })
  }
}

// The strip's marks grouped into one path per fill, in a stable order: a lane
// with no `markColorFor` contributes every rect to the band's grey, so the
// uncolored case is one group and one fill exactly as it was.
function markPathsByColor(
  laneRects: OffscreenMateRect[][],
  lanes: OffscreenMateLane[],
  markColor: string,
) {
  const byColor = new Map<string, OffscreenMateRect[]>()
  for (const [i, rects] of laneRects.entries()) {
    const colorFor = lanes[i]!.markColorFor
    for (const r of rects) {
      const color = colorFor
        ? colorFor(offscreenMateRefName(r.data, r.index))
        : markColor
      let group = byColor.get(color)
      if (!group) {
        group = []
        byColor.set(color, group)
      }
      group.push(r)
    }
  }
  return byColor
}

/**
 * Mark, on the edges of one band, the alignments its level fetched and cannot
 * draw.
 *
 * These are real alignments whose mate is on a contig the facing row is not
 * displaying, so there is no second endpoint to run a ribbon to. Drawn as a
 * mark hanging off the axis they DO have rather than as a degenerate ribbon
 * with both bottom corners equal, which draws a full-height vertical band and
 * asserts an alignment to whatever sits directly below.
 *
 * A SEPARATE OVERLAY RATHER THAN AN INSTANCE KIND. The shader interpolates an
 * instance vertically over the full band by construction, so a mark that
 * descends part way is a new kind with a clamp in `.slang` and a matching one in
 * `syntenyRibbonPath.ts`. These need none of what that buys — no pick index, no
 * CIGAR tiling, no alpha compositing — and there are thousands of them, not
 * millions. See `agent-docs/ideas/offscreen-synteny-mates.md`.
 *
 * EVERY LANE IN ONE CALL, not one per strip: the band's two strips share a fill
 * and the vertical room their labels stack into (`placeLabels`).
 *
 * THE LABEL IS THE ACTIONABLE HALF, and it names a STRETCH rather than a mark.
 * It goes on wherever it fits rather than under a count threshold — fitting is
 * what "too many to label" means, and a run too narrow for its contig name is
 * exactly the one whose neighbours would have overprinted it.
 */
export function drawOffscreenMates(
  ctx: Ctx2D,
  lanes: OffscreenMateLane[],
  band: OffscreenMateBand,
) {
  const { width, height, markColor, labelColor, haloColor } = band
  const laneRects = lanes.map(lane =>
    offscreenMateRects({ ...lane, width, height }),
  )
  if (laneRects.every(rects => rects.length === 0)) {
    return
  }
  // ONE PATH PER COLOR, NOT A FILL EACH. The mark color carries alpha, so marks
  // of one color filled separately composite against each other and the strip
  // saturates to near-black at whole-chromosome zoom, reading as a solid
  // ideogram. Filled as one path they take the color once, and the SVG export
  // gets one `<path>` per contig. Marks of DIFFERENT colors do composite, which
  // is honest — they are alignments to different places.
  for (const [fillStyle, rects] of markPathsByColor(
    laneRects,
    lanes,
    markColor,
  )) {
    ctx.fillStyle = fillStyle
    ctx.beginPath()
    for (const r of rects) {
      ctx.rect(r.x, r.y, r.width, r.height)
    }
    ctx.fill()
  }

  ctx.font = LABEL_FONT
  ctx.textBaseline = 'alphabetic'
  ctx.lineWidth = LABEL_HALO_PX
  ctx.lineJoin = 'round'
  ctx.strokeStyle = haloColor
  ctx.fillStyle = labelColor
  const markHeight = offscreenMateMarkHeight(height)
  const zones = lanes.map(lane => markZone(lane.side, height, markHeight))
  const labels = placeLabels(
    lanes.map((lane, i) => ({
      runs: labelRuns(laneRects[i]!, text => ctx.measureText(text).width),
      baselines: labelBaselines(lane.side, height, zones),
    })),
    width,
  )
  for (const { refName, x, y } of labels) {
    ctx.strokeText(refName, x, y)
    ctx.fillText(refName, x, y)
  }
}
