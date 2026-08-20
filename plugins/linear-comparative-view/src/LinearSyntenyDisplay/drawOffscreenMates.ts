import { alpha } from '@jbrowse/core/ui/palette'

import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { Theme } from '@mui/material'

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
// stretch as far as a label is concerned.
//
// MEASURED IN LABELS, NOT PIXELS, because what the gap has to be compared
// against is the thing that would go in it: a break too small to hold a second
// name is not a break a reader can see, so naming both sides of it repeats the
// name rather than pointing at two things. A fixed 20px was the same tolerance
// at every zoom, and a block of anchors spreads with the zoom — at
// whole-chromosome scale its marks are a few px apart and at a 4 Mb window they
// are tens, so the one block fragmented into fifteen slivers, none of them wide
// enough to hold the contig name, and the strip named NOTHING at exactly the
// zoom where a reader asks what it is looking at.
//
// Two names rather than one: at one the fragments each cleared the bar and the
// same word landed three times across a band. Anything from two up gives the
// same answer on the grape/peach demo at both zooms, so this is not a knife
// edge.
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

// The marks are the BACKGROUND of this feature and the labels are the finding,
// so the marks are washed out to roughly the weight of the ribbons they sit
// over. At full `text.secondary` a strip read as the loudest thing in the band
// — a dark grey ideogram over a field of 0.2-alpha ribbons — which inverts what
// the reader should look at first. Alpha rather than a lighter grey so the
// strip recedes against either theme's ground, and it composites correctly
// because marks of one color are filled as ONE path (see `drawOffscreenMates`).
//
// Exported because a lane painting its marks by contig
// (`offscreenMateMarkColorFor`) has to reach the same weight through a different
// palette: a strip that is grey at 0.35 in one mode and full-strength category10
// in another is two features, not one with a color key.
export const MARK_ALPHA = 0.35

// One source for both surfaces: the screen overlay and the SVG export run the
// same draw, and a figure whose marks are a different grey from the ones the
// user turned on is a difference nothing would report.
export function offscreenMateColors(theme: Theme) {
  return {
    markColor: alpha(theme.palette.text.secondary, MARK_ALPHA),
    // full strength, unlike the marks: the label is the actionable half, it is
    // haloed rather than tinted, and there is one of them per stretch
    labelColor: theme.palette.text.secondary,
    // the band's own ground, so a label over a ribbon stays readable
    haloColor: theme.palette.background.paper,
  }
}

// Which band edge a strip hangs off — the top for marks on the query axis, the
// bottom for the target axis's. The two never overlap in y, which is what lets
// one hit test answer for both without deciding between them.
export type OffscreenMateSide = 'top' | 'bottom'

// One strip's worth of input: what to mark and the ruler to mark it against.
// A band has at most two, and they are NOT interchangeable — see
// `offscreenMateStrips`, which is what builds them.
export interface OffscreenMateLane {
  // one per synteny display on the level, drawn and hit-tested as one strip:
  // they share a band, so labels that avoid each other within a display have to
  // avoid the neighbouring display's too
  datasets: OffscreenMateData[]
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
 * EACH SIDE MEASURES FROM ITS OWN EDGE. The top strip's rows step down from
 * `LABEL_BASELINE_PX` and the bottom strip's step UP from
 * `LABEL_BASELINE_FROM_BOTTOM_PX`, so a row count derived from one is wrong for
 * the other in both directions: on a 40px band — what `levelHeightForCount`
 * gives a stack of eight — the top's arithmetic granted the bottom strip a third
 * row at y=6, which is above the band's own top edge and on top of the OTHER
 * strip's marks, while on a 17px band it denied it a row that fits.
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
 *
 * TWO STRETCHES CAN COVER THE SAME PIXELS, and in the case this feature exists
 * for they usually do. Drawn on one baseline they land within a few pixels of
 * each other, the last one's halo erases the two before it, and the figure then
 * names one contig where three apply — with nothing to say two are missing.
 *
 * EVERY LANE AT ONCE, which is why this takes a list. The two strips hang off
 * opposite edges, so their MARKS cannot collide — but their labels stack INWARD
 * from those edges and meet in the middle. Placed one lane at a time they were
 * blind to each other: on a 50px band both lanes offered baselines 16/28/40 and
 * a top name and a bottom name landed on exactly the same pixels, and on the
 * 80px band a four-level stack auto-scales to, the two third rows landed 6px
 * apart. Rows within a lane are `LABEL_ROW_PX` apart by construction, so one
 * rule — a name may not share a baseline, or come within a row of one, with an
 * overlapping name already placed — covers both cases.
 *
 * A STRETCH IS MEASURED BY THE PART IN VIEW. One wider than the window has its
 * own midpoint off the edge, so centring on it put the name of the contig
 * covering everything the reader can see outside the frame — and the fit test
 * read that same off-screen width, so the label passed the test and then drew
 * where nothing could show it. Zooming into a block was enough: the one contig
 * the whole window maps to was the one contig never named.
 *
 * A stretch with no free row goes unlabelled rather than on top of another name.
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
  data: OffscreenMateData
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

function offscreenMateRefName(data: OffscreenMateData, i: number) {
  return data.mateRefNameDict[data.mateRefNameIds[i]!]!
}

// Same expression the ribbons project with, written out rather than reused:
// `projectCorners` works in window-relative bp against the geometry's fetch-time
// base (ADR-067, so the GPU's Float32 stays exact), and these never reach a
// shader. Absolute cumBp in Float64 on the main thread is the same number with
// the base folded back in — `(cumBp - base)/bpPerPx + (base - offsetPx*bpPerPx)/bpPerPx`.
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
// the scan the pointer runs cannot describe different rectangles.
//
// IT ALLOCATES, and the hit test throws away what it allocates once per
// alignment. Writing into a scratch instead is the obvious fix and it is a net
// loss: it halved the strip hover (0.039ms -> 0.019ms on the demo fixture) and
// cost the REPAINT 25%, which is the every-pan path rather than the
// pointer-is-on-the-marks one. See `agent-docs/reference/REJECTED_IDEAS.md`.
function offscreenMateRectAt(
  { bpPerPx, offsetPx, width, minAlignmentLength }: OffscreenMateLayout,
  data: OffscreenMateData,
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
  return {
    data,
    index: i,
    x: x1,
    y: markY,
    width: Math.max(MIN_OFFSCREEN_MATE_WIDTH_PX, x2 - x1),
    height: markHeight,
  }
}

/**
 * The contig the mark under a point stands for, or undefined.
 *
 * LAST MATCH WINS, so the answer is whatever a reader sees on top where two
 * marks overlap — the scan runs backwards over the datasets the canvas paints
 * forwards, and later paints over earlier.
 *
 * THE STRIP IS TESTED BEFORE ANY ALIGNMENT IS. Every mark has the same height,
 * and the strip is a few pixels of a band ~100 tall, so the overwhelming
 * majority of pointer positions this is asked about are not in it. Answering
 * those with one comparison rather than by laying out every mark first is what
 * keeps a hover over the ribbons costing nothing, whatever the level fetched.
 */
export function offscreenMateAt(
  layout: OffscreenMateLayout,
  x: number,
  y: number,
) {
  const strip = stripGeometry(layout)
  if (!strip || y < strip.markY || y > strip.markY + strip.markHeight) {
    return undefined
  }
  const { datasets } = layout
  for (let d = datasets.length - 1; d >= 0; d--) {
    const data = datasets[d]!
    for (let i = data.starts.length - 1; i >= 0; i--) {
      const rect = offscreenMateRectAt(layout, data, i, strip)
      if (rect && x >= rect.x && x <= rect.x + rect.width) {
        return offscreenMateRefName(data, i)
      }
    }
  }
  return undefined
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
 * A SEPARATE OVERLAY RATHER THAN AN INSTANCE KIND. The instance format carries
 * four cumBp corners and the shader interpolates vertically over the full band
 * by construction, so a mark that descends part way is a new kind with a
 * per-kind vertical clamp in `.slang` AND its counterpart in
 * `syntenyRibbonPath.ts`, which have to agree or the Canvas2D fallback disagrees
 * with WebGPU. These need none of what that buys — no pick index, no CIGAR
 * tiling, no alpha compositing against ribbons — and there are thousands of
 * them, not millions. See `agent-docs/ideas/offscreen-synteny-mates.md`.
 *
 * EVERY LANE IN ONE CALL, not one call per strip. The band is the unit: its two
 * strips share a fill (so density cannot darken one against the other) and,
 * more importantly, share the vertical room their labels stack into — see
 * `placeLabels`.
 *
 * THE LABEL IS THE ACTIONABLE HALF, and it names a STRETCH rather than a mark —
 * one per run of nearby anchors to the same contig. It goes on wherever it fits
 * rather than under a count threshold: fitting is what "too many to label"
 * actually means, and a run too narrow for its contig name is exactly the one
 * whose neighbours would have overprinted it.
 */
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
  // ONE PATH, NOT A FILL EACH. The mark color carries alpha, so overlapping
  // marks filled separately composite against each other and the strip darkens
  // with density — at whole-chromosome zoom there are more marks than pixels, so
  // it saturates to near-black and reads as a solid ideogram rather than as
  // marks. Filled as one path they take the color once. It is also what the SVG
  // export wants: one `<path>` instead of a `<rect>` per alignment.
  // ONE PATH PER COLOR, which is the same rule as one path for one color: marks
  // sharing a color are the same contig, so filling them together is what stops
  // the strip darkening with density (see above). Marks of DIFFERENT colors do
  // composite against each other where they overlap, and that is honest — they
  // are alignments to different places.
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
