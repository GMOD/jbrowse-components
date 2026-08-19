import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'

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

export interface OffscreenMateDrawParams {
  data: OffscreenMateData
  // the QUERY axis, which is the only axis these have
  bpPerPx: number
  offsetPx: number
  width: number
  height: number
  color: string
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
 */
export function drawOffscreenMates(
  ctx: CanvasRenderingContext2D,
  { data, bpPerPx, offsetPx, width, height, color }: OffscreenMateDrawParams,
) {
  const { starts, ends } = data
  if (starts.length === 0 || width <= 0 || height <= 0) {
    return
  }
  const stubHeight = Math.max(
    1,
    Math.min(OFFSCREEN_MATE_HEIGHT_PX, height * MAX_BAND_FRACTION),
  )
  ctx.fillStyle = color
  for (let i = 0; i < starts.length; i++) {
    const x1 = screenX(starts[i]!, bpPerPx, offsetPx)
    const x2 = screenX(ends[i]!, bpPerPx, offsetPx)
    if (x2 < 0 || x1 > width) {
      continue
    }
    const w = Math.max(MIN_OFFSCREEN_MATE_WIDTH_PX, x2 - x1)
    ctx.fillRect(x1, 0, w, stubHeight)
  }
}
