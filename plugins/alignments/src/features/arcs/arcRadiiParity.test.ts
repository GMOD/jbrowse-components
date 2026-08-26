import {
  ARC_APEX_FRACTION,
  ARC_FAR_SCREEN_WIDTHS,
} from '../../shaders/slang/arc.consts.generated.ts'
import { arcRadiiPx } from '../../shaders/slang/arc.js.generated.ts'

// Retirement gate for the hand-written twin of arc.slang's radius pair
// (adr-051). `strokeArc` in drawCanvas.ts took a `far` boolean the caller
// computed and derived `ry` from it; the shader computed both inside
// `arcCurve`. The two are one decision — `ry` is defined in terms of `rx`, both
// through the threshold and as its far-branch value — so they are lifted as a
// pair rather than split into two scalar exports that would each recompute the
// other's branch.
//
// The pair below is the retired code, verbatim, kept only long enough for this
// sweep. Note it does not even look like the shader's: the shader compared
// `2 * halfWidthPx` against `canvasW`, this compared a full span against a
// `screenWidthPx` threaded down through two call layers. Both spellings are the
// same rule, which is exactly why comment-syncing them held while nothing
// checked that it had.
function retiredRadii(
  halfWidthPx: number,
  destYPx: number,
  canvasWidthPx: number,
): [number, number] {
  const far = 2 * halfWidthPx > ARC_FAR_SCREEN_WIDTHS * canvasWidthPx
  return [halfWidthPx, far ? halfWidthPx : ARC_APEX_FRACTION * destYPx]
}

// Screen widths a real arcs band is drawn into: a narrow split pane through a
// wide desktop canvas. The block scissor width is what both backends pass
// (`geom.scissorW` on the GPU, `scissorW` on Canvas2D), so these are block
// widths, not window widths.
const CANVAS_WIDTHS = [97, 200, 640, 1024, 1920, 3840]

// Half-widths chosen to straddle every threshold: far inside, exactly on it
// (where a `>` versus `>=` slip shows and nothing else would), and far outside.
// A pair whose mate is megabases away really does reach these magnitudes — the
// shader's own comment records the catastrophic-cancellation trap at ~1e6 px.
const HALF_WIDTHS = [
  0, 0.5, 1, 12.5, 48, 48.5, 49, 96, 320, 512, 960, 1920, 5000, 1e6,
]

// Insert-size Y offsets within a band. `arcYOffsetPx` clamps these to availH,
// so 0 (a zero-insert pair) and the band height are both reachable in practice.
const DEST_YS = [0, 0.25, 1, 8.5, 17, 40, 92]

describe('arcRadiiPx replaces strokeArc’s hand-written radius pair', () => {
  it('agrees with the retired twin across the threshold', () => {
    for (const canvasWidthPx of CANVAS_WIDTHS) {
      for (const halfWidthPx of HALF_WIDTHS) {
        for (const destYPx of DEST_YS) {
          const [rx, ry] = arcRadiiPx(halfWidthPx, destYPx, canvasWidthPx)
          const [wantRx, wantRy] = retiredRadii(
            halfWidthPx,
            destYPx,
            canvasWidthPx,
          )
          expect(rx).toBeCloseTo(wantRx, 6)
          expect(ry).toBeCloseTo(wantRy, 6)
        }
      }
    }
  })

  // The half-width lane is the pair's on-screen half-span whichever branch
  // fires, so a `far` arc's two radii are equal and its dome is a true circle —
  // which is what makes the band clip it down to near-vertical legs. An `ry`
  // left on the insert-size Y would draw a flat dome instead, and the near
  // branch is the one that carries the insert size at all.
  it('returns a circle when far and the insert-size dome when not', () => {
    // The boundary is derived from the constant rather than written out, so
    // moving `ARC_FAR_SCREEN_WIDTHS` moves the case this pins instead of
    // breaking it — what is being pinned is that the two branches sit either
    // side of it, not where it currently is.
    const canvasWidthPx = 640
    const onThreshold = (ARC_FAR_SCREEN_WIDTHS * canvasWidthPx) / 2
    // Exactly on the threshold is NOT far: the comparison is strict, and both
    // sides spell it that way.
    expect(arcRadiiPx(onThreshold, 40, canvasWidthPx)).toEqual([
      onThreshold,
      ARC_APEX_FRACTION * 40,
    ])
    expect(arcRadiiPx(onThreshold + 0.5, 40, canvasWidthPx)).toEqual([
      onThreshold + 0.5,
      onThreshold + 0.5,
    ])
    expect(arcRadiiPx(onThreshold / 3, 40, canvasWidthPx)).toEqual([
      onThreshold / 3,
      ARC_APEX_FRACTION * 40,
    ])
  })

  // A degenerate pair (both reads at one bp, or a zero insert) is a real input:
  // it reaches here before any culling, and NaN radii would poison the whole
  // ctx.ellipse call rather than drawing nothing.
  it('stays finite on a degenerate pair', () => {
    for (const [rx, ry] of [
      arcRadiiPx(0, 0, 640),
      arcRadiiPx(0, 40, 640),
      arcRadiiPx(320, 0, 640),
    ]) {
      expect(Number.isFinite(rx)).toBe(true)
      expect(Number.isFinite(ry)).toBe(true)
    }
  })
})
