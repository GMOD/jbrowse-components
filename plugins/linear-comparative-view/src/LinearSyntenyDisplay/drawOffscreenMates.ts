import { alpha, getContrastText } from '@jbrowse/core/ui/palette'
import { CappedPath } from '@jbrowse/render-core/canvas2dUtils'

import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// A mark is a short tick hanging off one edge of the band for an alignment the
// level cannot draw a ribbon for; a strip is the row of them along one edge.

// Short enough to visibly stop: a mark spanning the band would read as an
// alignment to whatever sits directly across from it.
export const OFFSCREEN_MATE_HEIGHT_PX = 6

export const MIN_OFFSCREEN_MATE_WIDTH_PX = 1.5

// A contig draws marks only where the sequence it holds is worth about this
// much of the band. Every mark is at least MIN_OFFSCREEN_MATE_WIDTH_PX wide
// however small its alignment, so a contig with three stray anchors puts down
// as much ink as one with a syntenic block, and at whole-genome zoom that ink
// is the whole strip: peach chr1 over grape chr1 draws 2,767 marks whose median
// alignment is 3.2kb against 34kb per pixel, so nothing there is drawn at its
// own size. Pixels rather than bp because the question is what a reader can act
// on: the floor lifts as the window widens and falls as it narrows, so the
// scattered contigs a wide view cannot use appear on the way in, which is where
// there is room for them.
const MIN_CONTIG_MARK_PX = 4

const MAX_BAND_FRACTION = 1 / 3

const MIN_LABEL_PADDING_PX = 6

const LABEL_FONT = '10px sans-serif'

const LABEL_HALO_PX = 3

// The top strip's labels sit below its marks and the bottom strip's above them
const LABEL_BASELINE_PX = 16
const LABEL_BASELINE_FROM_BOTTOM_PX = 10

// Marks to one contig closer than this many of its own name are one stretch:
// a break too small to hold a second name is not one a reader can see
const LABEL_MERGE_GAP_LABELS = 2

const LABEL_ROW_PX = 12

const LABEL_ASCENT_PX = 8

// three names the paleohexaploid case; past that the band is a wall of text
const MAX_LABEL_ROWS = 3

// How much of a name has to sit over the marks it names. A stretch is allowed
// to be narrower than its own name and carry it anyway, overhanging a quarter
// of it each side: the reader already reads a name by what is under its centre
// — two names a row apart may overlap in x, and a row-3 name sits 26px from the
// marks — so a name whose middle half is over its own marks says the same
// thing. Containment instead decided the contest before it ran — the test comes
// before the strongest-first sort — and dropped the fourth-strongest contig in
// the demo window, 920kb of it, for a name a few pixels too long.
const MIN_LABEL_COVERAGE = 0.5

export const MARK_ALPHA = 0.35

const LABEL_ALPHA = 0.6

// Both greys come off the band's own ground rather than the theme: a dark theme
// once resolved the text color white over a band still cleared white
export function offscreenMateColors(groundColor: string) {
  const ink = getContrastText(groundColor)
  return {
    markColor: alpha(ink, MARK_ALPHA),
    labelColor: alpha(ink, LABEL_ALPHA),
    haloColor: groundColor,
  }
}

export type OffscreenMateSide = 'top' | 'bottom'

export interface MateBand {
  lo: number
  hi: number
}

// Without `mateAxis` every entry is a mark: the worker found no place on the
// facing axis for it. With it the entry has a place, and whether it is a mark
// depends on where the facing row currently sits (`culledRibbonMates`).
export interface OffscreenMateDataset extends OffscreenMateData {
  mateAxis?: MateAxisPlacement
}

// Where a dataset's entries sit on the facing axis, in its cumBp, with the
// extent over all of them
export interface MateAxisPlacement {
  starts: Float64Array
  ends: Float64Array
  lo: number
  hi: number
}

// One strip's input: what to mark, the ruler to mark it against, and the box
// it is drawn in. A band has at most two, and they are not interchangeable
// (`offscreenMateStrips`).
export interface OffscreenMateLane {
  datasets: OffscreenMateDataset[]
  // the facing axis's drawable span in its cumBp, the same band
  // `isRibbonCulled` keeps a ribbon for; read only by datasets with `mateAxis`
  mateBand: MateBand
  bpPerPx: number
  offsetPx: number
  side: OffscreenMateSide
  minAlignmentLength: number
  // the color for the contig a mark names, or absent for the band's grey
  markColorFor?: (refName: string) => string
  width: number
  height: number
}

export interface OffscreenMatePaint {
  markColor: string
  labelColor: string
  haloColor: string
  // label width at LABEL_FONT; defaults to the context's own measureText,
  // which on an SvgCanvas is an advance table rather than the browser's font
  measure?: (text: string) => number
}

export function canvasLabelMeasurer() {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) {
    return undefined
  }
  ctx.font = LABEL_FONT
  return (text: string) => ctx.measureText(text).width
}

// A dataset with an extent already inside the band hides nothing, so the
// strip need not walk it. No extent means the worker placed nothing on the
// facing axis, so everything is a mark; an extent with no band means there is
// no facing row to have scrolled away, so nothing is.
export function datasetMayHide(
  data: OffscreenMateDataset,
  band: MateBand | undefined,
) {
  const { mateAxis } = data
  return mateAxis === undefined
    ? true
    : band !== undefined && (mateAxis.lo < band.lo || mateAxis.hi > band.hi)
}

function ribbonDrawn(mateAxis: MateAxisPlacement, i: number, band: MateBand) {
  return mateAxis.ends[i]! >= band.lo && mateAxis.starts[i]! <= band.hi
}

function offscreenMateRefName(data: OffscreenMateDataset, i: number) {
  return data.mateRefNameDict[data.mateRefNameIds[i]!]!
}

function offscreenMateMarkHeight(height: number) {
  return Math.max(
    1,
    Math.min(OFFSCREEN_MATE_HEIGHT_PX, height * MAX_BAND_FRACTION),
  )
}

interface StripGeometry {
  markY: number
  markHeight: number
}

function stripGeometry({
  width,
  height,
  side,
}: OffscreenMateLane): StripGeometry | undefined {
  if (width <= 0 || height <= 0) {
    return undefined
  }
  const markHeight = offscreenMateMarkHeight(height)
  return {
    markY: side === 'bottom' ? height - markHeight : 0,
    markHeight,
  }
}

// The one place a mark's x is decided, so the draw and the two hit tests
// cannot disagree. Entries whose instances all fell off screen keep a sentinel
// span (`starts` above `ends`) that the x test drops before `mateAxis` is
// read, since reading that sentinel as a position would call it hidden.
function forEachMark(
  lane: OffscreenMateLane,
  visit: (
    data: OffscreenMateDataset,
    datasetIndex: number,
    i: number,
    x: number,
    w: number,
  ) => void,
) {
  const { bpPerPx, offsetPx, width, minAlignmentLength, mateBand } = lane
  const contigFloor = MIN_CONTIG_MARK_PX * bpPerPx
  for (const [d, data] of lane.datasets.entries()) {
    const { starts, ends, lengths, mateRefNameIds, alignedBp, mateAxis } = data
    for (let i = 0; i < starts.length; i++) {
      const x1 = starts[i]! / bpPerPx - offsetPx
      const x2 = ends[i]! / bpPerPx - offsetPx
      if (
        lengths[i]! >= minAlignmentLength &&
        (alignedBp[mateRefNameIds[i]!] ?? Infinity) >= contigFloor &&
        x2 >= 0 &&
        x1 <= width &&
        !(mateAxis && ribbonDrawn(mateAxis, i, mateBand))
      ) {
        visit(data, d, i, x1, Math.max(MIN_OFFSCREEN_MATE_WIDTH_PX, x2 - x1))
      }
    }
  }
}

function pointerOnStrip(strip: StripGeometry, y: number) {
  return y >= strip.markY && y <= strip.markY + strip.markHeight
}

// Aligned bp, the same number the `minAlignmentLength` floor reads, decides
// every contest a zoomed-out strip has more entrants than room for: which
// stretch gets one of the three label rows, which contig a pointer over a
// column of stacked marks names, and which color is painted last. Summed over
// whatever is competing — one alignment where a pointer picks one, a whole
// stretch where a name covers one. A whole-genome band puts a 12Mb block and a
// 200bp scrap in the same pixel, and nothing else in the lane tells them apart:
// both draw at the 1.5px floor.
function markAlignedBp(data: OffscreenMateDataset, i: number) {
  return data.lengths[i]!
}

export interface OffscreenMateLocus {
  start: number
  end: number
}

// What a pointer on a mark resolves to, hover and click alike. `mateCumBp`
// present means the facing row displays the contig and a click scrolls to
// where the alignments are drawn; absent means the row has to gain the contig
// first, and `locus` frames the window inside it.
export interface OffscreenMateSpan {
  refName: string
  // the blocks' untrimmed extent in the contig's own bp
  locus: OffscreenMateLocus
  // where the alignments are drawn on the facing axis, in that row's cumBp
  mateCumBp?: OffscreenMateLocus
}

// The contig of the longest alignment under the point, which is the one
// painted last, and the union of that contig's alignments under it, since a
// mark is a column of them
export function offscreenMateAt(
  lane: OffscreenMateLane,
  x: number,
  y: number,
): OffscreenMateSpan | undefined {
  const strip = stripGeometry(lane)
  if (!strip || !pointerOnStrip(strip, y)) {
    return undefined
  }
  const spans = new Map<string, OffscreenMateLocus>()
  const drawn = new Map<string, OffscreenMateLocus>()
  let top: string | undefined
  let topBp = -Infinity
  forEachMark(lane, (data, _d, i, mx, w) => {
    if (x >= mx && x <= mx + w) {
      const refName = offscreenMateRefName(data, i)
      const bp = markAlignedBp(data, i)
      if (bp > topBp) {
        topBp = bp
        top = refName
      }
      extendSpan(spans, refName, data.mateStarts[i]!, data.mateEnds[i]!)
      const { mateAxis } = data
      if (mateAxis) {
        extendSpan(drawn, refName, mateAxis.starts[i]!, mateAxis.ends[i]!)
      }
    }
  })
  return top
    ? { refName: top, locus: spans.get(top)!, mateCumBp: drawn.get(top) }
    : undefined
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

// One lane's marks as parallel arrays. Nothing per mark is an object or a
// string: the contig is reached through the dataset's dictionary id, and the
// two readers below resolve a name once per contig rather than once per mark.
interface LaneMarks {
  lane: OffscreenMateLane
  strip: StripGeometry
  count: number
  xs: Float64Array
  widths: Float64Array
  dataset: Uint32Array
  entry: Uint32Array
  // the longest alignment in the lane, which is what an uncolored lane brings
  // to the paint order
  strongest: number
}

function laneMarks(lane: OffscreenMateLane): LaneMarks | undefined {
  const strip = stripGeometry(lane)
  if (!strip) {
    return undefined
  }
  let capacity = 0
  for (const data of lane.datasets) {
    capacity += data.starts.length
  }
  const xs = new Float64Array(capacity)
  const widths = new Float64Array(capacity)
  const dataset = new Uint32Array(capacity)
  const entry = new Uint32Array(capacity)
  let count = 0
  let strongest = 0
  forEachMark(lane, (data, d, i, x, w) => {
    const bp = markAlignedBp(data, i)
    xs[count] = x
    widths[count] = w
    dataset[count] = d
    entry[count] = i
    count++
    strongest = Math.max(strongest, bp)
  })
  return { lane, strip, count, xs, widths, dataset, entry, strongest }
}

// A mark's own length, reached through the same two indices its contig is
function laneMarkAlignedBp({ lane, dataset, entry }: LaneMarks, i: number) {
  return markAlignedBp(lane.datasets[dataset[i]!]!, entry[i]!)
}

// The marks of a lane grouped by a key resolved once per contig: group
// membership is an integer read per mark, and `keyFor` runs once per
// (dataset, contig id), which is what keeps a 250k-mark repaint off the
// string path.
function groupMarks<K>(marks: LaneMarks, keyFor: (refName: string) => K) {
  const { lane, count, dataset, entry } = marks
  const groups: {
    key: K
    refName: string
    marks: number[]
    strongest: number
  }[] = []
  const groupByKey = new Map<K, number>()
  const groupById = lane.datasets.map(d =>
    new Int32Array(d.mateRefNameDict.length).fill(-1),
  )
  for (let i = 0; i < count; i++) {
    const d = dataset[i]!
    const data = lane.datasets[d]!
    const id = data.mateRefNameIds[entry[i]!]!
    let g = groupById[d]![id]!
    if (g === -1) {
      const refName = data.mateRefNameDict[id]!
      const key = keyFor(refName)
      const known = groupByKey.get(key)
      if (known === undefined) {
        g = groups.length
        groups.push({ key, refName, marks: [], strongest: 0 })
        groupByKey.set(key, g)
      } else {
        g = known
      }
      groupById[d]![id] = g
    }
    const group = groups[g]!
    group.marks.push(i)
    group.strongest = Math.max(group.strongest, laneMarkAlignedBp(marks, i))
  }
  return groups
}

interface LabelRun {
  refName: string
  x: number
  end: number
  textWidth: number
  // every alignment the stretch holds, which is how it ranks for a row
  alignedBp: number
}

// Each contig's marks joined where they sit closer than a reader could tell
// apart, so a block of anchors is one label and a contig in two separate
// places is still named twice.
//
// Marks are visited by pixel column rather than sorted by x: a column holds
// the leftmost x and rightmost end of the marks that start in it, and walking
// the touched columns in order makes the same merge decisions a sort would,
// since every mark in a column is within a pixel of the first and the merge
// gap is never under one.
function labelRuns(marks: LaneMarks, measure: (text: string) => number) {
  const { lane, xs, widths } = marks
  const { width } = lane
  const colX = new Float64Array(width + 1).fill(Infinity)
  const colEnd = new Float64Array(width + 1).fill(-Infinity)
  const colBp = new Float64Array(width + 1)
  const runs: LabelRun[] = []
  for (const { refName, marks: list } of groupMarks(marks, name => name)) {
    const touched: number[] = []
    for (const i of list) {
      const x = xs[i]!
      const c = Math.min(width, Math.max(0, Math.floor(x)))
      if (colX[c] === Infinity) {
        touched.push(c)
      }
      colX[c] = Math.min(colX[c]!, x)
      colEnd[c] = Math.max(colEnd[c]!, x + widths[i]!)
      colBp[c] = colBp[c]! + laneMarkAlignedBp(marks, i)
    }
    const textWidth = measure(refName)
    const mergeGap = textWidth * LABEL_MERGE_GAP_LABELS
    let run: LabelRun | undefined
    for (const c of Int32Array.from(touched).sort()) {
      const x = colX[c]!
      const end = colEnd[c]!
      if (run && x - run.end <= mergeGap) {
        run.end = Math.max(run.end, end)
        run.alignedBp += colBp[c]!
      } else {
        run = { refName, x, end, textWidth, alignedBp: colBp[c]! }
        runs.push(run)
      }
      colX[c] = Infinity
      colEnd[c] = -Infinity
      colBp[c] = 0
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

// The baselines a lane may put a name on, nearest its own edge first, clear
// of every lane's marks
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

interface LabelSlot {
  y: number
  boxes: BandSpan[]
}

// Every lane at once, because the two strips' labels stack inward and meet in
// the middle. Candidates go strongest first, interleaving one from each lane
// before a second from either, so where both lanes cover the same pixels the
// top strip does not take every row. A stretch is measured by the part in
// view, so one wider than the window can still be named.
//
// Strongest first is what a zoomed-out band needs and a zoomed-in one cannot
// tell apart: at whole-genome zoom a dozen stretches overlap in the pixels
// three rows have room for, and taken left to right the rows went to whatever
// sat furthest left — a scrap of an alignment to an unplaced contig outranking
// the chromosome most of the window aligns to.
function placeLabels(
  lanes: { runs: LabelRun[]; baselines: number[] }[],
  width: number,
): PlacedLabel[] {
  const slots: LabelSlot[] = []
  const placed: PlacedLabel[] = []
  const candidates = lanes
    .flatMap(({ runs, baselines }) =>
      [...runs]
        .sort((a, b) => b.alignedBp - a.alignedBp || a.x - b.x)
        .map((run, rank) => ({ run, baselines, rank })),
    )
    .sort((a, b) => b.run.alignedBp - a.run.alignedBp || a.rank - b.rank)
  for (const { run, baselines } of candidates) {
    const from = Math.max(run.x, 0)
    const to = Math.min(run.end, width)
    const { textWidth } = run
    if (to - from >= textWidth * MIN_LABEL_COVERAGE) {
      // centred on the stretch, then kept inside the window, which only the
      // overhang can leave
      const x = Math.min(
        Math.max(from + (to - from - textWidth) / 2, 0),
        Math.max(width - textWidth, 0),
      )
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
  }
  return placed
}

interface ColorGroup {
  paths: { marks: LaneMarks; list?: number[] }[]
  strongest: number
}

// One path per color rather than a fill per mark: the color carries alpha, so
// marks filled separately composite against each other and a dense strip
// saturates to a solid bar. Marks of different colors do composite, which is
// honest. An uncolored lane, the common one, is rected straight from its
// arrays with no grouping at all.
function fillMarks(ctx: Ctx2D, marks: LaneMarks[], markColor: string) {
  const byColor = new Map<string, ColorGroup>()
  for (const m of marks) {
    const colorFor = m.lane.markColorFor
    const groups = colorFor
      ? groupMarks(m, colorFor).map(g => ({
          key: g.key,
          list: g.marks,
          strongest: g.strongest,
        }))
      : [{ key: markColor, list: undefined, strongest: m.strongest }]
    for (const { key, list, strongest } of groups) {
      let group = byColor.get(key)
      if (!group) {
        group = { paths: [], strongest: 0 }
        byColor.set(key, group)
      }
      group.paths.push({ marks: m, list })
      group.strongest = Math.max(group.strongest, strongest)
    }
  }
  // Weakest color first, so the longest alignment is the one the composite
  // ends on and the hit test answers with the mark on top, as it says
  const ordered = [...byColor].sort((a, b) => a[1].strongest - b[1].strongest)
  for (const [fillStyle, { paths }] of ordered) {
    ctx.fillStyle = fillStyle
    const path = new CappedPath(ctx, 'fill')
    for (const { marks: m, list } of paths) {
      const { xs, widths, strip, count } = m
      if (list) {
        for (const i of list) {
          path.add()
          ctx.rect(xs[i]!, strip.markY, widths[i]!, strip.markHeight)
        }
      } else {
        for (let i = 0; i < count; i++) {
          path.add()
          ctx.rect(xs[i]!, strip.markY, widths[i]!, strip.markHeight)
        }
      }
    }
    path.flush()
  }
}

// Every lane in one call: the band's two strips share the vertical room their
// labels stack into. A label names a stretch and goes on wherever it fits;
// fitting is what "too many to label" means.
export function drawOffscreenMates(
  ctx: Ctx2D,
  lanes: OffscreenMateLane[],
  paint: OffscreenMatePaint,
) {
  const { markColor, labelColor, haloColor } = paint
  const measure = paint.measure ?? (text => ctx.measureText(text).width)
  const marks = lanes.map(lane => laneMarks(lane)).filter(m => m !== undefined)
  if (marks.every(m => m.count === 0)) {
    return
  }
  fillMarks(ctx, marks, markColor)

  ctx.font = LABEL_FONT
  ctx.textBaseline = 'alphabetic'
  ctx.lineWidth = LABEL_HALO_PX
  ctx.lineJoin = 'round'
  ctx.strokeStyle = haloColor
  ctx.fillStyle = labelColor
  const zones = marks.map(({ strip }) => ({
    from: strip.markY,
    to: strip.markY + strip.markHeight,
  }))
  const labels = placeLabels(
    marks.map(m => ({
      runs: labelRuns(m, measure),
      baselines: labelBaselines(m.lane.side, m.lane.height, zones),
    })),
    marks[0]!.lane.width,
  )
  for (const { refName, x, y } of labels) {
    ctx.strokeText(refName, x, y)
    ctx.fillText(refName, x, y)
  }
}
