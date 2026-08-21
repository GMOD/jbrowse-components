// The 'auto' thin-fade decision: the width it is made on, and the widths it is
// made against. A leaf module because the display measures and the view decides,
// and because the arithmetic is then testable without standing up either —
// `LinearSyntenyView.fadeThinAlignments` reads `fadesThinAt` and
// `installAutoFadeLatch` moves the latch by it, and the two must agree.

// Fade on when the narrowest display's mean on-screen alignment-block width is
// below this many pixels — i.e. thin ribbons dominate, which is precisely when
// width-proportional fade declutters. Matches the perpW < 1 sub-pixel boundary
// the renderer fades at.
const ENGAGE_PX = 1

// ...and the width the ribbons have to come back above before the fade lets go.
//
// A DEADBAND, not a second opinion: the mean is taken over whatever features the
// current fetch window holds, and that window is snapped, so it rolls over once
// per `syntenyPanBufferPx` of panning and the mean steps with the slice it
// swapped. On one threshold a view whose mean sits near 1px flips the fade —
// every sub-pixel ribbon between full alpha and WIDTH_FADE_FLOOR, view-wide —
// several times per chromosome of scrolling, which reads as the picture changing
// under the reader. Measured on peach_grape.paf at the zoom that sits on the
// threshold, a rollover steps the mean by at most 11.3%, so 25% clears it with
// room to spare and still lets a genuine zoom-in relax the fade.
const RELEASE_PX = 1.25

// A block already this wide counts as exactly this wide, and no wider.
//
// The mean is asked whether the ribbons are predominantly sub-pixel, and an
// unbounded mean follows the widest blocks rather than the commonest: on a
// liftOver chain (hg38→hs1 chr1) the median block is 130 bp and the mean is
// 615,963 bp, so an uncapped criterion read 2.48 px and never faded a view whose
// blocks were 96% sub-pixel. Capping keeps a mean's smoothness under a fetch
// rollover, which a median or a sub-pixel count does not — ADR-083 has the
// measurements, and the alternatives it rejects.
//
// Must stay above RELEASE_PX: a capped mean cannot exceed its cap, so a cap at or
// below the release width would leave every view faded forever.
export const FADE_WIDE_BLOCK_PX = 2

// ...and only once a display has at least this many blocks, so a lone thin
// ribbon in a sparse view keeps full alpha instead of being faded toward
// invisibility.
export const FADE_AUTO_MIN_FEATURES = 10

/**
 * Mean on-screen width (px) of a display's alignment blocks, each counted at no
 * more than `FADE_WIDE_BLOCK_PX` — see there for why the cap is what makes this
 * answer the question the fade asks. Absolute genomic bounds in, px out.
 */
export function cappedMeanWidthPx(
  starts: Uint32Array,
  ends: Uint32Array,
  bpPerPx: number,
) {
  const n = starts.length
  if (n === 0) {
    return 0
  }
  const capBp = FADE_WIDE_BLOCK_PX * bpPerPx
  let total = 0
  for (let i = 0; i < n; i++) {
    const span = Math.abs(ends[i]! - starts[i]!)
    total += span < capBp ? span : capBp
  }
  return total / n / bpPerPx
}

/**
 * Whether 'auto' fades, given the narrowest capped mean any loaded display
 * reports and whether the fade is latched on. `Infinity` — a view with nothing
 * thin enough to judge — never fades.
 */
export function fadesThinAt(meanPx: number, latched: boolean) {
  return meanPx < (latched ? RELEASE_PX : ENGAGE_PX)
}
