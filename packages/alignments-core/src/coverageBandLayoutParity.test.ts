import { coverageLayout } from './coverageBandBox.ts'
import {
  covBarHeightPx,
  covBottomOffsetPx,
  covEffectiveHeightPx,
  covSegBottomPx,
  covSegTopPx,
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

// The second retirement gate on this file: the segment placement `covSegQuad`
// decides, which the three Canvas2D painters in rendererUtils.ts each open-coded
// — the depth bars, the SNP segments stacked in them and the modification
// segments. Three spellings of one rule, and the shader had a fourth.
//
// `retiredSegEdges` is what all three said, verbatim. The sweep favours the
// inputs where a band placement goes wrong invisibly: a sub-inset height (where
// `effectiveH` is floored to 0 and every mark collapses onto the baseline rather
// than inverting), a zero depth, a full-height bar, and the `0, 1` whole-bar
// spelling the depth pass passes — that one is the depth bar's ENTIRE geometry,
// so it is the case where a wrong twin is a blank coverage band.
function retiredSegEdges(
  bottom: number,
  effectiveH: number,
  depthFraction: number,
  yOffset: number,
  segHeight: number,
) {
  const barH = depthFraction * effectiveH
  const segBottom = bottom - yOffset * barH
  return { segTop: segBottom - segHeight * barH, segBottom }
}

const DEPTHS = [0, 0.001, 0.25, 0.5, 0.75, 1]
// (yOffset, segHeight) pairs: the whole bar, a stack of three that fills it, and
// a sliver at the top — the shapes computeSNPCoverage and the modification
// segments actually emit.
const STACKS = [
  [0, 1],
  [0, 0.4],
  [0.4, 0.35],
  [0.75, 0.25],
  [0.98, 0.02],
] as const

test('the generated segment placement reproduces the twin the painters open-coded', () => {
  for (const h of HEIGHTS) {
    const { effectiveH, bottom } = coverageLayout(h)
    for (const depth of DEPTHS) {
      const barH = covBarHeightPx(depth, effectiveH)
      for (const [yOffset, segHeight] of STACKS) {
        const retired = retiredSegEdges(
          bottom,
          effectiveH,
          depth,
          yOffset,
          segHeight,
        )
        expect(covSegBottomPx(bottom, yOffset, barH)).toBe(retired.segBottom)
        expect(covSegTopPx(bottom, yOffset, segHeight, barH)).toBe(
          retired.segTop,
        )
      }
    }
  }
})

test('the whole-bar spelling is the depth bar, measured up from the baseline', () => {
  const { effectiveH, bottom } = coverageLayout(100)
  const barH = covBarHeightPx(0.6, effectiveH)
  expect(covSegBottomPx(bottom, 0, barH)).toBe(bottom)
  expect(covSegTopPx(bottom, 0, 1, barH)).toBe(bottom - barH)
  // A zero-depth bin sits on the baseline with no height, rather than being
  // culled: both backends draw it, and the seam fudge still widens it.
  expect(covSegTopPx(bottom, 0, 1, covBarHeightPx(0, effectiveH))).toBe(bottom)
})

// The stacking contract, asserted as a property rather than through the twin:
// `yOffset` is measured from the baseline and `segHeight` up from there, so the
// slice above starts where this one ended. `computeSNPCoverage` is what emits
// the cumulative offsets; a sign flip or a dropped `barH` here separates two
// allele slices by a visible band.
//
// `toBeCloseTo`, not `toBe`, and the shader is in the same position: an edge
// reached as `baseline - (a + b) * barH` is not bit-identical to the same edge
// reached as `(baseline - a * barH) - b * barH`. Both backends now take the
// second route because both call these two functions, so the two of THEM agree
// exactly; what rounds is where a slice's own two edges came from.
test('consecutive segments of one bar meet at one edge', () => {
  const { effectiveH, bottom } = coverageLayout(80)
  const barH = covBarHeightPx(0.9, effectiveH)
  let yOffset = 0
  for (const segHeight of [0.5, 0.3, 0.2]) {
    const segTop = covSegTopPx(bottom, yOffset, segHeight, barH)
    yOffset += segHeight
    expect(covSegBottomPx(bottom, yOffset, barH)).toBeCloseTo(segTop, 10)
  }
  // and the stack fills the bar it is a stack of
  expect(covSegBottomPx(bottom, yOffset, barH)).toBeCloseTo(
    covSegTopPx(bottom, 0, 1, barH),
    10,
  )
})

// A band shorter than its two insets draws nothing rather than inverting, and
// that has to survive the whole composition, not just `covEffectiveHeightPx`:
// the floor is what keeps every segment on the baseline instead of growing
// downward out of the band.
test('a sub-inset band collapses every segment onto the baseline', () => {
  for (const h of HEIGHTS.filter(x => x < 2 * YSCALEBAR_LABEL_OFFSET)) {
    const { effectiveH, bottom } = coverageLayout(h)
    const barH = covBarHeightPx(1, effectiveH)
    expect(covSegTopPx(bottom, 0, 1, barH)).toBe(bottom)
    expect(covSegBottomPx(bottom, 0.5, barH)).toBe(bottom)
  }
})
