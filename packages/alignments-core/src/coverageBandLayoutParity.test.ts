import { coverageLayout } from './coverageBandBox.ts'
import {
  covBottomOffsetPx,
  covEffectiveHeightPx,
} from './coverageBandLayout.generated.ts'
import {
  YSCALEBAR_LABEL_OFFSET,
  computeCoverageTicks,
} from './coverageDownsampling.ts'

// The retirement gate for `coverageBand.slang`'s `//! js-export` (adr-051). The
// band geometry lives in that shared render-core module — the clip-space
// conversions that use it are there too, and two plugins' bands draw from it —
// so the twin below is what this package open-coded before the lift.
//
// `retiredCoverageLayout` is what rendererUtils.ts open-coded. The asymmetry is
// the whole content: the scalebar-label inset is reserved at BOTH ends of the
// band, so the drawable height loses two of it while the baseline loses one.
// Getting that backwards on one backend shifts every coverage mark — bars, SNP
// segments, modification segments — rather than one glyph, which is precisely
// the drift that only shows up against the other backend.

function retiredCoverageLayout(coverageHeight: number) {
  const effectiveH = coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET
  const bottom = coverageHeight - YSCALEBAR_LABEL_OFFSET
  return { effectiveH, bottom }
}

// 0 and a height under the inset are degenerate but reachable — a collapsed
// coverage strip during a resize drag, or a config slot declaring a small
// `coverageHeight` (bandHeight.test.ts) — and both sides must agree there too.
const HEIGHTS = [0, 1, 5, 10, 11, 50, 100, 337]
const DRAWABLE = HEIGHTS.filter(h => h >= 2 * YSCALEBAR_LABEL_OFFSET)

test('the generated band layout reproduces the hand-written twin it replaced', () => {
  for (const h of DRAWABLE) {
    expect(coverageLayout(h)).toEqual(retiredCoverageLayout(h))
  }
})

// The one place the generated layout deliberately leaves the twin behind. Every
// coverage mark is `bottom - fraction * effectiveH`, so a band shorter than its
// two insets INVERTS rather than degrades: the depth bars, the SNP segments
// stacked in them and the interbase bars all grow DOWNWARD from a baseline near
// the band's top edge. The floor lives in coverageBand.slang, at the
// declaration, so both backends and the axis inherit it — a sub-inset band
// draws nothing instead of upside down.
test('a band shorter than its two insets draws nothing rather than inverting', () => {
  for (const h of HEIGHTS.filter(h => h < 2 * YSCALEBAR_LABEL_OFFSET)) {
    expect(retiredCoverageLayout(h).effectiveH).toBeLessThan(0)
    expect(coverageLayout(h).effectiveH).toBe(0)
  }
})

test('the label inset is reserved at both ends, so the two differ by one of it', () => {
  const { effectiveH, bottom } = coverageLayout(100)
  expect(bottom - effectiveH).toBe(YSCALEBAR_LABEL_OFFSET)
  expect(bottom).toBe(100 - YSCALEBAR_LABEL_OFFSET)
})

test('the baseline sits inside the band, and the bars fit between the insets', () => {
  const h = 50
  const { effectiveH, bottom } = coverageLayout(h)
  expect(bottom).toBeLessThan(h)
  expect(bottom - effectiveH).toBeGreaterThan(0)
})

// The other half of the band's contract, and the reason `coverageLayout` is its
// own module: the ticks are only trustworthy if they are placed in the box the
// bars are drawn in. `computeCoverageTicks` open-coded that box, so the two
// agreed by transcription rather than by construction.
test('the coverage axis places itself in the band the bars are drawn in', () => {
  for (const h of DRAWABLE.filter(x => x > 2 * YSCALEBAR_LABEL_OFFSET)) {
    const { effectiveH, bottom } = coverageLayout(h)
    const ticks = computeCoverageTicks([0, 100], h)
    expect(ticks.yBottom).toBe(bottom)
    expect(ticks.yBottom - ticks.yTop).toBe(effectiveH)
    // domain-min at the baseline, domain-max a full drawable height above it
    expect(ticks.items[0]!.y).toBe(bottom)
    expect(Math.min(...ticks.items.map(t => t.y))).toBeGreaterThanOrEqual(
      bottom - effectiveH,
    )
  }
})

test('the two generated functions are read in the units the shader uses', () => {
  // Both take (bandHeight, inset) in px, not a Uniforms struct — that is the
  // split that made them exportable at all, and a caller passing them in the
  // other order would silently invert the band.
  expect(covEffectiveHeightPx(100, 5)).toBe(90)
  expect(covBottomOffsetPx(100, 5)).toBe(95)
})
