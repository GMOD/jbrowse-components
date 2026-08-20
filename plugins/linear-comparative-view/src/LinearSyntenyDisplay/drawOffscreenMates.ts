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

// Clear of the mark above and the ribbons below. Tight, because the band
// between two rows is the one place in this view with no vertical room to
// spare.
const LABEL_BASELINE_PX = 16

// Marks to one contig nearer than this are one stretch as far as a label is
// concerned. A paleopolyploid block is dozens of anchors a few px apart, and a
// label per anchor is a wall of the same word.
const LABEL_MERGE_GAP_PX = 20

const LABEL_ROW_PX = 12

// The case this feature exists for is one query segment with SEVERAL
// counterparts — peach chr1 has about three grape chromosomes over each of its
// segments — so those stretches overlap in x by construction and one row of
// labels can only ever name one of them. Three rows names the paleohexaploid
// case; past that the band is a wall of grey text over the ribbons.
const MAX_LABEL_ROWS = 3

// One source for both surfaces: the screen overlay and the SVG export run the
// same draw, and a figure whose marks are a different grey from the ones the
// user turned on is a difference nothing would report.
export function offscreenMateColors(theme: Theme) {
  return {
    color: theme.palette.text.secondary,
    // the band's own ground, so a label over a ribbon stays readable
    haloColor: theme.palette.background.paper,
  }
}

interface LabelRun {
  refName: string
  x: number
  end: number
}

/**
 * The stretches worth naming: each contig's marks, joined where they sit close
 * together, so a run of anchors to one contig is one label rather than one per
 * anchor — and a contig appearing in two separate places is still named twice,
 * which naming each contig once would lose.
 */
function labelRuns(rects: OffscreenMateRect[]): LabelRun[] {
  const byContig = new Map<string, OffscreenMateRect[]>()
  for (const r of rects) {
    const refName = offscreenMateRefName(r)
    let list = byContig.get(refName)
    if (!list) {
      list = []
      byContig.set(refName, list)
    }
    list.push(r)
  }
  const runs: LabelRun[] = []
  for (const [refName, list] of byContig) {
    // by x, since draw order is the adapter's and says nothing about position
    list.sort((a, b) => a.x - b.x)
    let run: LabelRun | undefined
    for (const r of list) {
      if (run && r.x - run.end <= LABEL_MERGE_GAP_PX) {
        run.end = Math.max(run.end, r.x + r.width)
      } else {
        run = { refName, x: r.x, end: r.x + r.width }
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

/**
 * Where each stretch's name goes, on the first row it does not collide on.
 *
 * TWO STRETCHES CAN COVER THE SAME PIXELS, and in the case this feature exists
 * for they usually do. Drawn on one baseline they land within a few pixels of
 * each other, the last one's halo erases the two before it, and the figure then
 * names one contig where three apply — with nothing to say two are missing.
 *
 * A STRETCH IS MEASURED BY THE PART IN VIEW. One wider than the window has its
 * own midpoint off the edge, so centring on it put the name of the contig
 * covering everything the reader can see outside the frame — and the fit test
 * read that same off-screen width, so the label passed the test and then drew
 * where nothing could show it. Zooming into a block was enough: the one contig
 * the whole window maps to was the one contig never named.
 *
 * Placement is left to right so it does not depend on the adapter's order, and
 * a stretch with no free row goes unlabelled rather than on top of another
 * name.
 */
function placeLabels(
  runs: LabelRun[],
  measure: (text: string) => number,
  width: number,
  height: number,
): PlacedLabel[] {
  const maxRows = Math.min(
    MAX_LABEL_ROWS,
    Math.floor((height - LABEL_BASELINE_PX) / LABEL_ROW_PX) + 1,
  )
  // a band with no room for the first baseline gets no labels, rather than a
  // row drawn past its bottom edge for the canvas and the export clip to eat
  if (maxRows < 1) {
    return []
  }
  const rows: { x: number; end: number }[][] = []
  const placed: PlacedLabel[] = []
  for (const run of [...runs].sort((a, b) => a.x - b.x)) {
    const from = Math.max(run.x, 0)
    const to = Math.min(run.end, width)
    const textWidth = measure(run.refName)
    if (textWidth + MIN_LABEL_PADDING_PX > to - from) {
      continue
    }
    const x = from + (to - from - textWidth) / 2
    // the padding is the gap between neighbours as well as the fit test, so a
    // row's labels never touch
    const box = {
      x: x - MIN_LABEL_PADDING_PX / 2,
      end: x + textWidth + MIN_LABEL_PADDING_PX / 2,
    }
    let row = 0
    while (
      row < maxRows &&
      rows[row]?.some(b => box.x < b.end && b.x < box.end)
    ) {
      row++
    }
    if (row >= maxRows) {
      continue
    }
    ;(rows[row] ??= []).push(box)
    placed.push({
      refName: run.refName,
      x,
      y: LABEL_BASELINE_PX + row * LABEL_ROW_PX,
    })
  }
  return placed
}

export interface OffscreenMateLayout {
  // one per synteny display on the level, drawn and hit-tested as one strip:
  // they share a band, so labels that avoid each other within a display have to
  // avoid the neighbouring display's too
  datasets: OffscreenMateData[]
  // the QUERY axis, which is the only axis these have
  bpPerPx: number
  offsetPx: number
  width: number
  height: number
  // The view-wide alignment-length floor, applied here for the same reason the
  // shader applies it to ribbons: a whole-genome hairball filtered down to its
  // real blocks should not keep a fringe of marks for the noise it just hid.
  minAlignmentLength?: number
}

export interface OffscreenMateRect {
  // the dataset and lane index it came from, rather than the contig name it
  // points at: the hover scan builds one of these per candidate and reads the
  // name only for the one it answers with
  data: OffscreenMateData
  index: number
  x: number
  width: number
  height: number
}

export function offscreenMateRefName(r: OffscreenMateRect) {
  return r.data.mateRefNameDict[r.data.mateRefNameIds[r.index]!]!
}

// How many alignments this display holds for the contig this mark points at —
// the same per-contig tally the menu's headline is summed from, so a mark
// reports the number that turning the marks on reported.
export function offscreenMateContigCount(r: OffscreenMateRect) {
  return r.data.counts[r.data.mateRefNameIds[r.index]!] ?? 0
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
export function offscreenMateRects(
  layout: OffscreenMateLayout,
): OffscreenMateRect[] {
  const { width, height, datasets } = layout
  if (width <= 0 || height <= 0) {
    return []
  }
  const markHeight = offscreenMateMarkHeight(height)
  const out: OffscreenMateRect[] = []
  for (const data of datasets) {
    for (let i = 0; i < data.starts.length; i++) {
      const rect = offscreenMateRectAt(layout, data, i, markHeight)
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

// The one place a mark's geometry is decided, so the array the canvas paints and
// the scan the pointer runs cannot describe different rectangles.
function offscreenMateRectAt(
  { bpPerPx, offsetPx, width, minAlignmentLength = 0 }: OffscreenMateLayout,
  data: OffscreenMateData,
  i: number,
  markHeight: number,
): OffscreenMateRect | undefined {
  const start = data.starts[i]!
  const end = data.ends[i]!
  if (end - start < minAlignmentLength) {
    return undefined
  }
  const x1 = screenX(start, bpPerPx, offsetPx)
  const x2 = screenX(end, bpPerPx, offsetPx)
  if (x2 < 0 || x1 > width) {
    return undefined
  }
  return {
    data,
    index: i,
    x: x1,
    width: Math.max(MIN_OFFSCREEN_MATE_WIDTH_PX, x2 - x1),
    height: markHeight,
  }
}

/**
 * The mark under a point, or undefined.
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
  const { width, height, datasets } = layout
  if (width <= 0 || height <= 0) {
    return undefined
  }
  const markHeight = offscreenMateMarkHeight(height)
  if (y < 0 || y > markHeight) {
    return undefined
  }
  for (let d = datasets.length - 1; d >= 0; d--) {
    const data = datasets[d]!
    for (let i = data.starts.length - 1; i >= 0; i--) {
      const rect = offscreenMateRectAt(layout, data, i, markHeight)
      if (rect && x >= rect.x && x <= rect.x + rect.width) {
        return {
          refName: offscreenMateRefName(rect),
          count: offscreenMateContigCount(rect),
          rect,
        }
      }
    }
  }
  return undefined
}

/**
 * Mark, on the query axis, the alignments this level fetched and cannot draw.
 *
 * These are real alignments whose mate is on a contig the facing row is not
 * displaying, so there is no second endpoint to run a ribbon to. Drawn as a
 * mark hanging off the query axis rather than as a degenerate ribbon with both
 * bottom corners equal, which draws a full-height vertical band and asserts an
 * alignment to whatever sits directly below.
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
 * THE LABEL IS THE ACTIONABLE HALF, and it names a STRETCH rather than a mark —
 * one per run of nearby anchors to the same contig. It goes on wherever it fits
 * rather than under a count threshold: fitting is what "too many to label"
 * actually means, and a run too narrow for its contig name is exactly the one
 * whose neighbours would have overprinted it.
 */
export function drawOffscreenMates(
  ctx: Ctx2D,
  layout: OffscreenMateLayout & { color: string; haloColor: string },
) {
  const rects = offscreenMateRects(layout)
  if (rects.length === 0) {
    return
  }
  const { color, haloColor } = layout
  // ONE PATH, NOT A FILL EACH. The mark color carries alpha, so overlapping
  // marks filled separately composite against each other and the strip darkens
  // with density — at whole-chromosome zoom there are more marks than pixels, so
  // it saturates to near-black and reads as a solid ideogram rather than as
  // marks. Filled as one path they take the color once. It is also what the SVG
  // export wants: one `<path>` instead of a `<rect>` per alignment.
  ctx.fillStyle = color
  ctx.beginPath()
  for (const r of rects) {
    ctx.rect(r.x, 0, r.width, r.height)
  }
  ctx.fill()

  ctx.font = LABEL_FONT
  ctx.textBaseline = 'alphabetic'
  ctx.lineWidth = LABEL_HALO_PX
  ctx.lineJoin = 'round'
  ctx.strokeStyle = haloColor
  const labels = placeLabels(
    labelRuns(rects),
    text => ctx.measureText(text).width,
    layout.width,
    layout.height,
  )
  for (const { refName, x, y } of labels) {
    ctx.strokeText(refName, x, y)
    ctx.fillText(refName, x, y)
  }
}
