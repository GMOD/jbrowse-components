import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { Theme } from '@mui/material'

// Tall enough to see against a scalebar, short enough that it visibly STOPS.
// The whole risk in drawing these is that a mark spanning the band reads as an
// alignment to the locus directly below it, which is the one thing they must
// not say — so a stub goes a fixed few pixels down whatever the band's height,
// and the gap under it is the message.
export const OFFSCREEN_MATE_HEIGHT_PX = 6

// A sub-pixel alignment still has to be a mark. The ribbons fade thin ones
// instead, but a stub carries no width information a reader could act on — it
// is a tick saying "something here goes elsewhere" — so it gets a floor.
export const MIN_OFFSCREEN_MATE_WIDTH_PX = 1.5

// At most a third of a short band, so a compact level does not turn into a
// solid bar with the ribbons hidden under it.
const MAX_BAND_FRACTION = 1 / 3

// Below this a label is a smudge, and the stub alone says "something here goes
// elsewhere" perfectly well. Measured against the drawn text, not guessed from
// the character count, since a scaffold name is not a fixed width.
const MIN_LABEL_PADDING_PX = 6

const LABEL_FONT = '10px sans-serif'

// The label sits BELOW the stub, over whatever the renderer drew — a ribbon, a
// pale fill, the empty band — so it is grey-on-anything and needs the halo the
// rest of the app's over-plot text uses. Only rendering it shows this: on a
// white band the plain fill reads fine, which is the state a test fixture is in.
const LABEL_HALO_PX = 3

// Clear of the stub, which occupies the top few pixels, and clear of the
// ribbons, which start below. Tight, because the band between two rows is the
// one place in this view with no vertical room to spare.
const LABEL_BASELINE_PX = 16

// Stubs to one contig nearer than this are one stretch as far as a label is
// concerned. A paleopolyploid block is dozens of anchors a few px apart, and a
// label per anchor is a wall of the same word; a label per STRETCH is the
// annotation a reader wanted.
const LABEL_MERGE_GAP_PX = 20

// One source for both surfaces. The screen overlay and the SVG export run the
// same draw, and a figure whose stubs are a different grey from the ones the
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
 * The stretches worth naming: each contig's stubs, joined where they sit close
 * together, so a run of anchors to one contig is one label rather than one per
 * anchor — and a contig appearing in two separate places is still named twice,
 * which naming each contig once would lose.
 */
function labelRuns(
  rects: OffscreenMateRect[],
  data: OffscreenMateData,
): LabelRun[] {
  const byContig = new Map<string, OffscreenMateRect[]>()
  for (const r of rects) {
    const refName = data.mateRefNameDict[data.mateRefNameIds[r.index]!]
    if (refName === undefined) {
      continue
    }
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

export interface OffscreenMateLayout {
  data: OffscreenMateData
  // the QUERY axis, which is the only axis these have
  bpPerPx: number
  offsetPx: number
  width: number
  height: number
  // The view-wide alignment-length floor, applied here for the same reason the
  // shader applies it to ribbons: a whole-genome hairball filtered down to its
  // real blocks should not keep a fringe of stubs for the noise it just hid.
  minAlignmentLength?: number
}

export interface OffscreenMateRect {
  index: number
  x: number
  width: number
  height: number
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
 * Where each stub lands on screen, in the order it is drawn.
 *
 * ONE FUNCTION BECAUSE DRAW AND HIT TEST HAVE TO AGREE. The ribbons keep that
 * agreement under test (`syntenyPickRenderAgreement.test.ts`) precisely because
 * their two paths are separate code; these have one path, so a stub the eye can
 * see and the pointer cannot is not a shape this can take.
 */
export function offscreenMateRects(
  layout: OffscreenMateLayout,
): OffscreenMateRect[] {
  const { width, height, data } = layout
  if (width <= 0 || height <= 0) {
    return []
  }
  const stubHeight = offscreenMateStripHeight(height)
  const out: OffscreenMateRect[] = []
  for (let i = 0; i < data.starts.length; i++) {
    const rect = offscreenMateRectAt(layout, i, stubHeight)
    if (rect) {
      out.push(rect)
    }
  }
  return out
}

// Every stub in a level is the same height, so the strip is a constant the hit
// test can reject a whole pointer position against before it looks at any
// alignment.
function offscreenMateStripHeight(height: number) {
  return Math.max(
    1,
    Math.min(OFFSCREEN_MATE_HEIGHT_PX, height * MAX_BAND_FRACTION),
  )
}

// The one place a stub's geometry is decided, so the array the canvas paints and
// the scan the pointer runs cannot describe different rectangles.
function offscreenMateRectAt(
  {
    data,
    bpPerPx,
    offsetPx,
    width,
    minAlignmentLength = 0,
  }: OffscreenMateLayout,
  i: number,
  stubHeight: number,
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
    index: i,
    x: x1,
    width: Math.max(MIN_OFFSCREEN_MATE_WIDTH_PX, x2 - x1),
    height: stubHeight,
  }
}

/**
 * The stub under a point, or undefined.
 *
 * LAST MATCH WINS, so the answer is whatever a reader sees on top where two
 * stubs overlap — the scan runs backwards over the array the canvas paints
 * forwards, and later paints over earlier.
 *
 * THE STRIP IS TESTED BEFORE ANY ALIGNMENT IS. Every stub has the same height,
 * and the strip is a few pixels of a band ~100 tall, so the overwhelming
 * majority of pointer positions this is asked about are not in it. Answering
 * those with one comparison rather than by laying out every stub first is what
 * keeps a hover over the ribbons costing nothing, whatever the level fetched.
 */
export function offscreenMateAt(
  layout: OffscreenMateLayout,
  x: number,
  y: number,
) {
  const { width, height, data } = layout
  if (width <= 0 || height <= 0) {
    return undefined
  }
  const stubHeight = offscreenMateStripHeight(height)
  if (y < 0 || y > stubHeight) {
    return undefined
  }
  for (let i = data.starts.length - 1; i >= 0; i--) {
    const rect = offscreenMateRectAt(layout, i, stubHeight)
    if (rect && x >= rect.x && x <= rect.x + rect.width) {
      return {
        refName: data.mateRefNameDict[data.mateRefNameIds[i]!],
        rect,
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
 * stub hanging off the query axis rather than as a degenerate ribbon with both
 * bottom corners equal, which draws a full-height vertical band and asserts an
 * alignment to whatever sits directly below.
 *
 * A SEPARATE OVERLAY RATHER THAN AN INSTANCE KIND. The instance format carries
 * four cumBp corners and the shader interpolates vertically over the full band
 * by construction, so a stub that descends part way is a new kind with a
 * per-kind vertical clamp in `.slang` AND its counterpart in
 * `syntenyRibbonPath.ts`, which have to agree or the Canvas2D fallback disagrees
 * with WebGPU. These need none of what that buys — no pick index, no CIGAR
 * tiling, no alpha compositing against ribbons — and there are thousands of
 * them, not millions. See `agent-docs/ideas/offscreen-synteny-mates.md`.
 *
 * THE LABEL IS THE ACTIONABLE HALF, and it names a STRETCH rather than a stub —
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
  const { color, haloColor, data } = layout
  ctx.fillStyle = color
  for (const r of rects) {
    ctx.fillRect(r.x, 0, r.width, r.height)
  }

  ctx.font = LABEL_FONT
  ctx.textBaseline = 'alphabetic'
  ctx.lineWidth = LABEL_HALO_PX
  ctx.lineJoin = 'round'
  ctx.strokeStyle = haloColor
  for (const run of labelRuns(rects, data)) {
    const textWidth = ctx.measureText(run.refName).width
    if (textWidth + MIN_LABEL_PADDING_PX > run.end - run.x) {
      continue
    }
    const x = run.x + (run.end - run.x - textWidth) / 2
    ctx.strokeText(run.refName, x, LABEL_BASELINE_PX)
    ctx.fillText(run.refName, x, LABEL_BASELINE_PX)
  }
}
